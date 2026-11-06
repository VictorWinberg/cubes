export interface Voxel {
  x: number;
  y: number;
  z: number;
}

export type Axis = "x" | "y" | "z";

export interface ShapeDef {
  id: string;
  name: string;
  category: "classic" | "3d";
  voxels: Voxel[];
}

export type MaterialKind = "matte" | "satin" | "plastic" | "metal";

export interface Appearance {
  unit: number;
  color: string;
  edgeColor: string;
  edges: boolean;
  /** Chamfer/round edges: radius as a fraction of the unit cube (0 = sharp boxes). Snaps shared faces, edges, and corners between voxels. */
  bevel: boolean;
  bevelRadius: number;
  /**
   * Smoothness of each rounded cube (RoundedBoxGeometry segments). Higher = smoother arcs; 1 = very faceted.
   */
  bevelSegments: number;
  material: MaterialKind;
  light: number;
  wireframe: boolean;
  grid: boolean;
}

export interface HoleSettings {
  enabled: boolean;
  size: number; // fraction of unit size
  /** When true, subtract small spheres at exterior openings for a rounded rim. */
  rimSphere: boolean;
  /**
   * Rim scoop sphere radius as a fraction of the unit cube edge (world radius = this × `unit`).
   */
  rimRadius: number;
  /**
   * How far the rim sphere center is pushed outward along the hole axis from the face center,
   * as a fraction of the unit cube (world push = this × `unit`).
   */
  rimOffset: number;
  /** Drilling directions; at least one when enabled. */
  axes: Axis[];
}

/** App mode: single-shape lab vs multi-piece stack scene. */
export type AppMode = "lab" | "scene";

/**
 * A tetrocube instance in the stack scene: local 4-voxel shape plus integer grid offset.
 * World cell = local voxel + offset.
 */
export interface PlacedPiece {
  id: string;
  /** Display label (e.g. shape name). */
  name: string;
  voxels: Voxel[];
  offset: Voxel;
  /** Optional per-piece color; falls back to global appearance color. */
  color?: string;
}
