import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Viewport, type ViewportPiece } from "@/components/Viewport";
import { Btn, ColorField, Range, Section, Segmented, Toggle } from "@/components/ui-bits";
import { cloneTetracubeBox444Pieces } from "@/geometry/tetracubeBox444";
import { SHAPES } from "@/geometry/tetrisShapes";
import { identifyShape, pickRandom, randomGrowth } from "@/geometry/tetrocubeGenerator";
import { validateShape } from "@/geometry/shapeValidator";
import { displayOffset } from "@/geometry/meshBuilder";
import { buildPieceGeometry } from "@/geometry/pieceMesh";
import { checkHoles } from "@/geometry/holeGenerator";
import {
  mirrorShape,
  normalize,
  randomOrientation,
  rotateShape,
  rotateShapeCCW,
} from "@/utils/shapeRotation";
import { exportGLB, exportSTL, mergeTranslatedGeometries } from "@/utils/exporters";
import {
  addOffsets,
  allWorldVoxels,
  dropToRestingOffset,
  findSpawnOffsetTop,
  nextPieceId,
  offsetDelta,
  pieceGroupPosition,
  violatesFloor,
  violatesGridBox444,
  wouldOverlap,
} from "@/scene/placement";
import { validateScene } from "@/scene/sceneValidator";
import type {
  Appearance,
  AppMode,
  Axis,
  HoleSettings,
  MaterialKind,
  PlacedPiece,
  Voxel,
} from "@/types/geometry";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Cubes — 3D four-cube shape generator" },
      {
        name: "description",
        content: "Generate, rotate, edit, drill and stack 3D shapes made of four connected cubes.",
      },
      { property: "og:title", content: "Cubes — 3D four-cube shape generator" },
      {
        property: "og:description",
        content: "Tetris pieces, expanded into three dimensions. Stack, export GLB and STL.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});

const VIEW_COLORS = {
  selection: "#ff6a2b",
  ghost: "#ff6a2b",
  grid: "#c9c6bf",
  gridStrong: "#9f9b92",
};

const PIECE_COLORS = ["#e8622c", "#2c7be8", "#2cb67d", "#c44dff", "#e8b92c", "#e82c6a", "#1d1b18"];

const defaultLabLook = (): Appearance => ({
  unit: 1,
  color: "#e8622c",
  edgeColor: "#1d1b18",
  edges: true,
  bevel: true,
  bevelRadius: 0.1,
  bevelSegments: 5,
  material: "satin",
  light: 1,
  wireframe: false,
  grid: true,
});

const defaultLabHoles = (): HoleSettings => ({
  enabled: true,
  size: 0.5,
  rimSphere: true,
  rimRadius: 0.5,
  rimOffset: 0.37,
  axes: ["x", "y", "z"],
});

/** Stack scene: sharp cubes, no drill (lab can still use bevel + holes). */
const sceneLookFrom = (prev: Appearance): Appearance => ({ ...prev, bevel: false });
const sceneHolesFrom = (prev: HoleSettings): HoleSettings => ({ ...prev, enabled: false });

function App() {
  const list = SHAPES;
  const [mode, setMode] = useState<AppMode>("lab");
  const [index, setIndex] = useState(0);
  const [voxels, setVoxels] = useState<Voxel[]>(SHAPES[0]!.voxels);
  const [frame, setFrame] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [pieces, setPieces] = useState<PlacedPiece[]>([]);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [look, setLook] = useState<Appearance>(defaultLabLook);
  const [holes, setHoles] = useState<HoleSettings>(defaultLabHoles);

  const labLookSnap = useRef<Appearance | null>(null);
  const labHolesSnap = useRef<HoleSettings | null>(null);
  const sceneLookSnap = useRef<Appearance | null>(null);
  const sceneHolesSnap = useRef<HoleSettings | null>(null);
  /** Fresh id for scene keyboard (rotate / move) without stale closures. */
  const selectedPieceIdRef = useRef<string | null>(null);
  /** Enter: random shape + orientation (same as Add random). */
  const addRandomToSceneRef = useRef<() => void>(() => {});

  useEffect(() => {
    selectedPieceIdRef.current = selectedPieceId;
  }, [selectedPieceId]);

  const applySceneLookFromLab = () => {
    labLookSnap.current = look;
    labHolesSnap.current = holes;
    if (sceneLookSnap.current && sceneHolesSnap.current) {
      setLook(sceneLookSnap.current);
      setHoles(sceneHolesSnap.current);
    } else {
      setLook((s) => {
        const nl = sceneLookFrom(s);
        sceneLookSnap.current = nl;
        return nl;
      });
      setHoles((h) => {
        const nh = sceneHolesFrom(h);
        sceneHolesSnap.current = nh;
        return nh;
      });
    }
  };

  const switchMode = (next: AppMode) => {
    if (mode === next) return;
    const leavingSceneLike = mode === "scene" || mode === "solver";
    const enteringSceneLike = next === "scene" || next === "solver";

    if (mode === "lab" && enteringSceneLike) {
      applySceneLookFromLab();
    } else if (leavingSceneLike && next === "lab") {
      sceneLookSnap.current = look;
      sceneHolesSnap.current = holes;
      setLook(labLookSnap.current ?? defaultLabLook());
      setHoles(labHolesSnap.current ?? defaultLabHoles());
    }

    if (next === "solver") {
      setPieces(cloneTetracubeBox444Pieces());
      setSelectedPieceId(null);
    } else if (mode === "solver") {
      setPieces([]);
      setSelectedPieceId(null);
    }

    setMode(next);
  };

  const L = <K extends keyof Appearance>(k: K, v: Appearance[K]) =>
    setLook((s) => {
      const next = { ...s, [k]: v };
      if (mode === "lab") labLookSnap.current = next;
      else sceneLookSnap.current = next;
      return next;
    });
  const H = <K extends keyof HoleSettings>(k: K, v: HoleSettings[K]) =>
    setHoles((h) => {
      const next = { ...h, [k]: v };
      if (mode === "lab") labHolesSnap.current = next;
      else sceneHolesSnap.current = next;
      return next;
    });

  const load = (vs: Voxel[], i = index, reframe = true) => {
    setVoxels(normalize(vs));
    setIndex(i);
    setSelected(null);
    if (reframe) setFrame((f) => f + 1);
  };
  const pick = (i: number) => {
    const n = (i + list.length) % list.length;
    load(randomOrientation(list[n]!.voxels, true), n);
  };

  const validation = validateShape(voxels);
  const name = identifyShape(voxels);
  const holeError = validation.valid ? checkHoles(voxels, holes) : null;
  const sceneValidation = validateScene(pieces);
  const selectedPiece = pieces.find((p) => p.id === selectedPieceId) ?? null;

  const labGeometry = useMemo(
    () => buildPieceGeometry(voxels, look, holes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [voxels, look.unit, look.bevel, look.bevelRadius, look.bevelSegments, holes, validation.valid],
  );

  const sceneGeometries = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildPieceGeometry>>();
    if (mode !== "scene" && mode !== "solver") return map;
    for (const p of pieces) {
      map.set(p.id, buildPieceGeometry(p.voxels, look, holes));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pieces, look.unit, look.bevel, look.bevelRadius, look.bevelSegments, holes]);

  const worldVoxels = useMemo(
    () => (mode === "scene" || mode === "solver" ? allWorldVoxels(pieces) : voxels),
    [mode, pieces, voxels],
  );

  /** World grid y=0 plane in Three.js units (top of floor voxels), for a visible slab in stack scene. */
  const floorPlaneY = useMemo(() => {
    if (mode !== "scene") return undefined;
    if (worldVoxels.length === 0) return 0;
    return -displayOffset(worldVoxels).y * look.unit;
  }, [mode, worldVoxels, look.unit]);

  const viewportPieces: ViewportPiece[] = useMemo(() => {
    if (mode === "lab") {
      return [
        {
          id: "lab",
          voxels,
          geometry: labGeometry,
          color: look.color,
          position: [0, 0, 0],
        },
      ];
    }
    if (mode === "solver") {
      const sceneOff = displayOffset(worldVoxels);
      return pieces.map((p) => {
        const localOff = displayOffset(p.voxels);
        return {
          id: p.id,
          voxels: p.voxels,
          geometry: sceneGeometries.get(p.id) ?? labGeometry,
          color: p.color ?? look.color,
          position: pieceGroupPosition(p, sceneOff, localOff, look.unit),
          selected: p.id === selectedPieceId,
        };
      });
    }
    const sceneOff = displayOffset(worldVoxels);
    return pieces.map((p) => {
      const localOff = displayOffset(p.voxels);
      return {
        id: p.id,
        voxels: p.voxels,
        geometry: sceneGeometries.get(p.id) ?? labGeometry,
        color: p.color ?? look.color,
        position: pieceGroupPosition(p, sceneOff, localOff, look.unit),
        selected: p.id === selectedPieceId,
      };
    });
  }, [
    mode,
    voxels,
    labGeometry,
    look.color,
    look.unit,
    pieces,
    worldVoxels,
    sceneGeometries,
    selectedPieceId,
  ]);

  const addCurrentToScene = () => {
    if (!validation.valid) return;
    const local = normalize(voxels);
    const id = nextPieceId();
    setPieces((ps) => {
      const offset = findSpawnOffsetTop(local, ps);
      const piece: PlacedPiece = {
        id,
        name: name ?? "Custom",
        voxels: local,
        offset,
        color: PIECE_COLORS[ps.length % PIECE_COLORS.length]!,
      };
      return [...ps, piece];
    });
    setSelectedPieceId(id);
    switchMode("scene");
    setEditMode(false);
    setFrame((f) => f + 1);
  };

  const addRandomToScene = () => {
    const i = pickRandom(list, index);
    const local = normalize(randomOrientation(list[i]!.voxels, true));
    const id = nextPieceId();
    setIndex(i);
    setPieces((ps) => {
      const offset = findSpawnOffsetTop(local, ps);
      const piece: PlacedPiece = {
        id,
        name: list[i]!.name,
        voxels: local,
        offset,
        color: PIECE_COLORS[ps.length % PIECE_COLORS.length]!,
      };
      return [...ps, piece];
    });
    setSelectedPieceId(id);
    switchMode("scene");
    setEditMode(false);
    setFrame((f) => f + 1);
  };

  addRandomToSceneRef.current = addRandomToScene;

  /**
   * New random piece spawns above the stack (same as Add random).
   * If a piece is selected: replaces it (keeps its color). If none selected: appends another piece at the top.
   */
  const nextRandomPieceInScene = useCallback(() => {
    const i = pickRandom(list, index);
    const local = normalize(randomOrientation(list[i]!.voxels, true));
    const id = nextPieceId();
    setIndex(i);
    setPieces((ps) => {
      const sel = selectedPieceId ? ps.find((p) => p.id === selectedPieceId) : undefined;
      const rest = selectedPieceId ? ps.filter((p) => p.id !== selectedPieceId) : ps;
      const offset = findSpawnOffsetTop(local, rest);
      const piece: PlacedPiece = {
        id,
        name: list[i]!.name,
        voxels: local,
        offset,
        color: sel?.color ?? PIECE_COLORS[rest.length % PIECE_COLORS.length]!,
      };
      return [...rest, piece];
    });
    setSelectedPieceId(id);
    setFrame((f) => f + 1);
  }, [list, index, selectedPieceId]);

  const moveSelected = (axis: Axis, dir: 1 | -1) => {
    if (!selectedPiece) return;
    const nextOffset = addOffsets(selectedPiece.offset, offsetDelta(axis, dir));
    const others = pieces.filter((p) => p.id !== selectedPiece.id);
    const candidate = { voxels: selectedPiece.voxels, offset: nextOffset };
    if (mode === "solver" && violatesGridBox444(candidate)) return;
    if (violatesFloor(candidate)) return;
    if (wouldOverlap(candidate, others)) return;
    setPieces((ps) =>
      ps.map((p) => (p.id === selectedPiece.id ? { ...p, offset: nextOffset } : p)),
    );
  };

  const rotateSelectedPieceAxis = (axis: Axis, direction: 1 | -1 = 1) => {
    const id = selectedPieceIdRef.current;
    if (!id) return;
    setPieces((ps) => {
      const cur = ps.find((p) => p.id === id);
      if (!cur) return ps;
      const rotated =
        direction === 1 ? rotateShape(cur.voxels, axis) : rotateShapeCCW(cur.voxels, axis);
      const others = ps.filter((p) => p.id !== id);
      const candidate = { voxels: rotated, offset: cur.offset };
      if (mode === "solver" && violatesGridBox444(candidate)) return ps;
      if (violatesFloor(candidate)) return ps;
      if (wouldOverlap(candidate, others)) return ps;
      return ps.map((p) => (p.id === id ? { ...p, voxels: rotated } : p));
    });
  };

  const mirrorSelectedPiece = () => {
    const id = selectedPieceIdRef.current;
    if (!id) return;
    setPieces((ps) => {
      const cur = ps.find((p) => p.id === id);
      if (!cur) return ps;
      const mirrored = normalize(mirrorShape(cur.voxels));
      const others = ps.filter((p) => p.id !== id);
      const candidate = { voxels: mirrored, offset: cur.offset };
      if (mode === "solver" && violatesGridBox444(candidate)) return ps;
      if (violatesFloor(candidate)) return ps;
      if (wouldOverlap(candidate, others)) return ps;
      return ps.map((p) => (p.id === id ? { ...p, voxels: mirrored } : p));
    });
  };

  const rotateSelectedOrLab = (axis: Axis) => {
    if ((mode === "scene" || mode === "solver") && selectedPiece) {
      rotateSelectedPieceAxis(axis);
      return;
    }
    load(rotateShape(voxels, axis), index, false);
  };

  const mirrorSelectedOrLab = () => {
    if ((mode === "scene" || mode === "solver") && selectedPiece) {
      mirrorSelectedPiece();
      return;
    }
    load(mirrorShape(voxels), index, false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Enter" && !e.repeat && mode === "scene") {
        e.preventDefault();
        addRandomToSceneRef.current();
        return;
      }
      if (mode !== "scene" && mode !== "solver") return;
      if (e.key === " " && !e.repeat) {
        const id = selectedPieceIdRef.current;
        if (!id) return;
        e.preventDefault();
        setPieces((ps) => {
          const cur = ps.find((p) => p.id === id);
          if (!cur) return ps;
          const others = ps.filter((p) => p.id !== cur.id);
          const nextOffset = dropToRestingOffset(cur, others);
          const { offset: o } = cur;
          if (nextOffset.x === o.x && nextOffset.y === o.y && nextOffset.z === o.z) return ps;
          const dropped = { ...cur, offset: nextOffset };
          if (mode === "solver" && violatesGridBox444(dropped)) return ps;
          return ps.map((p) => (p.id === cur.id ? { ...p, offset: nextOffset } : p));
        });
        return;
      }
      if (e.key === "n" || e.key === "N") {
        if (mode === "solver") return;
        e.preventDefault();
        nextRandomPieceInScene();
        return;
      }
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const axisByDigit: Record<string, Axis> = { "1": "x", "2": "y", "3": "z" };
      const rotAxis: Axis | null =
        axisByDigit[k] ?? (k === "x" || k === "y" || k === "z" ? (k as Axis) : null);
      if (rotAxis) {
        if (!selectedPieceIdRef.current) return;
        e.preventDefault();
        rotateSelectedPieceAxis(rotAxis);
        return;
      }
      if (k === "f") {
        if (!selectedPieceIdRef.current) return;
        e.preventDefault();
        mirrorSelectedPiece();
        return;
      }
      const id = selectedPieceIdRef.current;
      if (!id) return;
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const dirY = e.key === "ArrowUp" ? (1 as const) : (-1 as const);
        setPieces((ps) => {
          const cur = ps.find((p) => p.id === id);
          if (!cur) return ps;
          const nextOffset = addOffsets(cur.offset, offsetDelta("y", dirY));
          const others = ps.filter((p) => p.id !== cur.id);
          const candidate = { voxels: cur.voxels, offset: nextOffset };
          if (mode === "solver" && violatesGridBox444(candidate)) return ps;
          if (violatesFloor(candidate)) return ps;
          if (wouldOverlap(candidate, others)) return ps;
          return ps.map((p) => (p.id === cur.id ? { ...p, offset: nextOffset } : p));
        });
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        rotateSelectedPieceAxis("y", -1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        rotateSelectedPieceAxis("y");
        return;
      }
      const wasd: Record<string, [Axis, 1 | -1]> = {
        w: ["z", -1],
        s: ["z", 1],
        a: ["x", -1],
        d: ["x", 1],
      };
      const step = wasd[k];
      if (!step) return;
      e.preventDefault();
      const [axis, dir] = step;
      setPieces((ps) => {
        const cur = ps.find((p) => p.id === id);
        if (!cur) return ps;
        const nextOffset = addOffsets(cur.offset, offsetDelta(axis, dir));
        const others = ps.filter((p) => p.id !== cur.id);
        const candidate = { voxels: cur.voxels, offset: nextOffset };
        if (mode === "solver" && violatesGridBox444(candidate)) return ps;
        if (violatesFloor(candidate)) return ps;
        if (wouldOverlap(candidate, others)) return ps;
        return ps.map((p) => (p.id === cur.id ? { ...p, offset: nextOffset } : p));
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, nextRandomPieceInScene]);

  const fileName = `tetrocube-${(name ?? "custom").split(" ")[0]!.replace(/\W/g, "").toLowerCase()}`;
  const mat = { matte: [0, 0.95], satin: [0.05, 0.5], plastic: [0, 0.25], metal: [0.9, 0.3] }[
    look.material
  ];
  const is3D = ["x", "y", "z"].every((k) => new Set(voxels.map((v) => v[k as Axis])).size > 1);

  const canExport =
    mode === "lab" ? validation.valid : pieces.length > 0 && sceneValidation.valid;

  const doExportGLB = () => {
    if (mode === "lab") {
      void exportGLB(labGeometry, look.color, fileName, mat[0], mat[1]);
      return;
    }
    const merged = mergeTranslatedGeometries(
      viewportPieces.map((p) => ({ geometry: p.geometry, position: p.position })),
    );
    if (!merged) return;
    void exportGLB(
      merged,
      look.color,
      mode === "solver" ? "4x4x4-tetracubes" : `scene-${pieces.length}pieces`,
      mat[0],
      mat[1],
    );
    merged.dispose();
  };

  const doExportSTL = () => {
    if (mode === "lab") {
      exportSTL(labGeometry, fileName);
      return;
    }
    const merged = mergeTranslatedGeometries(
      viewportPieces.map((p) => ({ geometry: p.geometry, position: p.position })),
    );
    if (!merged) return;
    exportSTL(merged, mode === "solver" ? "4x4x4-tetracubes" : `scene-${pieces.length}pieces`);
    merged.dispose();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground lg:h-screen lg:flex-row lg:overflow-hidden">
      <aside className="order-2 w-full shrink-0 border-border bg-card lg:order-1 lg:w-80 lg:overflow-y-auto lg:border-r">
        <header className="hidden border-b border-border px-4 py-4 lg:block">
          <Logo mode={mode} />
        </header>

        <Section title="Mode">
          <Segmented<AppMode>
            value={mode}
            onChange={(v) => {
              switchMode(v);
              setEditMode(false);
              setSelected(null);
              setFrame((f) => f + 1);
            }}
            options={[
              { v: "lab", l: "Shape lab" },
              { v: "scene", l: "Stack scene" },
              { v: "solver", l: "4³ solver" },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            {mode === "lab"
              ? "Design a single 4-cube piece, then add it to the stack."
              : mode === "solver"
                ? "Reference packing for a 4×4×4: two each of I, O, T, Z 3D, S 3D, T 3D; one each of L, J, S, Z. Move and rotate pieces inside the box (no N/Enter)."
                : "WASD = XZ, Space = drop. Arrows = ↑↓ move Y, ←→ rotate Y. 1/2/3 or X/Y/Z rotate, F flip, N next, Enter = new piece. Floor y ≥ 0."}
          </p>
        </Section>

        {(mode === "scene" || mode === "solver") && (
          <Section title={`Scene · ${pieces.length} piece${pieces.length === 1 ? "" : "s"}`}>
            {mode === "scene" && (
            <div className="grid grid-cols-2 gap-2">
              <Btn
                variant="primary"
                disabled={!validation.valid}
                onClick={addCurrentToScene}
                title="Drop the current lab shape from above the stack"
              >
                Add current
              </Btn>
              <Btn
                onClick={addRandomToScene}
                title="Random catalog shape and orientation from above (Enter)"
              >
                Add random
              </Btn>
              <Btn
                variant="outline"
                className="col-span-2"
                onClick={nextRandomPieceInScene}
                title="Random piece at the top; replaces selected piece if any"
              >
                Next piece (N)
              </Btn>
              <Btn
                variant="outline"
                disabled={!selectedPiece}
                onClick={() => {
                  if (!selectedPiece) return;
                  setPieces((ps) => ps.filter((p) => p.id !== selectedPiece.id));
                  setSelectedPieceId(null);
                }}
              >
                Remove selected
              </Btn>
              <Btn
                variant="outline"
                disabled={pieces.length === 0}
                onClick={() => {
                  setPieces([]);
                  setSelectedPieceId(null);
                  setFrame((f) => f + 1);
                }}
              >
                Clear scene
              </Btn>
            </div>
            )}
            {mode === "solver" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Same multiset as the classic polycube puzzle: <span className="font-mono">2×</span> I, O, T, Z&nbsp;3D,
                  S&nbsp;3D, T&nbsp;3D and <span className="font-mono">1×</span> L, J, S, Z — 16 pieces, 64 cells.
                </p>
                <Btn
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setPieces(cloneTetracubeBox444Pieces());
                    setSelectedPieceId(null);
                    setFrame((f) => f + 1);
                  }}
                >
                  Reset to reference solution
                </Btn>
              </div>
            )}
            {pieces.length > 0 && (
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {pieces.map((p, i) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedPieceId(p.id)}
                      className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                        p.id === selectedPieceId
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-accent"
                      }`}
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-sm"
                        style={{ background: p.color ?? look.color }}
                      />
                      <span className="truncate font-semibold">
                        {i + 1}. {p.name}
                      </span>
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                        {p.offset.x},{p.offset.y},{p.offset.z}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Move (WASD) · rotate (arrows / 1–3)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex gap-1">
                  <Btn
                    variant="outline"
                    className="flex-1 px-1"
                    disabled={!selectedPiece}
                    onClick={() => moveSelected("x", -1)}
                  >
                    −X
                  </Btn>
                  <Btn
                    variant="outline"
                    className="flex-1 px-1"
                    disabled={!selectedPiece}
                    onClick={() => moveSelected("x", 1)}
                  >
                    +X
                  </Btn>
                </div>
                <div className="flex gap-1">
                  <Btn
                    variant="outline"
                    className="flex-1 px-1"
                    disabled={!selectedPiece}
                    onClick={() => moveSelected("z", -1)}
                  >
                    −Z
                  </Btn>
                  <Btn
                    variant="outline"
                    className="flex-1 px-1"
                    disabled={!selectedPiece}
                    onClick={() => moveSelected("z", 1)}
                  >
                    +Z
                  </Btn>
                </div>
                <div className="col-span-2 flex gap-1">
                  <Btn
                    variant="outline"
                    className="flex-1 px-1"
                    disabled={!selectedPiece}
                    onClick={() => moveSelected("y", -1)}
                  >
                    −Y
                  </Btn>
                  <Btn
                    variant="outline"
                    className="flex-1 px-1"
                    disabled={!selectedPiece}
                    onClick={() => moveSelected("y", 1)}
                  >
                    +Y
                  </Btn>
                </div>
              </div>
            </div>
            {!sceneValidation.valid && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {sceneValidation.errors[0]}
              </p>
            )}
          </Section>
        )}

        <Section title="Generate">
          <Btn
            variant="primary"
            className="h-11 w-full text-base"
            onClick={() => pick(pickRandom(list, index))}
          >
            Generate Random Shape
          </Btn>
          <div className="grid grid-cols-2 gap-2">
            <Btn onClick={() => pick(index - 1)}>← Previous</Btn>
            <Btn onClick={() => pick(index + 1)}>Next →</Btn>
            <Btn
              onClick={() => load(randomGrowth(true), index)}
              title="Grow 4 connected cubes at random"
            >
              Randomize
            </Btn>
            <Btn onClick={() => load(list[index % list.length]!.voxels, index)}>Reset Shape</Btn>
          </div>
        </Section>

        <Section title={`Shapes · ${list.length}`}>
          <div className="grid grid-cols-4 gap-1.5">
            {list.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(i)}
                title={s.name}
                className={`h-10 truncate rounded-md border px-1 text-xs font-semibold transition-colors ${i === index ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}
              >
                {s.name.split(" ")[0]}
                <span className="block text-[9px] font-normal text-muted-foreground">
                  {s.category === "3d" ? "3D" : "flat"}
                </span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Rotate & mirror">
          <div className="grid grid-cols-4 gap-2">
            {(["x", "y", "z"] as Axis[]).map((a) => (
              <Btn key={a} variant="outline" onClick={() => rotateSelectedOrLab(a)}>
                ⟳ {a.toUpperCase()}
              </Btn>
            ))}
            <Btn variant="outline" onClick={mirrorSelectedOrLab}>
              Mirror
            </Btn>
          </div>
          {(mode === "scene" || mode === "solver") && (
            <p className="text-xs text-muted-foreground">
              Selected piece: 1/2/3 or X/Y/Z rotate, F flip. Arrows: ↑↓ Y move, ←→ Y rotate.
            </p>
          )}
        </Section>

        {mode === "lab" && (
          <Section title="Edit cubes">
            <Toggle
              label="Edit mode"
              checked={editMode}
              onChange={(v) => {
                setEditMode(v);
                setSelected(null);
              }}
            />
            {editMode && (
              <p className="text-xs text-muted-foreground">
                Tap a cube to select it. Tap a faint ghost cube to add one in that free spot.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Btn
                variant="outline"
                disabled={selected === null}
                onClick={() => {
                  setVoxels(voxels.filter((_, i) => i !== selected));
                  setSelected(null);
                }}
              >
                Remove selected
              </Btn>
              <Btn variant="outline" onClick={() => load(list[index % list.length]!.voxels, index)}>
                Reset to valid
              </Btn>
            </div>
          </Section>
        )}

        <Section title="Holes">
          <Toggle label="Drill holes" checked={holes.enabled} onChange={(v) => H("enabled", v)} />
          {holes.enabled && (
            <>
              <div className="text-sm">
                <div className="mb-1.5 flex justify-between">
                  <span>Directions</span>
                  <span className="font-mono text-xs text-muted-foreground">multi-select</span>
                </div>
                <div className="flex gap-2">
                  {(["x", "y", "z"] as Axis[]).map((a) => {
                    const on = holes.axes.includes(a);
                    return (
                      <Btn
                        key={a}
                        variant="outline"
                        className="flex-1"
                        active={on}
                        onClick={() => {
                          setHoles((s) => {
                            const next = on ? s.axes.filter((x) => x !== a) : [...s.axes, a];
                            if (next.length === 0) return s;
                            return { ...s, axes: next };
                          });
                        }}
                      >
                        {a.toUpperCase()}
                      </Btn>
                    );
                  })}
                </div>
              </div>
              <Range
                label="Size"
                value={holes.size}
                min={0.1}
                max={0.95}
                step={0.05}
                onChange={(v) => H("size", v)}
                fmt={(v) => `${Math.round(v * 100)}% of cube`}
              />
              <Toggle
                label="Rim sphere"
                checked={holes.rimSphere}
                onChange={(v) => H("rimSphere", v)}
              />
              {holes.rimSphere && (
                <>
                  <Range
                    label="Rim sphere radius"
                    value={holes.rimRadius}
                    min={0}
                    max={0.5}
                    step={0.01}
                    onChange={(v) => H("rimRadius", v)}
                    fmt={(v) => `${Math.round(v * 100)}% of cube edge`}
                  />
                  <Range
                    label="Rim sphere offset"
                    value={holes.rimOffset}
                    min={-0.15}
                    max={0.5}
                    step={0.01}
                    onChange={(v) => H("rimOffset", v)}
                    fmt={(v) =>
                      v === 0
                        ? "Face center"
                        : v > 0
                          ? `+${Math.round(v * 100)}% outward`
                          : `${Math.round(v * 100)}% inward`
                    }
                  />
                </>
              )}
              {holeError && mode === "lab" && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {holeError}
                </p>
              )}
            </>
          )}
        </Section>

        <Section title="Appearance">
          <Range
            label="Unit cube size"
            value={look.unit}
            min={0.5}
            max={3}
            step={0.1}
            onChange={(v) => L("unit", v)}
            fmt={(v) => `${v.toFixed(1)} units`}
          />
          <ColorField
            label={mode === "scene" || mode === "solver" ? "Default / export color" : "Shape color"}
            value={look.color}
            onChange={(v) => L("color", v)}
          />
          <ColorField
            label="Cube edge color"
            value={look.edgeColor}
            onChange={(v) => L("edgeColor", v)}
          />
          <Toggle label="Show cube edges" checked={look.edges} onChange={(v) => L("edges", v)} />
          <Toggle label="Bevel edges" checked={look.bevel} onChange={(v) => L("bevel", v)} />
          {look.bevel && (
            <>
              <Range
                label="Bevel segments"
                value={look.bevelSegments}
                min={1}
                max={10}
                step={1}
                onChange={(v) => L("bevelSegments", v)}
                fmt={(v) => `${Math.round(v)} (smoothness)`}
              />
              <Range
                label="Bevel radius"
                value={look.bevelRadius}
                min={0.03}
                max={0.4}
                step={0.01}
                onChange={(v) => L("bevelRadius", v)}
                fmt={(v) => `${Math.round(v * 100)}% of cube`}
              />
            </>
          )}
          <Segmented<MaterialKind>
            value={look.material}
            onChange={(v) => L("material", v)}
            options={[
              { v: "matte", l: "Matte" },
              { v: "satin", l: "Satin" },
              { v: "plastic", l: "Gloss" },
              { v: "metal", l: "Metal" },
            ]}
          />
          <Range
            label="Lighting"
            value={look.light}
            min={0.2}
            max={2.5}
            step={0.1}
            onChange={(v) => L("light", v)}
            fmt={(v) => `${v.toFixed(1)}×`}
          />
        </Section>
      </aside>

      <main className="order-1 flex min-w-0 flex-1 flex-col lg:order-2">
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
          <Logo mode={mode} />
        </div>
        <div className="viewport-bg relative h-[58vh] lg:h-auto lg:flex-1">
          <Viewport
            frameVoxels={worldVoxels}
            floorPlaneY={floorPlaneY}
            pieces={viewportPieces}
            look={look}
            frameKey={`${frame}-${mode}-${pieces.length}`}
            editMode={mode === "lab" && editMode}
            selectedVoxel={selected}
            onSelectVoxel={setSelected}
            onAddVoxel={(v) => setVoxels([...voxels, v])}
            {...(mode === "scene" || mode === "solver" ? { onSelectPiece: setSelectedPieceId } : {})}
            colors={VIEW_COLORS}
          />
          <div className="pointer-events-none absolute left-3 top-3 space-y-1.5">
            <div className="rounded-md bg-card/90 px-3 py-2 shadow-sm backdrop-blur">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {mode === "scene" ? "Scene" : mode === "solver" ? "4³ solver" : "Shape"}
              </div>
              <div className="text-lg font-semibold leading-tight">
                {mode === "scene" || mode === "solver"
                  ? selectedPiece
                    ? selectedPiece.name
                    : pieces.length
                      ? `${pieces.length} pieces`
                      : "Empty"
                  : (name ?? "Custom")}
                {mode === "lab" && is3D && validation.valid && (
                  <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 align-middle text-[10px] font-bold text-primary">
                    3D
                  </span>
                )}
              </div>
            </div>
            <div
              className={`rounded-md px-3 py-1.5 text-xs font-medium shadow-sm ${
                (mode === "lab" ? validation.valid : sceneValidation.valid)
                  ? "bg-success/15 text-success"
                  : "bg-destructive/15 text-destructive"
              }`}
            >
              {mode === "lab"
                ? validation.valid
                  ? "✓ Valid — 4 connected cubes"
                  : validation.errors.join(" ")
                : pieces.length === 0
                  ? mode === "solver"
                    ? "Loading…"
                    : "Add pieces to start stacking"
                  : sceneValidation.valid
                    ? mode === "solver"
                      ? "✓ 16 pieces fill 4×4×4 — no overlaps"
                      : `✓ ${pieces.length} piece${pieces.length === 1 ? "" : "s"} — no overlaps`
                    : sceneValidation.errors[0]}
            </div>
          </div>
        </div>
        <footer className="flex flex-wrap items-center gap-2 border-t border-border bg-card px-3 py-2.5">
          <span className="font-mono text-xs text-muted-foreground">
            {mode === "lab" ? (
              <>
                Cubes{" "}
                <b className={voxels.length === 4 ? "text-foreground" : "text-destructive"}>
                  {voxels.length}/4
                </b>{" "}
                · {name ?? "custom"}
              </>
            ) : mode === "solver" ? (
              <>
                Box <b className="text-foreground">4×4×4</b>
                {" · "}
                Pieces <b className="text-foreground">{pieces.length}</b>
                {selectedPiece && (
                  <>
                    {" "}
                    · sel {selectedPiece.offset.x},{selectedPiece.offset.y},{selectedPiece.offset.z}
                  </>
                )}
              </>
            ) : (
              <>
                Pieces <b className="text-foreground">{pieces.length}</b>
                {selectedPiece && (
                  <>
                    {" "}
                    · sel {selectedPiece.offset.x},{selectedPiece.offset.y},{selectedPiece.offset.z}
                  </>
                )}
              </>
            )}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Btn onClick={() => setFrame((f) => f + 1)}>Reset camera</Btn>
            <Btn active={look.wireframe} onClick={() => L("wireframe", !look.wireframe)}>
              Wireframe
            </Btn>
            <Btn active={look.grid} onClick={() => L("grid", !look.grid)}>
              Grid
            </Btn>
            <Btn variant="primary" disabled={!canExport} onClick={doExportGLB}>
              {mode === "scene" ? "Export scene GLB" : mode === "solver" ? "Export GLB" : "Export GLB"}
            </Btn>
            <Btn variant="primary" disabled={!canExport} onClick={doExportSTL}>
              {mode === "scene" ? "Export scene STL" : mode === "solver" ? "Export STL" : "Export STL"}
            </Btn>
          </div>
        </footer>
      </main>
    </div>
  );
}

function Logo({ mode }: { mode: AppMode }) {
  const subtitle =
    mode === "scene" ? "stack puzzle" : mode === "solver" ? "4³ polycube solver" : "4-cube shape lab";
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-7 w-7 grid-cols-2 gap-0.5">
        <span className="rounded-sm bg-primary" />
        <span />
        <span className="rounded-sm bg-primary" />
        <span className="rounded-sm bg-foreground" />
      </div>
      <div>
        <div className="font-display text-base font-bold leading-none tracking-tight">Cubes</div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {subtitle}
        </div>
      </div>
    </div>
  );
}
