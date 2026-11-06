import { describe, expect, it } from "vitest";
import { SHAPES } from "@/geometry/tetrisShapes";
import { normalize } from "@/utils/shapeRotation";
import type { PlacedPiece } from "@/types/geometry";
import {
  addOffsets,
  allWorldVoxels,
  collectOccupancy,
  findFreeOffset,
  offsetDelta,
  pieceGroupPosition,
  toWorldVoxels,
  wouldOverlap,
} from "./placement";
import { validateScene } from "./sceneValidator";

const straight = normalize(SHAPES[0]!.voxels);

const piece = (id: string, offset: { x: number; y: number; z: number }, voxels = straight): PlacedPiece => ({
  id,
  name: id,
  voxels,
  offset,
});

describe("placement", () => {
  it("toWorldVoxels adds offset to each local cell", () => {
    const p = piece("a", { x: 2, y: 1, z: -1 });
    expect(toWorldVoxels(p)).toEqual(
      p.voxels.map((v) => ({ x: v.x + 2, y: v.y + 1, z: v.z - 1 })),
    );
  });

  it("collectOccupancy unions world cells", () => {
    const a = piece("a", { x: 0, y: 0, z: 0 });
    const b = piece("b", { x: 10, y: 0, z: 0 });
    expect(collectOccupancy([a, b]).size).toBe(a.voxels.length + b.voxels.length);
    expect(allWorldVoxels([a, b])).toHaveLength(8);
  });

  it("wouldOverlap detects shared world cells", () => {
    const a = piece("a", { x: 0, y: 0, z: 0 });
    const b = piece("b", { x: 0, y: 0, z: 0 });
    expect(wouldOverlap(b, [a])).toBe(true);
    expect(wouldOverlap({ voxels: straight, offset: { x: 0, y: 2, z: 0 } }, [a])).toBe(false);
  });

  it("findFreeOffset returns non-overlapping placement", () => {
    const existing = [piece("a", { x: 0, y: 0, z: 0 })];
    const offset = findFreeOffset(straight, existing);
    expect(wouldOverlap({ voxels: straight, offset }, existing)).toBe(false);
  });

  it("offsetDelta and addOffsets move by one grid step", () => {
    expect(addOffsets({ x: 1, y: 2, z: 3 }, offsetDelta("y", 1))).toEqual({ x: 1, y: 3, z: 3 });
    expect(offsetDelta("x", -1)).toEqual({ x: -1, y: 0, z: 0 });
  });

  it("pieceGroupPosition accounts for scene vs local display offsets", () => {
    const p = piece("a", { x: 0, y: 2, z: 0 });
    const pos = pieceGroupPosition(p, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 1);
    expect(pos).toEqual([0, 2, 0]);
  });
});

describe("validateScene", () => {
  it("empty scene is valid", () => {
    expect(validateScene([]).valid).toBe(true);
  });

  it("non-overlapping valid pieces pass", () => {
    const a = piece("a", { x: 0, y: 0, z: 0 });
    const b = piece("b", { x: 0, y: 2, z: 0 });
    expect(validateScene([a, b]).valid).toBe(true);
  });

  it("overlapping pieces fail", () => {
    const a = piece("a", { x: 0, y: 0, z: 0 });
    const b = piece("b", { x: 0, y: 0, z: 0 });
    const r = validateScene([a, b]);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("Overlap"))).toBe(true);
  });

  it("invalid local polycube fails", () => {
    const bad = piece("bad", { x: 0, y: 0, z: 0 }, [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 5, y: 0, z: 0 },
    ]);
    expect(validateScene([bad]).valid).toBe(false);
  });
});
