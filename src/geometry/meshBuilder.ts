import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { Brush, Evaluator, ADDITION } from "three-bvh-csg";
import type { Voxel } from "@/types/geometry";
import { keyOf } from "./shapeValidator";

/** Voxel-space offset that centers the shape on X/Z and rests it on y=0. */
export const displayOffset = (vs: Voxel[]) => {
  if (!vs.length) return { x: 0, y: 0, z: 0 };
  const r = (k: "x" | "y" | "z") => [Math.min(...vs.map((v) => v[k])), Math.max(...vs.map((v) => v[k])) + 1];
  const [x0, x1] = r("x") as [number, number], [y0] = r("y") as [number, number], [z0, z1] = r("z") as [number, number];
  return { x: -(x0 + x1) / 2, y: -y0, z: -(z0 + z1) / 2 };
};

// For each face direction: normal and 4 corners (CCW from outside) on a unit cube.
const FACES: { n: [number, number, number]; c: [number, number, number][] }[] = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
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
      const pts = f.c.map(([a, b, c]) => [(v.x + a + o.x) * unit, (v.y + b + o.y) * unit, (v.z + c + o.z) * unit]);
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

/**
 * One fused mesh with rounded edges/corners on each voxel.
 * `radiusFrac` is corner radius as a fraction of the unit cube edge (clamped so geometry stays valid).
 */
export const buildBeveledSurface = (vs: Voxel[], unit: number, radiusFrac: number) => {
  if (!vs.length) return buildSurface(vs, unit);
  const r = Math.min(Math.max(radiusFrac, 0), 0.45) * unit;
  if (r <= 1e-6) return buildSurface(vs, unit);

  const o = displayOffset(vs);
  const evaluator = new Evaluator();
  evaluator.attributes = ["position", "normal"];
  evaluator.useGroups = false;

  let result: Brush | null = null;
  for (const v of vs) {
    let g: THREE.BufferGeometry = new RoundedBoxGeometry(unit, unit, unit, 2, r);
    if ("uv" in g.attributes) g.deleteAttribute("uv");
    g = g.toNonIndexed();
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
    const cx = (v.x + 0.5 + o.x) * unit, cy = (v.y + 0.5 + o.y) * unit, cz = (v.z + 0.5 + o.z) * unit;
    for (let i = 0; i < src.length; i += 3) pos.push(src[i]! + cx, src[i + 1]! + cy, src[i + 2]! + cz);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return g;
};
