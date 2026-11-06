import type { ShapeDef, Voxel } from "@/types/geometry";

const p = (...c: [number, number, number][]): Voxel[] => c.map(([x, y, z]) => ({ x, y, z }));

export const SHAPES: ShapeDef[] = [
  { id: "I", name: "I", category: "classic", voxels: p([0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]) },
  { id: "O", name: "O", category: "classic", voxels: p([0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]) },
  { id: "T", name: "T", category: "classic", voxels: p([0, 0, 0], [1, 0, 0], [2, 0, 0], [1, 1, 0]) },
  { id: "L", name: "L", category: "classic", voxels: p([0, 0, 0], [0, 1, 0], [0, 2, 0], [1, 0, 0]) },
  { id: "J", name: "J", category: "classic", voxels: p([1, 0, 0], [1, 1, 0], [1, 2, 0], [0, 0, 0]) },
  { id: "S", name: "S", category: "classic", voxels: p([0, 0, 0], [1, 0, 0], [1, 1, 0], [2, 1, 0]) },
  { id: "Z", name: "Z", category: "classic", voxels: p([0, 1, 0], [1, 1, 0], [1, 0, 0], [2, 0, 0]) },
  { id: "BR", name: "T 3D", category: "3d", voxels: p([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]) },
  { id: "SR", name: "Z 3D", category: "3d", voxels: p([0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1]) },
  { id: "SL", name: "S 3D", category: "3d", voxels: p([0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, -1]).map((v) => ({ ...v, z: v.z + 1 })) },
];
