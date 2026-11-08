import { describe, expect, it } from "vitest";
import { holeColumns } from "@/geometry/holeGenerator";

/** Classic 2×2 O — flat square in the XY plane (same voxels as catalog shape "O"). */
const O_VOXELS = [
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 1, y: 1, z: 0 },
];

describe("holeColumns — 2×2 O", () => {
  it("drill Z: four single-voxel columns", () => {
    const cols = holeColumns(O_VOXELS, "z");
    expect(cols).toHaveLength(4);
    expect(cols.every((c) => c.n === 1)).toBe(true);
  });

  it("drill X: two columns through two voxels each", () => {
    const cols = holeColumns(O_VOXELS, "x");
    expect(cols).toHaveLength(2);
    expect(cols.every((c) => c.n === 2)).toBe(true);
  });

  it("drill Y: two columns through two voxels each", () => {
    const cols = holeColumns(O_VOXELS, "y");
    expect(cols).toHaveLength(2);
    expect(cols.every((c) => c.n === 2)).toBe(true);
  });
});
