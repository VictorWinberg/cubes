import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Viewport } from "@/components/Viewport";
import { Btn, ColorField, Range, Section, Segmented, Toggle } from "@/components/ui-bits";
import { SHAPES } from "@/geometry/tetrisShapes";
import { identifyShape, pickRandom, randomGrowth } from "@/geometry/tetrocubeGenerator";
import { validateShape } from "@/geometry/shapeValidator";
import { buildBeveledSurface, buildSurface } from "@/geometry/meshBuilder";
import { applyHoles, checkHoles } from "@/geometry/holeGenerator";
import { mirrorShape, normalize, randomOrientation, rotateShape } from "@/utils/shapeRotation";
import { exportGLB, exportSTL } from "@/utils/exporters";
import type { Appearance, Axis, HoleSettings, MaterialKind, Voxel } from "@/types/geometry";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Cubes — 3D four-cube shape generator" },
      {
        name: "description",
        content:
          "Generate, rotate, edit, drill and export every 3D shape made of four connected cubes.",
      },
      { property: "og:title", content: "Cubes — 3D four-cube shape generator" },
      {
        property: "og:description",
        content: "Tetris pieces, expanded into three dimensions. Export GLB and STL.",
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

function App() {
  const list = SHAPES;
  const [index, setIndex] = useState(0);
  const [voxels, setVoxels] = useState<Voxel[]>(SHAPES[0]!.voxels);
  const [frame, setFrame] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [look, setLook] = useState<Appearance>({
    unit: 1,
    color: "#e8622c",
    edgeColor: "#1d1b18",
    edges: true,
    bevel: false,
    bevelRadius: 0.12,
    bevelSnapSharedFaces: true,
    bevelSnapSharedEdges: true,
    bevelSnapSharedCorners: true,
    bevelSegments: 2,
    material: "satin",
    light: 1,
    wireframe: false,
    grid: true,
  });
  const [holes, setHoles] = useState<HoleSettings>({
    enabled: true,
    size: 0.5,
    rimRadius: 0.5,
    rimOffset: 0.37,
    axes: ["x", "y", "z"],
  });

  const L = <K extends keyof Appearance>(k: K, v: Appearance[K]) =>
    setLook((s) => ({ ...s, [k]: v }));
  const H = <K extends keyof HoleSettings>(k: K, v: HoleSettings[K]) =>
    setHoles((s) => ({ ...s, [k]: v }));

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

  const geometry = useMemo(() => {
    const surf = look.bevel
      ? buildBeveledSurface(
          voxels,
          look.unit,
          look.bevelRadius,
          {
            snapSharedFaces: look.bevelSnapSharedFaces,
            snapSharedEdges: look.bevelSnapSharedEdges,
            snapSharedCorners: look.bevelSnapSharedCorners,
          },
          look.bevelSegments,
        )
      : buildSurface(voxels, look.unit);
    if (!validation.valid || !holes.enabled) return surf;
    try {
      return applyHoles(surf, voxels, look.unit, holes);
    } catch (e) {
      console.error(e);
      return surf;
    }
  }, [
    voxels,
    look.unit,
    look.bevel,
    look.bevelRadius,
    look.bevelSnapSharedFaces,
    look.bevelSnapSharedEdges,
    look.bevelSnapSharedCorners,
    look.bevelSegments,
    holes,
    validation.valid,
  ]);

  const fileName = `tetrocube-${(name ?? "custom").split(" ")[0]!.replace(/\W/g, "").toLowerCase()}`;
  const mat = { matte: [0, 0.95], satin: [0.05, 0.5], plastic: [0, 0.25], metal: [0.9, 0.3] }[
    look.material
  ];
  const is3D = ["x", "y", "z"].every((k) => new Set(voxels.map((v) => v[k as Axis])).size > 1);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground lg:h-screen lg:flex-row lg:overflow-hidden">
      {/* Sidebar */}
      <aside className="order-2 w-full shrink-0 border-border bg-card lg:order-1 lg:w-80 lg:overflow-y-auto lg:border-r">
        <header className="hidden border-b border-border px-4 py-4 lg:block">
          <Logo />
        </header>

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
              <Btn
                key={a}
                variant="outline"
                onClick={() => load(rotateShape(voxels, a), index, false)}
              >
                ⟳ {a.toUpperCase()}
              </Btn>
            ))}
            <Btn variant="outline" onClick={() => load(mirrorShape(voxels), index, false)}>
              Mirror
            </Btn>
          </div>
        </Section>

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
              {holeError && (
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
          <ColorField label="Shape color" value={look.color} onChange={(v) => L("color", v)} />
          <ColorField
            label="Cube edge color"
            value={look.edgeColor}
            onChange={(v) => L("edgeColor", v)}
          />
          <Toggle label="Show cube edges" checked={look.edges} onChange={(v) => L("edges", v)} />
          <Toggle label="Bevel edges" checked={look.bevel} onChange={(v) => L("bevel", v)} />
          {look.bevel && (
            <>
              <div className="text-sm">
                <div className="mb-1.5 flex justify-between">
                  <span>Bevel at voxel joints (snap before union)</span>
                  <span className="font-mono text-xs text-muted-foreground">combine</span>
                </div>
                <Toggle
                  label="Snap shared faces"
                  checked={look.bevelSnapSharedFaces}
                  onChange={(v) => L("bevelSnapSharedFaces", v)}
                />
                <Toggle
                  label="Snap shared edges"
                  checked={look.bevelSnapSharedEdges}
                  onChange={(v) => L("bevelSnapSharedEdges", v)}
                />
                <Toggle
                  label="Snap shared corners"
                  checked={look.bevelSnapSharedCorners}
                  onChange={(v) => L("bevelSnapSharedCorners", v)}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  All on ≈ outer silhouette with sharp seams. All off = round every edge between
                  cubes too (full per-cube bevel, then fuse). Mix toggles to see where artifacts
                  come from.
                </p>
              </div>
              <Range
                label="Bevel segments"
                value={look.bevelSegments}
                min={1}
                max={8}
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

      {/* Main */}
      <main className="order-1 flex min-w-0 flex-1 flex-col lg:order-2">
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
          <Logo />
        </div>
        <div className="viewport-bg relative h-[58vh] lg:h-auto lg:flex-1">
          <Viewport
            voxels={voxels}
            geometry={geometry}
            look={look}
            frameKey={`${frame}`}
            editMode={editMode}
            selected={selected}
            onSelect={setSelected}
            onAdd={(v) => setVoxels([...voxels, v])}
            colors={VIEW_COLORS}
          />
          <div className="pointer-events-none absolute left-3 top-3 space-y-1.5">
            <div className="rounded-md bg-card/90 px-3 py-2 shadow-sm backdrop-blur">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Shape
              </div>
              <div className="text-lg font-semibold leading-tight">
                {name ?? "Custom"}
                {is3D && validation.valid && (
                  <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 align-middle text-[10px] font-bold text-primary">
                    3D
                  </span>
                )}
              </div>
            </div>
            <div
              className={`rounded-md px-3 py-1.5 text-xs font-medium shadow-sm ${validation.valid ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}
            >
              {validation.valid ? "✓ Valid — 4 connected cubes" : validation.errors.join(" ")}
            </div>
          </div>
        </div>
        <footer className="flex flex-wrap items-center gap-2 border-t border-border bg-card px-3 py-2.5">
          <span className="font-mono text-xs text-muted-foreground">
            Cubes{" "}
            <b className={voxels.length === 4 ? "text-foreground" : "text-destructive"}>
              {voxels.length}/4
            </b>{" "}
            · {name ?? "custom"}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Btn onClick={() => setFrame((f) => f + 1)}>Reset camera</Btn>
            <Btn active={look.wireframe} onClick={() => L("wireframe", !look.wireframe)}>
              Wireframe
            </Btn>
            <Btn active={look.grid} onClick={() => L("grid", !look.grid)}>
              Grid
            </Btn>
            <Btn
              variant="primary"
              disabled={!validation.valid}
              onClick={() => exportGLB(geometry, look.color, fileName, mat[0], mat[1])}
            >
              Export GLB
            </Btn>
            <Btn
              variant="primary"
              disabled={!validation.valid}
              onClick={() => exportSTL(geometry, fileName)}
            >
              Export STL
            </Btn>
          </div>
        </footer>
      </main>
    </div>
  );
}

function Logo() {
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
          4-cube shape lab
        </div>
      </div>
    </div>
  );
}
