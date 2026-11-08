import { describe, expect, it } from "vitest";
import {
  blendExportFileNameForMode,
  blendExportFileNameLab,
  isShape3D,
} from "@/lib/blendExportFileName";

describe("blendExportFileName", () => {
  const o2d = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 1, y: 1, z: 0 },
  ];
  const i3d = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: 2 },
    { x: 0, y: 0, z: 3 },
  ];

  it("detects 2d vs 3d extent", () => {
    expect(isShape3D(o2d)).toBe(false);
    expect(isShape3D(i3d)).toBe(false);
    expect(
      isShape3D([
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 1 },
      ]),
    ).toBe(true);
  });

  it("names lab export tetracube-{shape}-{2d|3d}.blend", () => {
    expect(blendExportFileNameLab("O", o2d)).toBe("tetracube-o-2d.blend");
    expect(blendExportFileNameLab("T 3D", i3d)).toBe("tetracube-t-2d.blend");
  });

  it("names scene and solver exports", () => {
    expect(blendExportFileNameForMode("scene", o2d, { pieceCount: 3 })).toBe(
      "tetracube-scene-3pieces-2d.blend",
    );
    expect(blendExportFileNameForMode("solver", o2d)).toBe("tetracube-4x4x4-solver-2d.blend");
  });
});
