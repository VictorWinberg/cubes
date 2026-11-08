import type { Axis, HoleSettings, Voxel } from "@/types/geometry";

/** Canonical export payload — frontend builds this; Python backend turns it into .blend. */
export type ExportPayload = {
  version: 1;
  unit: number;
  holes: HoleSettings;
  /** Lab: one piece. Scene/solver: many with world offsets. */
  pieces: ExportPiece[];
  /** Suggested download name, e.g. `tetracube-o-2d.blend`. */
  fileName?: string;
};

export type ExportPiece = {
  id: string;
  name?: string;
  voxels: Voxel[];
  /** World translation in Three.js/Blender units (already includes scene + piece alignment). */
  position: [number, number, number];
  color?: string;
};

export const holeSettingsForExport = (holes: HoleSettings, sceneMode: boolean): HoleSettings =>
  sceneMode
    ? { ...holes, enabled: false }
    : holes;
