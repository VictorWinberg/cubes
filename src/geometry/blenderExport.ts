import * as THREE from "three";
import type { Axis, HoleSettings, Voxel } from "@/types/geometry";
import { displayOffset } from "./meshBuilder";
import { keyOf } from "./shapeValidator";
import {
  buildTunnelGeometry,
  checkHoles,
  exteriorOpeningSpheresParams,
  holeColumns,
} from "./holeGenerator";

/** One n-gon face (3 = triangle, 4 = quad) as world-space corner positions. */
export type BlenderFace = [number, number, number][];

export type BlenderExportObject = {
  name: string;
  faces: BlenderFace[];
};

const perp = { x: ["y", "z"], y: ["x", "z"], z: ["x", "y"] } as const;

const FACE_CORNERS: [number, number, number][][] = [
  [
    [1, 0, 0],
    [1, 1, 0],
    [1, 1, 1],
    [1, 0, 1],
  ],
  [
    [0, 0, 0],
    [0, 0, 1],
    [0, 1, 1],
    [0, 1, 0],
  ],
  [
    [0, 1, 0],
    [0, 1, 1],
    [1, 1, 1],
    [1, 1, 0],
  ],
  [
    [0, 0, 0],
    [1, 0, 0],
    [1, 0, 1],
    [0, 0, 1],
  ],
  [
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 1],
  ],
  [
    [0, 0, 0],
    [0, 1, 0],
    [1, 1, 0],
    [1, 0, 0],
  ],
];

const FACE_NORMALS: [number, number, number][] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/** External voxel shell as quads only (no bevel, no CSG). */
export const collectExternalQuads = (vs: Voxel[], unit: number): BlenderFace[] => {
  const set = new Set(vs.map(keyOf));
  const o = displayOffset(vs);
  const quads: BlenderFace[] = [];
  for (const v of vs) {
    for (let fi = 0; fi < FACE_NORMALS.length; fi++) {
      const n = FACE_NORMALS[fi]!;
      if (set.has(keyOf({ x: v.x + n[0], y: v.y + n[1], z: v.z + n[2] }))) continue;
      const quad: BlenderFace = FACE_CORNERS[fi]!.map(([a, b, c]) => [
        (v.x + a + o.x) * unit,
        (v.y + b + o.y) * unit,
        (v.z + c + o.z) * unit,
      ]);
      quads.push(quad);
    }
  }
  return quads;
};

const pushBufferGeometryFaces = (g: THREE.BufferGeometry, out: BlenderFace[]) => {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const idx = g.getIndex();
  if (!idx) {
    for (let i = 0; i < pos.count; i += 3) {
      out.push([
        [pos.getX(i), pos.getY(i), pos.getZ(i)],
        [pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1)],
        [pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2)],
      ]);
    }
    return;
  }
  const arr = idx.array;
  for (let i = 0; i < arr.length; i += 3) {
    const a = arr[i]!,
      b = arr[i + 1]!,
      c = arr[i + 2]!;
    out.push([
      [pos.getX(a), pos.getY(a), pos.getZ(a)],
      [pos.getX(b), pos.getY(b), pos.getZ(b)],
      [pos.getX(c), pos.getY(c), pos.getZ(c)],
    ]);
  }
};

/** Cylinders + rim spheres for boolean in Blender (not merged into the body mesh). */
export const collectHoleCutterObjects = (
  vs: Voxel[],
  unit: number,
  h: HoleSettings,
): BlenderExportObject[] => {
  if (!h.enabled || checkHoles(vs, h)) return [];
  const o = displayOffset(vs);
  const voxelSet = new Set(vs.map(keyOf));
  const d = h.size * unit;
  const out: BlenderExportObject[] = [];
  let cutterIdx = 0;

  for (const axis of [...new Set(h.axes)]) {
    for (const col of holeColumns(vs, axis)) {
      const len = (col.max - col.min + 1) * unit + unit * 0.5;
      const g = buildTunnelGeometry(axis, len, d);
      const pos = { x: 0, y: 0, z: 0 };
      pos[axis] = ((col.min + col.max + 1) / 2 + o[axis]) * unit;
      const [u, w] = perp[axis];
      pos[u] = (col.u + 0.5 + o[u]) * unit;
      pos[w] = (col.w + 0.5 + o[w]) * unit;
      g.translate(pos.x, pos.y, pos.z);
      const faces: BlenderFace[] = [];
      pushBufferGeometryFaces(g, faces);
      g.dispose();
      out.push({ name: `Cutter_${String(cutterIdx++).padStart(3, "0")}`, faces });
    }
  }

  if (h.rimSphere) {
    for (const axis of [...new Set(h.axes)]) {
      for (const col of holeColumns(vs, axis)) {
        for (const sp of exteriorOpeningSpheresParams(col, axis as Axis, voxelSet, o, unit, h)) {
          let sg = new THREE.SphereGeometry(sp.radius, 24, 16);
          sg = sg.toNonIndexed();
          sg.translate(sp.cx, sp.cy, sp.cz);
          const faces: BlenderFace[] = [];
          pushBufferGeometryFaces(sg, faces);
          sg.dispose();
          out.push({ name: `Cutter_${String(cutterIdx++).padStart(3, "0")}`, faces });
        }
      }
    }
  }

  return out;
};

const translateFaces = (faces: BlenderFace[], t: [number, number, number]): BlenderFace[] =>
  faces.map((face) => face.map(([x, y, z]) => [x + t[0], y + t[1], z + t[2]] as const));

/** Sharp quad boxes + separate hole cutters for Blender boolean workflow. */
export const buildBlenderExportObjects = (
  voxels: Voxel[],
  unit: number,
  holes: HoleSettings,
  bodyName = "Body",
): BlenderExportObject[] => [
  { name: bodyName, faces: collectExternalQuads(voxels, unit) },
  ...collectHoleCutterObjects(voxels, unit, holes),
];

export const buildSceneBlenderExportObjects = (
  parts: {
    voxels: Voxel[];
    unit: number;
    holes: HoleSettings;
    position: [number, number, number];
    id: string;
  }[],
): BlenderExportObject[] => {
  const out: BlenderExportObject[] = [];
  for (const p of parts) {
    const t = p.position;
    const body = collectExternalQuads(p.voxels, p.unit).map((q) =>
      q.map(([x, y, z]) => [x + t[0], y + t[1], z + t[2]] as [number, number, number]),
    );
    out.push({ name: `Body_${p.id}`, faces: body });
    for (const c of collectHoleCutterObjects(p.voxels, p.unit, p.holes)) {
      out.push({
        name: `${c.name}_${p.id}`,
        faces: translateFaces(c.faces, t),
      });
    }
  }
  return out;
};
