import { displayOffset } from "@/geometry/meshBuilder";
import { pieceGroupPosition } from "@/scene/placement";
import type { ExportPayload, ExportPiece } from "@/types/exportPayload";
import { holeSettingsForExport } from "@/types/exportPayload";
import type { HoleSettings, PlacedPiece, Voxel } from "@/types/geometry";

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
