import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { Brush, Evaluator, ADDITION } from "three-bvh-csg";
import type { Voxel } from "@/types/geometry";
import { DIRS, keyOf } from "./shapeValidator";

/** Smoothstep for blending weights (0→0, 1→1). */
const smooth01 = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** Bit order matches `DIRS` in shapeValidator.ts. */
const NEIGHBOR_BIT = (d: Voxel) =>
  1 << (d.x === 1 ? 0 : d.x === -1 ? 1 : d.y === 1 ? 2 : d.y === -1 ? 3 : d.z === 1 ? 4 : 5);

/** Voxel-space offset that centers the shape on X/Z and rests it on y=0. */
export const displayOffset = (vs: Voxel[]) => {
  if (!vs.length) return { x: 0, y: 0, z: 0 };
  const r = (k: "x" | "y" | "z") => [
    Math.min(...vs.map((v) => v[k])),
    Math.max(...vs.map((v) => v[k])) + 1,
  ];
  const [x0, x1] = r("x") as [number, number],
    [y0] = r("y") as [number, number],
    [z0, z1] = r("z") as [number, number];
  return { x: -(x0 + x1) / 2, y: -y0, z: -(z0 + z1) / 2 };
};

// For each face direction: normal and 4 corners (CCW from outside) on a unit cube.
const FACES: { n: [number, number, number]; c: [number, number, number][] }[] = [
  {
    n: [1, 0, 0],
    c: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
  },
  {
    n: [-1, 0, 0],
    c: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
  },
  {
    n: [0, 1, 0],
    c: [
      [0, 1, 0],
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
    ],
  },
  {
    n: [0, -1, 0],
    c: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
  },
  {
    n: [0, 0, 1],
    c: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
  },
  {
    n: [0, 0, -1],
    c: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
  },
];

