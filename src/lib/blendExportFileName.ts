import type { AppMode, Voxel } from "@/types/geometry";

/** True when voxels span more than one layer on every axis (not flat in a single plane). */
export const isShape3D = (vs: Voxel[]): boolean =>
  (["x", "y", "z"] as const).every((k) => new Set(vs.map((v) => v[k])).size > 1);

const shapeSlug = (shapeName: string | undefined) =>
  (shapeName ?? "custom").split(" ")[0]!.replace(/\W/g, "").toLowerCase();

const dimSuffix = (vs: Voxel[]) => (isShape3D(vs) ? "3d" : "2d");

/** Download name for a single lab piece, e.g. `tetracube-o-2d.blend`. */
export const blendExportFileNameLab = (shapeName: string | undefined, voxels: Voxel[]): string =>
  `tetracube-${shapeSlug(shapeName)}-${dimSuffix(voxels)}.blend`;

export const blendExportFileNameForMode = (
  mode: AppMode,
  voxels: Voxel[],
  options?: { shapeName?: string; pieceCount?: number },
): string => {
  if (mode === "lab") {
    return blendExportFileNameLab(options?.shapeName, voxels);
  }
  const dim = dimSuffix(voxels);
  if (mode === "solver") return `tetracube-4x4x4-solver-${dim}.blend`;
  const n = options?.pieceCount ?? 0;
  return `tetracube-scene-${n}pieces-${dim}.blend`;
};
