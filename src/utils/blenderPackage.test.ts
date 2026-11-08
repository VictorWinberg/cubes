import { describe, expect, it } from "vitest";
import { buildBlenderExportObjects } from "@/geometry/blenderExport";
import { objectsToObj } from "@/utils/blenderPackage";

describe("objectsToObj", () => {
  it("emits quad faces for a single voxel", () => {
    const objs = buildBlenderExportObjects([{ x: 0, y: 0, z: 0 }], 1, {
      enabled: false,
      size: 0.5,
      rimSphere: false,
      rimRadius: 0.5,
      rimOffset: 0.37,
      axes: ["y"],
    });
    const obj = objectsToObj(objs);
    expect(obj).toContain("o Body");
    const faceLines = obj.split("\n").filter((l) => l.startsWith("f "));
    expect(faceLines.length).toBe(6);
    for (const line of faceLines) {
      const parts = line.split(" ");
      expect(parts.length).toBe(5); // f + 4 indices
    }
  });
});
