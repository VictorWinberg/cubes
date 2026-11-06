import { describe, expect, it } from "vitest";
import { enumeratePolycubes } from "./tetrocubeGenerator";
import { SHAPES } from "./tetrisShapes";
import { validateShape } from "./shapeValidator";
import { randomGrowth } from "./tetrocubeGenerator";
import { buildSurface } from "./meshBuilder";

describe("tetrocubes", () => {
  it("has 8 fundamental forms when mirror images differ", () => expect(enumeratePolycubes(4, false)).toHaveLength(8));
  it("has 7 fundamental forms when mirror images are identified", () => expect(enumeratePolycubes(4, true)).toHaveLength(7));
  it("all presets are valid", () => SHAPES.forEach((s) => expect(validateShape(s.voxels).valid).toBe(true)));
  it("random growth always yields 4 connected cubes", () => {
    for (let i = 0; i < 200; i++) expect(validateShape(randomGrowth(true)).valid).toBe(true);
  });
  it("disconnected shapes are rejected", () =>
    expect(validateShape([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }]).valid).toBe(false));
  it("removes internal faces (I shape has 18 external faces)", () =>
    expect(buildSurface(SHAPES[0]!.voxels, 1).getAttribute("position").count).toBe(18 * 6));
});
