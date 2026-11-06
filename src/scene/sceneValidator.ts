import type { PlacedPiece } from "@/types/geometry";
import { keyOf, validateShape, type Validation } from "@/geometry/shapeValidator";
import { toWorldVoxels } from "./placement";

/**
 * Scene is valid when every piece is a valid 4-cube polycube and no two
 * pieces occupy the same world grid cell.
 */
export const validateScene = (pieces: PlacedPiece[]): Validation => {
  const errors: string[] = [];
  if (pieces.length === 0) {
    return { valid: true, errors: [] };
  }

  for (const p of pieces) {
    const local = validateShape(p.voxels);
    if (!local.valid) {
      errors.push(`${p.name}: ${local.errors.join(" ")}`);
    }
  }

  const seen = new Map<string, string>();
  for (const p of pieces) {
    for (const v of toWorldVoxels(p)) {
      const k = keyOf(v);
      const prev = seen.get(k);
      if (prev) {
        errors.push(`Overlap at (${k}) between “${prev}” and “${p.name}”.`);
      } else {
        seen.set(k, p.name);
      }
    }
  }

  // Dedupe identical overlap messages if any
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
};