/** Closed external surface: only faces not shared with a neighbouring cube. */
export const buildSurface = (vs: Voxel[], unit: number) => {
  const set = new Set(vs.map(keyOf));
  const o = displayOffset(vs);
  const pos: number[] = [];
  const nor: number[] = [];
  for (const v of vs)
    for (const f of FACES) {
      if (set.has(keyOf({ x: v.x + f.n[0], y: v.y + f.n[1], z: v.z + f.n[2] }))) continue;
      const pts = f.c.map(([a, b, c]) => [
        (v.x + a + o.x) * unit,
        (v.y + b + o.y) * unit,
        (v.z + c + o.z) * unit,
      ]);
      for (const i of [0, 1, 2, 0, 2, 3]) {
        pos.push(...pts[i]!);
        nor.push(...f.n);
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return g;
};

/** Neighbor glued on each of the six faces (+x,-x,+y,-y,+z,-z); order matches NEIGHBOR_BIT. */
const neighborFaceFlags = (neighborMask: number) => ({
  xp: (neighborMask & (1 << 0)) !== 0,
  xm: (neighborMask & (1 << 1)) !== 0,
  yp: (neighborMask & (1 << 2)) !== 0,
  ym: (neighborMask & (1 << 3)) !== 0,
  zp: (neighborMask & (1 << 4)) !== 0,
  zm: (neighborMask & (1 << 5)) !== 0,
});

/**
 * Remove rounding where a face touches another voxel.
 *
 * - Face caps: snap only the glued axis (keeps opposite corners rounded).
 * - Edge fillets (2 axes in the rounded region): if either adjoining face is glued, snap both in-plane
 *   coords to ±half so the seam between two cubes is sharp along that edge (this was missing when we only flattened caps).
 * - Corners (3 axes): snap only coords whose signed face has a neighbor, so an exterior polycube corner stays beveled.
 *
 * Runs in local space (cube centered at origin); matches RoundedBoxGeometry extent ±half.
 */
export type BevelJointSnap = {
  snapSharedFaces: boolean;
  snapSharedEdges: boolean;
  snapSharedCorners: boolean;
};

/**
 * Snap rounded-box vertices so shared voxel contacts are less rounded.
 * Gates match the former modes: all true ≈ silhouette; faces-only ≈ old "flatFaces"; all false = no snap (full per-cube round).
 */
const snapInternalJointsToSharpBox = (
  g: THREE.BufferGeometry,
  neighborMask: number,
  unit: number,
  r: number,
  opts: BevelJointSnap,
) => {
  const half = unit / 2;
  const inner = half - r;
  const n = neighborFaceFlags(neighborMask);
  const posAttr = g.getAttribute("position") as THREE.BufferAttribute;
  const arr = posAttr.array as Float32Array;

  const clampHalf = (v: number) => Math.max(-half, Math.min(half, v));

  for (let i = 0; i < arr.length; i += 3) {
    let x = arr[i]!,
      y = arr[i + 1]!,
      z = arr[i + 2]!;
    const sx = Math.sign(x) || 1,
      sy = Math.sign(y) || 1,
      sz = Math.sign(z) || 1;

    const xp = x > inner,
      xm = x < -inner;
    const yp = y > inner,
      ym = y < -inner;
    const zp = z > inner,
      zm = z < -inner;
    const nxp = xp || xm,
      nyp = yp || ym,
      nzp = zp || zm;
    const c = (nxp ? 1 : 0) + (nyp ? 1 : 0) + (nzp ? 1 : 0);

    const ax = Math.abs(x),
      ay = Math.abs(y),
      az = Math.abs(z);

    if (c === 3 && opts.snapSharedCorners) {
      if (xp && n.xp) x = half;
      else if (xm && n.xm) x = -half;
      if (yp && n.yp) y = half;
      else if (ym && n.ym) y = -half;
      if (zp && n.zp) z = half;
      else if (zm && n.zm) z = -half;
    } else if (c === 2 && opts.snapSharedEdges) {
      const gluedX = sx > 0 ? n.xp : n.xm;
      const gluedY = sy > 0 ? n.yp : n.ym;
      const gluedZ = sz > 0 ? n.zp : n.zm;
      if (nxp && nyp && az <= inner && (gluedX || gluedY)) {
        x = sx * half;
        y = sy * half;
        z = clampHalf(z);
      } else if (nxp && nzp && ay <= inner && (gluedX || gluedZ)) {
        x = sx * half;
        z = sz * half;
        y = clampHalf(y);
      } else if (nyp && nzp && ax <= inner && (gluedY || gluedZ)) {
        y = sy * half;
        z = sz * half;
        x = clampHalf(x);
      }
    } else if (c === 1 && opts.snapSharedFaces) {
      if (xp && n.xp) {
        x = half;
        y = clampHalf(y);
        z = clampHalf(z);
      } else if (xm && n.xm) {
        x = -half;
        y = clampHalf(y);
        z = clampHalf(z);
      } else if (yp && n.yp) {
        y = half;
        x = clampHalf(x);
        z = clampHalf(z);
      } else if (ym && n.ym) {
        y = -half;
        x = clampHalf(x);
        z = clampHalf(z);
      } else if (zp && n.zp) {
        z = half;
        x = clampHalf(x);
        y = clampHalf(y);
      } else if (zm && n.zm) {
        z = -half;
        x = clampHalf(x);
        y = clampHalf(y);
      }
    }

    arr[i] = x;
    arr[i + 1] = y;
    arr[i + 2] = z;
  }

  posAttr.needsUpdate = true;
  g.computeVertexNormals();
};

/**
 * One fused mesh with rounded edges/corners on each voxel.
 * `radiusFrac` is corner radius as a fraction of the unit cube edge (clamped so geometry stays valid).
 * `jointSnap` — which contact snaps to apply before CSG union (all false = round every voxel edge including joints).
 */
export const buildBeveledSurface = (
  vs: Voxel[],
  unit: number,
  radiusFrac: number,
  jointSnap: BevelJointSnap,
  roundedSegments = 2,
) => {
  if (!vs.length) return buildSurface(vs, unit);
  const r = Math.min(Math.max(radiusFrac, 0), 0.45) * unit;
  if (r <= 1e-6) return buildSurface(vs, unit);

  const seg = Math.min(8, Math.max(1, Math.round(roundedSegments)));

  const o = displayOffset(vs);
  const set = new Set(vs.map(keyOf));
  const neighborMaskFor = (v: Voxel) => {
    let m = 0;
    for (const d of DIRS) {
      if (set.has(keyOf({ x: v.x + d.x, y: v.y + d.y, z: v.z + d.z }))) m |= NEIGHBOR_BIT(d);
    }
    return m;
  };

  const doSnap =
    jointSnap.snapSharedFaces || jointSnap.snapSharedEdges || jointSnap.snapSharedCorners;

  const evaluator = new Evaluator();
  evaluator.attributes = ["position", "normal"];
  evaluator.useGroups = false;

  let result: Brush | null = null;
  for (const v of vs) {
    let g: THREE.BufferGeometry = new RoundedBoxGeometry(unit, unit, unit, seg, r);
    if ("uv" in g.attributes) g.deleteAttribute("uv");
    g = g.toNonIndexed();
    if (doSnap) snapInternalJointsToSharpBox(g, neighborMaskFor(v), unit, r, jointSnap);
    g.translate((v.x + 0.5 + o.x) * unit, (v.y + 0.5 + o.y) * unit, (v.z + 0.5 + o.z) * unit);
    const brush = new Brush(g);
    brush.updateMatrixWorld();
    result = result ? evaluator.evaluate(result, brush, ADDITION) : brush;
  }
  return result!.geometry;
};

/** Thin outline segments for every cube boundary (visual only). */
export const buildCubeEdges = (vs: Voxel[], unit: number) => {
  const o = displayOffset(vs);
  const box = new THREE.EdgesGeometry(new THREE.BoxGeometry(unit, unit, unit));
  const src = box.getAttribute("position").array as Float32Array;
  const pos: number[] = [];
  for (const v of vs) {
    const cx = (v.x + 0.5 + o.x) * unit,
      cy = (v.y + 0.5 + o.y) * unit,
      cz = (v.z + 0.5 + o.z) * unit;
    for (let i = 0; i < src.length; i += 3)
      pos.push(src[i]! + cx, src[i + 1]! + cy, src[i + 2]! + cz);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return g;
};
