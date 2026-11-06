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
  material: MaterialKind;
  light: number;
  wireframe: boolean;
  grid: boolean;
}

export interface HoleSettings {
  enabled: boolean;
  shape: "circle" | "square";
  size: number; // fraction of unit size
  axis: Axis;
  offsetU: number; // fraction of unit, within a cell
  offsetV: number;
  count: number;
}
