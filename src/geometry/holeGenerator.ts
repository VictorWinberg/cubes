import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import type { HoleSettings, Voxel } from "@/types/geometry";
import { displayOffset } from "./meshBuilder";

const perp = { x: ["y", "z"], y: ["x", "z"], z: ["x", "y"] } as const;

/** Columns of cubes along the hole axis, longest first. */
export const holeColumns = (vs: Voxel[], axis: HoleSettings["axis"]) => {
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
  if (h.size >= 0.9) return "Hole is too large: it must be smaller than 90% of the cube size to leave walls.";
  if (Math.abs(h.offsetU) + h.size / 2 > 0.45 || Math.abs(h.offsetV) + h.size / 2 > 0.45)
    return "Hole position is too close to the cube edge: reduce the offset or the size.";
  const cols = holeColumns(vs, h.axis);
  if (h.count > cols.length)
    return `Only ${cols.length} hole${cols.length === 1 ? "" : "s"} can pass along ${h.axis.toUpperCase()} for this shape and orientation.`;
  return null;
};

/** Subtract real holes from the surface. Returns the input when holes are off/invalid. */
export const applyHoles = (surface: THREE.BufferGeometry, vs: Voxel[], unit: number, h: HoleSettings) => {
  if (!h.enabled || checkHoles(vs, h)) return surface;
  const o = displayOffset(vs);
  const [u, w] = perp[h.axis];
  const evaluator = new Evaluator();
  evaluator.attributes = ["position", "normal"];
  evaluator.useGroups = false;
  let result = new Brush(surface);
  result.updateMatrixWorld();
  for (const col of holeColumns(vs, h.axis).slice(0, h.count)) {
    const len = (col.max - col.min + 1) * unit + unit * 0.5;
    const d = h.size * unit;
    let g: THREE.BufferGeometry =
      h.shape === "circle" ? new THREE.CylinderGeometry(d / 2, d / 2, len, 40) : new THREE.BoxGeometry(d, len, d);
    // Cylinder/box are built along Y; orient them along the chosen axis.
    if (h.axis === "x") g.rotateZ(Math.PI / 2);
    if (h.axis === "z") g.rotateX(Math.PI / 2);
    g.deleteAttribute("uv");
    g = g.toNonIndexed();
    const pos = { x: 0, y: 0, z: 0 };
    pos[h.axis] = ((col.min + col.max + 1) / 2 + o[h.axis]) * unit;
    pos[u] = (col.u + 0.5 + h.offsetU + o[u]) * unit;
    pos[w] = (col.w + 0.5 + h.offsetV + o[w]) * unit;
    g.translate(pos.x, pos.y, pos.z);
    const b = new Brush(g);
    b.updateMatrixWorld();
    result = evaluator.evaluate(result, b, SUBTRACTION);
  }
  return result.geometry;
};
