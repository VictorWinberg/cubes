import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import type { Axis, HoleSettings, Voxel } from "@/types/geometry";
import { displayOffset } from "./meshBuilder";
import { keyOf } from "./shapeValidator";

const perp = { x: ["y", "z"], y: ["x", "z"], z: ["x", "y"] } as const;

/** Columns of cubes along the hole axis, longest first. */
export const holeColumns = (vs: Voxel[], axis: Axis) => {
  const [u, w] = perp[axis];
  const m = new Map<string, { u: number; w: number; min: number; max: number; n: number }>();
  for (const v of vs) {
    const k = `${v[u]},${v[w]}`;
    const c = m.get(k) ?? { u: v[u], w: v[w], min: v[axis], max: v[axis], n: 0 };
    c.min = Math.min(c.min, v[axis]);
    c.max = Math.max(c.max, v[axis]);
    c.n++;
    m.set(k, c);
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.u - b.u || a.w - b.w);
};

export const checkHoles = (vs: Voxel[], h: HoleSettings): string | null => {
  if (!h.enabled) return null;
  const axes = [...new Set(h.axes)];
  if (axes.length === 0) return "Select at least one drill direction.";
  if (h.size >= 0.9)
    return "Hole is too large: it must be smaller than 90% of the cube size to leave walls.";
  return null;
};

const prepareBrushGeo = (g: THREE.BufferGeometry) => {
  g.deleteAttribute("uv");
  return g.toNonIndexed();
};

/** Align default Y-up cylinder/box to the tunnel axis (x|y|z). */
const alignToAxis = (g: THREE.BufferGeometry, axis: Axis) => {
  if (axis === "x") g.rotateZ(Math.PI / 2);
  if (axis === "z") g.rotateX(Math.PI / 2);
};

/** Drill volume along the column: circular tunnel. */
const buildTunnelGeometry = (axis: Axis, len: number, d: number): THREE.BufferGeometry => {
  const r = d / 2;
  const g: THREE.BufferGeometry = new THREE.CylinderGeometry(r, r, len, 40);
  alignToAxis(g, axis);
  return prepareBrushGeo(g);
};

/** World-space face centers + outward normals for exterior drill openings of one column. */
const exteriorOpeningSpheresParams = (
  col: { u: number; w: number; min: number; max: number },
  axis: Axis,
  vs: Set<string>,
  o: { x: number; y: number; z: number },
  unit: number,
  h: HoleSettings,
): { cx: number; cy: number; cz: number; radius: number }[] => {
  const radius = Math.min(Math.max(0, h.rimRadius * unit), unit * 0.49);
  const push = h.rimOffset * unit;
  if (radius <= 1e-6) return [];
  const out: { cx: number; cy: number; cz: number; radius: number }[] = [];

  const addIfExterior = (
    vx: number,
    vy: number,
    vz: number,
    nx: number,
    ny: number,
    nz: number,
  ) => {
    const neighbor = {
      x: vx + nx,
      y: vy + ny,
      z: vz + nz,
    };
    if (vs.has(keyOf(neighbor))) return;
    let cx = (vx + 0.5 + o.x) * unit;
    let cy = (vy + 0.5 + o.y) * unit;
    let cz = (vz + 0.5 + o.z) * unit;
    cx += nx * (0.5 * unit + push);
    cy += ny * (0.5 * unit + push);
    cz += nz * (0.5 * unit + push);
    out.push({ cx, cy, cz, radius });
  };

  const [u, w] = perp[axis];
  const uKey = u as "x" | "y" | "z";
  const wKey = w as "x" | "y" | "z";

  const vMin = { x: 0, y: 0, z: 0 };
  const vMax = { x: 0, y: 0, z: 0 };
  vMin[axis] = col.min;
  vMax[axis] = col.max;
  vMin[uKey] = col.u;
  vMin[wKey] = col.w;
  vMax[uKey] = col.u;
  vMax[wKey] = col.w;

  const nLow = { x: 0, y: 0, z: 0 };
  const nHigh = { x: 0, y: 0, z: 0 };
  nLow[axis] = -1;
  nHigh[axis] = 1;

  addIfExterior(vMin.x, vMin.y, vMin.z, nLow.x, nLow.y, nLow.z);
  addIfExterior(vMax.x, vMax.y, vMax.z, nHigh.x, nHigh.y, nHigh.z);

  return out;
};

/** Subtract drill tunnels, then subtract small spheres at each exterior opening for a rounded rim. */
export const applyHoles = (
  surface: THREE.BufferGeometry,
  vs: Voxel[],
  unit: number,
  h: HoleSettings,
) => {
  if (!h.enabled || checkHoles(vs, h)) return surface;
  const o = displayOffset(vs);
  const voxelSet = new Set(vs.map(keyOf));
  const evaluator = new Evaluator();
  evaluator.attributes = ["position", "normal"];
  evaluator.useGroups = false;
  let result = new Brush(surface);
  result.updateMatrixWorld();
  const d = h.size * unit;

  for (const axis of [...new Set(h.axes)]) {
    for (const col of holeColumns(vs, axis)) {
      const len = (col.max - col.min + 1) * unit + unit * 0.5;
      const g = buildTunnelGeometry(axis, len, d);
      const pos = { x: 0, y: 0, z: 0 };
      pos[axis] = ((col.min + col.max + 1) / 2 + o[axis]) * unit;
      const [u, w] = perp[axis];
      pos[u] = (col.u + 0.5 + o[u]) * unit;
      pos[w] = (col.w + 0.5 + o[w]) * unit;
      g.translate(pos.x, pos.y, pos.z);
      const b = new Brush(g);
      b.updateMatrixWorld();
      result = evaluator.evaluate(result, b, SUBTRACTION);
    }
  }

  if (h.rimSphere) {
    for (const axis of [...new Set(h.axes)]) {
      for (const col of holeColumns(vs, axis)) {
        for (const sp of exteriorOpeningSpheresParams(col, axis, voxelSet, o, unit, h)) {
          let sg = new THREE.SphereGeometry(sp.radius, 24, 24);
          sg = prepareBrushGeo(sg);
          sg.translate(sp.cx, sp.cy, sp.cz);
          const sb = new Brush(sg);
          sb.updateMatrixWorld();
          result = evaluator.evaluate(result, sb, SUBTRACTION);
        }
      }
    }
  }

  return result.geometry;
};
