import type { Voxel } from "@/types/geometry";

export const keyOf = (v: Voxel) => `${v.x},${v.y},${v.z}`;
export const DIRS: Voxel[] = [
  { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
];

export const isConnected = (vs: Voxel[]) => {
  if (vs.length === 0) return false;
  const set = new Set(vs.map(keyOf));
  const seen = new Set<string>([keyOf(vs[0]!)]);
  const stack: Voxel[] = [vs[0]!];
  while (stack.length) {
    const c = stack.pop()!;
    for (const d of DIRS) {
      const k = keyOf({ x: c.x + d.x, y: c.y + d.y, z: c.z + d.z });
      if (set.has(k) && !seen.has(k)) {
        seen.add(k);
        const [x, y, z] = k.split(",").map(Number) as [number, number, number];
        stack.push({ x, y, z });
      }
    }
  }
  return seen.size === set.size;
};

export interface Validation {
  valid: boolean;
  errors: string[];
}

export const validateShape = (vs: Voxel[]): Validation => {
  const errors: string[] = [];
  if (vs.length !== 4) errors.push(`Shape has ${vs.length} cube${vs.length === 1 ? "" : "s"} — exactly 4 required.`);
  if (vs.some((v) => ![v.x, v.y, v.z].every(Number.isInteger))) errors.push("All coordinates must be integers.");
  if (new Set(vs.map(keyOf)).size !== vs.length) errors.push("Cubes overlap.");
  if (vs.length > 0 && !isConnected(vs)) errors.push("Cubes are not all connected face-to-face.");
  return { valid: errors.length === 0, errors };
};

export const freeNeighbors = (vs: Voxel[]): Voxel[] => {
  const set = new Set(vs.map(keyOf));
  const out = new Map<string, Voxel>();
  for (const v of vs)
    for (const d of DIRS) {
      const n = { x: v.x + d.x, y: v.y + d.y, z: v.z + d.z };
      const k = keyOf(n);
      if (!set.has(k)) out.set(k, n);
    }
  return [...out.values()];
};
