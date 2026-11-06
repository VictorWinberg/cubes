import type { ShapeDef, Voxel } from "@/types/geometry";
import { canonicalKey, normalize, randomOrientation, shapeKey } from "@/utils/shapeRotation";
import { freeNeighbors } from "./shapeValidator";
import { SHAPES } from "./tetrisShapes";

/** Enumerate every fundamentally different connected arrangement of n cubes. */
export const enumeratePolycubes = (n: number, mirrorIsSame: boolean): Voxel[][] => {
  let level = new Map<string, Voxel[]>([[shapeKey([{ x: 0, y: 0, z: 0 }]), [{ x: 0, y: 0, z: 0 }]]]);
  for (let size = 2; size <= n; size++) {
    const next = new Map<string, Voxel[]>();
    for (const s of level.values())
      for (const nb of freeNeighbors(s)) {
        const grown = normalize([...s, nb]);
        const k = canonicalKey(grown, mirrorIsSame);
        if (!next.has(k)) next.set(k, grown);
      }
    level = next;
  }
  return [...level.values()];
};

const FUNDAMENTAL_NAMES: [string, string][] = [
  ["I", "I"], ["O", "O"], ["T", "T"], ["L", "L / J"], ["S", "S / Z"],
  ["BR", "T 3D"], ["SR", "Z 3D"], ["SL", "S 3D"],
];

/** Name a shape regardless of orientation. */
export const identifyShape = (vs: Voxel[]): string | null => {
  if (vs.length !== 4) return null;
  const k = canonicalKey(vs, false);
  for (const [id, name] of FUNDAMENTAL_NAMES) {
    const def = SHAPES.find((s) => s.id === id)!;
    if (canonicalKey(def.voxels, false) === k) return name;
  }
  return null;
};

/** Fundamental forms as named ShapeDefs: 8 when mirror images differ, 7 when identified. */
export const fundamentalShapes = (mirrorIsSame: boolean): ShapeDef[] =>
  enumeratePolycubes(4, mirrorIsSame).map((voxels, i) => {
    const name = identifyShape(voxels) ?? `Form ${i + 1}`;
    const flat = new Set(voxels.map((v) => v.z)).size === 1 || new Set(voxels.map((v) => v.y)).size === 1 || new Set(voxels.map((v) => v.x)).size === 1;
    return {
      id: `F${i + 1}`,
      name: mirrorIsSame && (name === "Z 3D" || name === "S 3D") ? "S / Z 3D" : name,
      category: flat ? "classic" : "3d",
      voxels,
    };
  });

/** Pick a random catalog shape different from the previous one. */
export const pickRandom = (list: ShapeDef[], prevIndex: number) => {
  if (list.length < 2) return 0;
  let i = prevIndex;
  while (i === prevIndex) i = Math.floor(Math.random() * list.length);
  return i;
};

/** Random-walk growth: always 4 connected cubes in a random orientation. */
export const randomGrowth = (allowMirror: boolean): Voxel[] => {
  const s: Voxel[] = [{ x: 0, y: 0, z: 0 }];
  while (s.length < 4) {
    const opts = freeNeighbors(s);
    s.push(opts[Math.floor(Math.random() * opts.length)]!);
  }
  return randomOrientation(s, allowMirror);
};
