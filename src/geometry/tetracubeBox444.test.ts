import { describe, expect, it } from "vitest";
import { keyOf, validateShape } from "@/geometry/shapeValidator";
import { validateScene } from "@/scene/sceneValidator";
import { allWorldVoxels } from "@/scene/placement";
import { TETRACUBE_BOX_444_PIECES } from "./tetracubeBox444";

describe("tetracubeBox444", () => {
  it("tiles a 4×4×4 with the catalog multiset (2× I,O,T + 3D trio; 1× L,J,S,Z)", () => {
    expect(TETRACUBE_BOX_444_PIECES.length).toBe(16);
    const world = allWorldVoxels(TETRACUBE_BOX_444_PIECES);
    expect(world.length).toBe(64);
    const keys = new Set(world.map(keyOf));
    expect(keys.size).toBe(64);
    for (const v of world) {
      for (const k of ["x", "y", "z"] as const) {
        expect(v[k]).toBeGreaterThanOrEqual(0);
        expect(v[k]).toBeLessThanOrEqual(3);
      }
    }
    const scene = validateScene(TETRACUBE_BOX_444_PIECES);
    expect(scene.valid).toBe(true);
    for (const p of TETRACUBE_BOX_444_PIECES) {
      expect(validateShape(p.voxels).valid).toBe(true);
      expect(p.voxels.length).toBe(4);
    }

    const strip = (n: string) => n.replace(/\s*\(\d\)\s*$/, "").trim();
    const counts = new Map<string, number>();
    for (const p of TETRACUBE_BOX_444_PIECES) {
      const b = strip(p.name);
      counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    expect(counts.get("I")).toBe(2);
    expect(counts.get("O")).toBe(2);
    expect(counts.get("T")).toBe(2);
    expect(counts.get("L")).toBe(1);
    expect(counts.get("J")).toBe(1);
    expect(counts.get("S")).toBe(1);
    expect(counts.get("Z")).toBe(1);
    expect(counts.get("T 3D")).toBe(2);
    expect(counts.get("Z 3D")).toBe(2);
    expect(counts.get("S 3D")).toBe(2);
    expect(counts.size).toBe(10);
  });
});
