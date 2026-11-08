import type { BlenderExportObject, BlenderFace } from "@/geometry/blenderExport";

const fmt = (n: number) => {
  const s = n.toFixed(6);
  return s === "-0.000000" ? "0.000000" : s;
};

const vtxKey = ([x, y, z]: [number, number, number]) => `${fmt(x)}/${fmt(y)}/${fmt(z)}`;

/** Wavefront OBJ with quad ngons where possible (no forced triangulation on box faces). */
export const objectsToObj = (objects: BlenderExportObject[]): string => {
  const lines: string[] = ["# Tetracubes — Blender export (quads + cutters)", ""];
  const globalVerts = new Map<string, number>();
  let next = 1;

  const indexFor = (p: [number, number, number]) => {
    const k = vtxKey(p);
    let i = globalVerts.get(k);
    if (i === undefined) {
      i = next++;
      globalVerts.set(k, i);
      lines.push(`v ${fmt(p[0])} ${fmt(p[1])} ${fmt(p[2])}`);
    }
    return i;
  };

  for (const obj of objects) {
    lines.push(`o ${obj.name.replace(/[^\w.-]/g, "_")}`, "");
    for (const face of obj.faces) {
      emitFaceFace(lines, face, indexFor);
    }
    lines.push("");
  }

  return lines.join("\n");
};

const emitFaceFace = (
  lines: string[],
  face: BlenderFace,
  indexFor: (p: [number, number, number]) => number,
) => {
  if (face.length < 3) return;
  const idx = face.map((p) => indexFor(p));
  lines.push(`f ${idx.join(" ")}`);
};

const BLENDER_SCRIPT = `# Tetracubes — builds a .blend from model.obj in the same folder.
# Usage:
#   blender --background --python make_blend.py
# Or in Blender: Scripting workspace → Open → Run Script (set filepath below).

import bpy
from pathlib import Path

THIS_DIR = Path(bpy.path.abspath("//")) if bpy.data.filepath else Path(__file__).resolve().parent
OBJ = THIS_DIR / "model.obj"
OUT = THIS_DIR / "tetracubes.blend"

if not OBJ.is_file():
    raise SystemExit(f"Missing {{OBJ}} — extract the zip next to this script.")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=str(OBJ))

bodies = [o for o in bpy.data.objects if o.type == "MESH" and o.name.startswith("Body")]
cutters = [o for o in bpy.data.objects if o.type == "MESH" and o.name.startswith("Cutter_")]

if not bodies:
    raise SystemExit("No Body object in model.obj")

def cutters_for_body(body_name: str):
    if body_name == "Body":
        return [c for c in cutters if c.name.count("_") == 1]
    if body_name.startswith("Body_"):
        suf = body_name[5:]
        return [c for c in cutters if c.name.endswith("_" + suf)]
    return []

for body in bodies:
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    for cutter in cutters_for_body(body.name):
        mod = body.modifiers.new(name="Hole", type="BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.object = cutter
        mod.solver = "EXACT"
        with bpy.context.temp_override(object=body):
            bpy.ops.object.modifier_apply(modifier=mod.name)
        cutter.hide_viewport = True
        cutter.hide_render = True

for c in cutters:
    bpy.data.objects.remove(c, do_unlink=True)

bpy.ops.wm.save_as_mainfile(filepath=str(OUT))
print(f"Saved {{OUT}}")
`;

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

const crc32 = (data: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = crcTable[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const zipStore = (files: { name: string; data: Uint8Array }[]): Blob => {
  const chunks: Uint8Array[] = [];
  const enc = new TextEncoder();
  let offset = 0;
  const central: Uint8Array[] = [];

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + nameBytes.length + file.data.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, file.data.length, true);
    view.setUint32(22, file.data.length, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(file.data, 30 + nameBytes.length);
    chunks.push(local);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, file.data.length, true);
    cv.setUint32(24, file.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += local.length;
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const centralStart = offset;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralStart, true);
  ev.setUint16(20, 0, true);

  const total = new Uint8Array(
    chunks.reduce((s, c) => s + c.length, 0) + centralSize + eocd.length,
  );
  let p = 0;
  for (const c of chunks) {
    total.set(c, p);
    p += c.length;
  }
  for (const c of central) {
    total.set(c, p);
    p += c.length;
  }
  total.set(eocd, p);
  return new Blob([total], { type: "application/zip" });
};

const readme = `Tetracubes → Blender
====================

What's in here
--------------
- model.obj   — sharp polycube shell as quads (no STL-style face diagonals)
- Cutter_*    — drill volumes; the script boolean-subtracts these from Body
- make_blend.py — run once in Blender to get tetracubes.blend

Why not a .blend download from the browser?
Blender's .blend format isn't something we can write reliably in the browser (only parsers exist).
This zip is the practical path: quad OBJ + one script → native .blend.

Quick start
-----------
1. Unzip this folder.
2. Terminal:  blender --background --python make_blend.py
3. Open tetracubes.blend in Blender.

Or: Blender → Scripting → Open make_blend.py → Run Script (same folder as model.obj).

Import OBJ only (no script)
---------------------------
File → Import → Wavefront (.obj). Body is all quads. Apply booleans manually with Cutter_* meshes.
`;

export const buildBlenderZipBlob = (objects: BlenderExportObject[]): Blob => {
  const enc = new TextEncoder();
  return zipStore([
    { name: "model.obj", data: enc.encode(objectsToObj(objects)) },
    { name: "make_blend.py", data: enc.encode(BLENDER_SCRIPT) },
    { name: "README.txt", data: enc.encode(readme) },
  ]);
};
