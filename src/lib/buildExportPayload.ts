import { displayOffset } from "@/geometry/meshBuilder";
import { pieceGroupPosition } from "@/scene/placement";
import type { ExportPayload, ExportPiece } from "@/types/exportPayload";
import { holeSettingsForExport } from "@/types/exportPayload";
import type { AppMode, HoleSettings, PlacedPiece, Voxel } from "@/types/geometry";

export const buildLabExportPayload = (
  voxels: Voxel[],
  unit: number,
  holes: HoleSettings,
  shapeName?: string,
  fileName?: string,
): ExportPayload => ({
  version: 1,
  unit,
  holes,
  pieces: [{ id: "body", name: shapeName, voxels, position: [0, 0, 0] }],
  fileName,
});

export const buildSceneExportPayload = (
  pieces: PlacedPiece[],
  worldVoxels: Voxel[],
  unit: number,
  holes: HoleSettings,
): ExportPayload => ({
  version: 1,
  unit,
  holes: holeSettingsForExport(holes, true),
  pieces: pieces.map((p): ExportPiece => {
    const sceneOff = displayOffset(worldVoxels);
    return {
      id: p.id,
      name: p.name,
      voxels: p.voxels,
      color: p.color,
      position: pieceGroupPosition(p, sceneOff, displayOffset(p.voxels), unit),
    };
  }),
});

const shapeSlug = (shapeName: string | undefined) =>
  (shapeName ?? "custom").split(" ")[0]!.replace(/\W/g, "").toLowerCase();

const dimSuffix = (vs: Voxel[]) =>
  (["x", "y", "z"] as const).every((k) => new Set(vs.map((v) => v[k])).size > 1) ? "3d" : "2d";

/** Suggested `.blend` download name for lab / scene / solver. */
export const blendFileNameForMode = (
  mode: AppMode,
  voxels: Voxel[],
  options?: { shapeName?: string; pieceCount?: number },
): string => {
  const dim = dimSuffix(voxels);
  if (mode === "lab") return `tetracube-${shapeSlug(options?.shapeName)}-${dim}.blend`;
  if (mode === "solver") return `tetracube-4x4x4-solver-${dim}.blend`;
  const n = options?.pieceCount ?? 0;
  return `tetracube-scene-${n}pieces-${dim}.blend`;
};
