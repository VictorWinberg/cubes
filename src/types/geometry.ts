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
  /** Chamfer/round edges: radius as a fraction of the unit cube (0 = sharp boxes). */
  bevel: boolean;
  bevelRadius: number;
  /**
   * Per-voxel RoundedBox + CSG union: snap at cube–cube contacts (shared faces always flattened when snapping).
   * Both false = round every edge between cubes too.
   */
  bevelSnapSharedEdges: boolean;
  bevelSnapSharedCorners: boolean;
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
