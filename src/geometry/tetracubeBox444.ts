import type { PlacedPiece, Voxel } from "@/types/geometry";
import { normalize } from "@/utils/shapeRotation";

/**
 * One admissible packing of the 4×4×4 cube with 16 tetracubes matching the app catalog:
 * two each of I, O, T, T 3D, Z 3D, S 3D; one each of L, J, S, Z (flat).
 * Coordinates are grid cells x,y,z in [0,3]; world placement = local voxels + offset.
 */
const SOLVER_COLORS = [
  "#e8622c",
  "#2c7be8",
  "#2cb67d",
  "#c44dff",
  "#e8b92c",
  "#e82c6a",
  "#14b8a6",
  "#a855f7",
  "#f97316",
  "#6366f1",
];

function pieceFromCells(
  id: string,
  name: string,
  cells: readonly (readonly [number, number, number])[],
  colorIndex: number,
): PlacedPiece {
  const raw: Voxel[] = cells.map(([x, y, z]) => ({ x, y, z }));
  const mx = Math.min(...raw.map((v) => v.x));
  const my = Math.min(...raw.map((v) => v.y));
  const mz = Math.min(...raw.map((v) => v.z));
  const offset: Voxel = { x: mx, y: my, z: mz };
  const voxels = normalize(raw.map((v) => ({ x: v.x - mx, y: v.y - my, z: v.z - mz })));
  return {
    id,
    name,
    voxels,
    offset,
    color: SOLVER_COLORS[colorIndex % SOLVER_COLORS.length],
  };
}

/** Deep copy for React state (avoid mutating the canonical layout). */
export const cloneTetracubeBox444Pieces = (): PlacedPiece[] =>
  TETRACUBE_BOX_444_PIECES.map((p) => ({
    ...p,
    voxels: p.voxels.map((v) => ({ ...v })),
    offset: { ...p.offset },
  }));

/** 16 placed pieces filling 4×4×4. */
export const TETRACUBE_BOX_444_PIECES: PlacedPiece[] = [
  pieceFromCells("444-i-1", "I (1)", [
    [3, 0, 0],
    [2, 0, 0],
    [1, 0, 0],
    [0, 0, 0],
  ], 0),
  pieceFromCells("444-i-2", "I (2)", [
    [3, 1, 0],
    [2, 1, 0],
    [1, 1, 0],
    [0, 1, 0],
  ], 0),
  pieceFromCells("444-o-1", "O (1)", [
    [1, 2, 0],
    [0, 2, 0],
    [1, 3, 0],
    [0, 3, 0],
  ], 1),
  pieceFromCells("444-o-2", "O (2)", [
    [3, 2, 0],
    [2, 2, 0],
    [3, 3, 0],
    [2, 3, 0],
  ], 1),
  pieceFromCells("444-t-1", "T (1)", [
    [2, 0, 1],
    [1, 0, 1],
    [0, 0, 1],
    [1, 1, 1],
  ], 2),
  pieceFromCells("444-t-2", "T (2)", [
    [3, 0, 1],
    [3, 0, 2],
    [3, 0, 3],
    [3, 1, 2],
  ], 2),
  pieceFromCells("444-l-1", "L", [
    [0, 1, 2],
    [0, 2, 2],
    [0, 3, 2],
    [0, 1, 1],
  ], 3),
  pieceFromCells("444-j-1", "J", [
    [3, 1, 1],
    [3, 2, 1],
    [3, 3, 1],
    [2, 1, 1],
  ], 4),
  pieceFromCells("444-s-1", "S", [
    [0, 0, 2],
    [1, 0, 2],
    [1, 1, 2],
    [2, 1, 2],
  ], 5),
  pieceFromCells("444-z-1", "Z", [
    [0, 0, 3],
    [0, 1, 3],
    [1, 1, 3],
    [1, 2, 3],
  ], 6),
  pieceFromCells("444-br-1", "T 3D (1)", [
    [2, 3, 1],
    [2, 2, 1],
    [1, 3, 1],
    [2, 3, 2],
  ], 7),
  pieceFromCells("444-br-2", "T 3D (2)", [
    [2, 0, 3],
    [2, 0, 2],
    [2, 1, 3],
    [1, 0, 3],
  ], 7),
  pieceFromCells("444-sr-1", "Z 3D (1)", [
    [0, 3, 1],
    [0, 2, 1],
    [1, 2, 1],
    [1, 2, 2],
  ], 8),
  pieceFromCells("444-sr-2", "Z 3D (2)", [
    [2, 2, 2],
    [3, 2, 2],
    [3, 2, 3],
    [3, 1, 3],
  ], 8),
  pieceFromCells("444-sl-1", "S 3D (1)", [
    [0, 2, 3],
    [0, 3, 3],
    [1, 3, 3],
    [1, 3, 2],
  ], 9),
  pieceFromCells("444-sl-2", "S 3D (2)", [
    [2, 2, 3],
    [2, 3, 3],
    [3, 3, 3],
    [3, 3, 2],
  ], 9),
];
