import type { PlacedPiece, Voxel } from "@/types/geometry";
import { keyOf } from "@/geometry/shapeValidator";
import { normalize } from "@/utils/shapeRotation";

/** Local voxels translated by the piece offset into world grid cells. */
export const toWorldVoxels = (piece: Pick<PlacedPiece, "voxels" | "offset">): Voxel[] =>
  piece.voxels.map((v) => ({
    x: v.x + piece.offset.x,
    y: v.y + piece.offset.y,
    z: v.z + piece.offset.z,
  }));

/** All world voxels across pieces (order follows pieces × voxels). */
export const allWorldVoxels = (pieces: PlacedPiece[]): Voxel[] => pieces.flatMap(toWorldVoxels);

/** Occupancy set of world cell keys for the given pieces. */
export const collectOccupancy = (pieces: PlacedPiece[]): Set<string> => {
  const set = new Set<string>();
  for (const p of pieces) for (const v of toWorldVoxels(p)) set.add(keyOf(v));
  return set;
};

/**
 * True if `candidate` (with its offset) would share any world cell with `others`.
 * Does not include `candidate` in `others`.
 */
export const wouldOverlap = (
  candidate: Pick<PlacedPiece, "voxels" | "offset">,
  others: PlacedPiece[],
): boolean => {
  const occupied = collectOccupancy(others);
  for (const v of toWorldVoxels(candidate)) {
    if (occupied.has(keyOf(v))) return true;
  }
  return false;
};

/** Delta for moving a piece by one grid step on an axis. */
export const offsetDelta = (axis: "x" | "y" | "z", dir: 1 | -1): Voxel => ({
  x: axis === "x" ? dir : 0,
  y: axis === "y" ? dir : 0,
  z: axis === "z" ? dir : 0,
});

export const addOffsets = (a: Voxel, b: Voxel): Voxel => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});

/**
 * Find a grid offset for `voxels` that does not overlap existing pieces.
 * Searches along +X then +Y (stack) in a small set of candidates.
 */
export const findFreeOffset = (voxels: Voxel[], existing: PlacedPiece[]): Voxel => {
  const local = normalize(voxels);
  if (existing.length === 0) return { x: 0, y: 0, z: 0 };

  const world = allWorldVoxels(existing);
  const maxX = Math.max(...world.map((v) => v.x));
  const maxY = Math.max(...world.map((v) => v.y));
  const maxZ = Math.max(...world.map((v) => v.z));

  const candidates: Voxel[] = [
    { x: maxX + 2, y: 0, z: 0 },
    { x: 0, y: maxY + 1, z: 0 },
    { x: maxX + 2, y: maxY + 1, z: 0 },
    { x: 0, y: 0, z: maxZ + 2 },
  ];

  for (let y = 0; y <= maxY + 4; y++) {
    for (let x = 0; x <= maxX + 6; x++) {
      candidates.push({ x, y, z: 0 });
    }
  }

  for (const offset of candidates) {
    if (!wouldOverlap({ voxels: local, offset }, existing)) return offset;
  }
  return { x: maxX + 4, y: 0, z: 0 };
};

let pieceSeq = 0;
export const nextPieceId = () => `piece-${++pieceSeq}-${Date.now().toString(36)}`;

/**
 * World-space group translation so a mesh built with local `displayOffset(piece.voxels)`
 * lands at the same place as world voxels under `sceneOffset`
 * (usually `displayOffset(allWorldVoxels)`).
 */
export const pieceGroupPosition = (
  piece: Pick<PlacedPiece, "voxels" | "offset">,
  sceneOffset: Voxel,
  localOffset: Voxel,
  unit: number,
): [number, number, number] => [
  (piece.offset.x + sceneOffset.x - localOffset.x) * unit,
  (piece.offset.y + sceneOffset.y - localOffset.y) * unit,
  (piece.offset.z + sceneOffset.z - localOffset.z) * unit,
];
