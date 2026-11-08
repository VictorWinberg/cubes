"""
Run inside Blender:

  blender --background --python build_blend.py -- job.json out.blend
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import bpy

FACE_NORMALS = [(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)]
FACE_CORNERS = [
    [(1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)],
    [(0, 0, 0), (0, 0, 1), (0, 1, 1), (0, 1, 0)],
    [(0, 1, 0), (0, 1, 1), (1, 1, 1), (1, 1, 0)],
    [(0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)],
    [(0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)],
    [(0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0)],
]

PERP = {"x": ("y", "z"), "y": ("x", "z"), "z": ("x", "y")}


def key_of(v: dict) -> str:
    return f"{v['x']},{v['y']},{v['z']}"


def display_offset(voxels: list[dict]) -> tuple[float, float, float]:
    if not voxels:
        return (0.0, 0.0, 0.0)

    def bounds(k: str) -> tuple[float, float]:
        vals = [v[k] for v in voxels]
        return min(vals), max(vals) + 1

    x0, x1 = bounds("x")
    y0, _y1 = bounds("y")
    z0, z1 = bounds("z")
    return (-(x0 + x1) / 2, -y0, -(z0 + z1) / 2)


def external_quad_faces(voxels: list[dict], unit: float) -> list[list[tuple[float, float, float]]]:
    voxel_set = {key_of(v) for v in voxels}
    ox, oy, oz = display_offset(voxels)
    quads: list[list[tuple[float, float, float]]] = []

    for v in voxels:
        for ni, n in enumerate(FACE_NORMALS):
            nb = {"x": v["x"] + n[0], "y": v["y"] + n[1], "z": v["z"] + n[2]}
            if key_of(nb) in voxel_set:
                continue
            quad = []
            for a, b, c in FACE_CORNERS[ni]:
                quad.append(
                    (
                        (v["x"] + a + ox) * unit,
                        (v["y"] + b + oy) * unit,
                        (v["z"] + c + oz) * unit,
                    )
                )
            quads.append(quad)
    return quads


def mesh_from_quads(name: str, quads: list[list[tuple[float, float, float]]], offset: tuple[float, float, float]):
    verts: list[tuple[float, float, float]] = []
    faces: list[list[int]] = []
    index: dict[tuple[float, float, float], int] = {}

    def vid(p: tuple[float, float, float]) -> int:
        key = (round(p[0], 6), round(p[1], 6), round(p[2], 6))
        if key not in index:
            index[key] = len(verts)
            verts.append((p[0] + offset[0], p[1] + offset[1], p[2] + offset[2]))
        return index[key]

    for q in quads:
        faces.append([vid(p) for p in q])

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    mesh.validate()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def hole_columns(voxels: list[dict], axis: str):
    u, w = PERP[axis]
    cols: dict[str, dict] = {}
    for v in voxels:
        k = f"{v[u]},{v[w]}"
        c = cols.get(k)
        if c is None:
            c = {"u": v[u], "w": v[w], "min": v[axis], "max": v[axis], "n": 0}
            cols[k] = c
        c["min"] = min(c["min"], v[axis])
        c["max"] = max(c["max"], v[axis])
        c["n"] += 1
    return sorted(cols.values(), key=lambda c: (-c["n"], c["u"], c["w"]))


def align_cylinder_to_axis(obj, axis: str):
    """Blender cylinders are Z-up; Three.js tunnel geo is Y-up (see holeGenerator.alignToAxis)."""
    if axis == "x":
        obj.rotation_euler[1] = 1.5707963267948966  # Z → X
    elif axis == "y":
        obj.rotation_euler[0] = 1.5707963267948966  # Z → Y
    # axis == "z": already along Z


def make_cutter(name: str, axis: str, length: float, diameter: float, center: tuple[float, float, float]):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=48,
        radius=diameter / 2,
        depth=length,
        location=center,
    )
    obj = bpy.context.active_object
    obj.name = name
    align_cylinder_to_axis(obj, axis)
    return obj


def apply_booleans(body: bpy.types.Object, cutters: list[bpy.types.Object]):
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    for cutter in cutters:
        mod = body.modifiers.new(name="Hole", type="BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.object = cutter
        mod.solver = "EXACT"
        with bpy.context.temp_override(object=body):
            bpy.ops.object.modifier_apply(modifier=mod.name)
    for cutter in cutters:
        bpy.data.objects.remove(cutter, do_unlink=True)


def build_piece(piece: dict, unit: float, holes: dict) -> bpy.types.Object:
    quads = external_quad_faces(piece["voxels"], unit)
    pos = piece["position"]
    offset = (float(pos[0]), float(pos[1]), float(pos[2]))
    safe_id = "".join(c if c.isalnum() else "_" for c in piece["id"])[:48]
    body = mesh_from_quads(f"Body_{safe_id}", quads, offset)

    cutters: list[bpy.types.Object] = []
    if holes.get("enabled"):
        ox, oy, oz = display_offset(piece["voxels"])
        d = holes["size"] * unit
        idx = 0
        for axis in sorted(set(holes.get("axes", []))):
            for col in hole_columns(piece["voxels"], axis):
                length = (col["max"] - col["min"] + 1) * unit + unit * 0.5
                u, w = PERP[axis]
                center = [0.0, 0.0, 0.0]
                center[{"x": 0, "y": 1, "z": 2}[axis]] = (
                    (col["min"] + col["max"] + 1) / 2 + [ox, oy, oz][{"x": 0, "y": 1, "z": 2}[axis]]
                ) * unit
                center[{"x": 0, "y": 1, "z": 2}[u]] = (col["u"] + 0.5 + [ox, oy, oz][{"x": 0, "y": 1, "z": 2}[u]]) * unit
                center[{"x": 0, "y": 1, "z": 2}[w]] = (col["w"] + 0.5 + [ox, oy, oz][{"x": 0, "y": 1, "z": 2}[w]]) * unit
                center[0] += offset[0]
                center[1] += offset[1]
                center[2] += offset[2]
                cutters.append(
                    make_cutter(
                        f"Cutter_{idx:03d}_{safe_id}",
                        axis,
                        length,
                        d,
                        tuple(center),
                    )
                )
                idx += 1

    if cutters:
        apply_booleans(body, cutters)

    return body


def main():
    argv = sys.argv
    if "--" not in argv:
        raise SystemExit("Usage: blender --background --python build_blend.py -- job.json out.blend")
    args = argv[argv.index("--") + 1 :]
    if len(args) != 2:
        raise SystemExit("Expected job.json and out.blend paths")

    job_path = Path(args[0])
    out_path = Path(args[1])
    data = json.loads(job_path.read_text(encoding="utf-8"))

    bpy.ops.wm.read_factory_settings(use_empty=True)

    unit = float(data["unit"])
    holes = data["holes"]
    for piece in data["pieces"]:
        build_piece(piece, unit, holes)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out_path))
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
