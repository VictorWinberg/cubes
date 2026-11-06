import type { Axis, Voxel } from "@/types/geometry";

export const rotateVoxel = (v: Voxel, axis: Axis): Voxel => {
  if (axis === "x") return { x: v.x, y: -v.z, z: v.y };
  if (axis === "y") return { x: v.z, y: v.y, z: -v.x };
  return { x: -v.y, y: v.x, z: v.z };
};

export const normalize = (vs: Voxel[]): Voxel[] => {
  const mx = Math.min(...vs.map((v) => v.x));
  const my = Math.min(...vs.map((v) => v.y));
  const mz = Math.min(...vs.map((v) => v.z));
  return vs.map((v) => ({ x: v.x - mx + 0, y: v.y - my + 0, z: v.z - mz + 0 }));
};

export const rotateShape = (vs: Voxel[], axis: Axis) => normalize(vs.map((v) => rotateVoxel(v, axis)));
export const mirrorShape = (vs: Voxel[]) => normalize(vs.map((v) => ({ x: -v.x, y: v.y, z: v.z })));

export const shapeKey = (vs: Voxel[]) =>
  normalize(vs)
    .map((v) => `${v.x},${v.y},${v.z}`)
    .sort()
    .join("|");

/** All 24 proper rotations of a shape (normalized). */
export const allRotations = (vs: Voxel[]): Voxel[][] => {
  const seen = new Map<string, Voxel[]>();
  const queue = [normalize(vs)];
  while (queue.length) {
    const s = queue.pop()!;
    const k = shapeKey(s);
    if (seen.has(k)) continue;
    seen.set(k, s);
    queue.push(rotateShape(s, "x"), rotateShape(s, "y"));
  }
  return [...seen.values()];
};

/** Orientation-independent key; with mirror=true reflections count as the same shape. */
export const canonicalKey = (vs: Voxel[], mirror: boolean) => {
  const sets = mirror ? [...allRotations(vs), ...allRotations(mirrorShape(vs))] : allRotations(vs);
  return sets.map(shapeKey).sort()[0];
};

export const randomOrientation = (vs: Voxel[], allowMirror: boolean) => {
  let s = normalize(vs);
  if (allowMirror && Math.random() < 0.5) s = mirrorShape(s);
  const rots = allRotations(s);
  return rots[Math.floor(Math.random() * rots.length)];
};
