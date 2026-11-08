import { describe, expect, it } from "vitest";
import { buildLabExportPayload } from "@/lib/buildExportPayload";

describe("buildLabExportPayload", () => {
  it("wraps voxels in versioned payload", () => {
    const p = buildLabExportPayload([{ x: 0, y: 0, z: 0 }], 2, {
      enabled: true,
      size: 0.5,
      rimSphere: false,
      rimRadius: 0.5,
      rimOffset: 0.37,
      axes: ["y"],
    });
    expect(p.version).toBe(1);
    expect(p.unit).toBe(2);
    expect(p.pieces).toHaveLength(1);
    expect(p.pieces[0]!.voxels).toHaveLength(1);
  });
});
