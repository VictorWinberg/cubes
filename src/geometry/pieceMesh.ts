import type { Appearance, HoleSettings, Voxel } from "@/types/geometry";
import { validateShape } from "./shapeValidator";
import { buildBeveledSurface, buildSurface } from "./meshBuilder";
import { applyHoles } from "./holeGenerator";
import * as THREE from "three";

/** Build one polycube mesh (bevel + optional holes), matching lab preview settings. */
export const buildPieceGeometry = (
  voxels: Voxel[],
  look: Appearance,
  holes: HoleSettings,
): THREE.BufferGeometry => {
  const valid = validateShape(voxels).valid;
  const surf = look.bevel
    ? buildBeveledSurface(voxels, look.unit, look.bevelRadius, look.bevelSegments)
    : buildSurface(voxels, look.unit);
  if (!valid || !holes.enabled) return surf;
  try {
    return applyHoles(surf, voxels, look.unit, holes);
  } catch (e) {
    console.error(e);
    return surf;
  }
};
