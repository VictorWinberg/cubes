import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Grid, Lightformer, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Appearance, Voxel } from "@/types/geometry";
import { buildCubeEdges, displayOffset } from "@/geometry/meshBuilder";
import { freeNeighbors } from "@/geometry/shapeValidator";

const MATERIALS = {
  matte: { roughness: 0.95, metalness: 0 },
  satin: { roughness: 0.5, metalness: 0.05 },
  plastic: { roughness: 0.25, metalness: 0 },
  metal: { roughness: 0.3, metalness: 0.9 },
};

/** One renderable polycube mesh (lab or a scene piece). */
export interface ViewportPiece {
  id: string;
  voxels: Voxel[];
  geometry: THREE.BufferGeometry;
  color: string;
  /** Group translation in world units. Lab uses [0,0,0] (offset baked into geometry). */
  position: [number, number, number];
  selected?: boolean;
}

interface Props {
  /** Voxels used for camera framing and grid height (world cells in scene mode). */
  frameVoxels: Voxel[];
  pieces: ViewportPiece[];
  look: Appearance;
  frameKey: string;
  editMode: boolean;
  selectedVoxel: number | null;
  onSelectVoxel: (i: number | null) => void;
  onAddVoxel: (v: Voxel) => void;
  onSelectPiece?: (id: string | null) => void;
  colors: { selection: string; ghost: string; grid: string; gridStrong: string };
}

function Framer({ voxels, unit, frameKey }: { voxels: Voxel[]; unit: number; frameKey: string }) {
  const { camera, controls } = useThree() as unknown as {
    camera: THREE.PerspectiveCamera;
    controls: { target: THREE.Vector3; update: () => void } | null;
  };
  useEffect(() => {
    const ext = (k: "x" | "y" | "z") =>
      voxels.length
        ? Math.max(...voxels.map((v) => v[k])) - Math.min(...voxels.map((v) => v[k])) + 1
        : 1;
    const h = voxels.length ? ext("y") * unit : unit;
    const r =
      Math.max(voxels.length ? Math.hypot(ext("x"), ext("y"), ext("z")) * unit : unit, unit * 2) /
      2;
    const dist = (r / Math.sin((camera.fov * Math.PI) / 360)) * 1.8;
    const dir = new THREE.Vector3(1, 0.8, 1.2).normalize();
    camera.position.copy(dir.multiplyScalar(dist)).add(new THREE.Vector3(0, h / 2, 0));
    camera.near = 0.01;
    camera.far = dist * 20;
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.set(0, h / 2, 0);
      controls.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey, controls]);
  return null;
}

function PieceMesh({
  piece,
  look,
  editMode,
  selectedVoxel,
  onSelectVoxel,
  onAddVoxel,
  onSelectPiece,
  colors,
}: {
  piece: ViewportPiece;
  look: Appearance;
  editMode: boolean;
  selectedVoxel: number | null;
  onSelectVoxel: (i: number | null) => void;
  onAddVoxel: (v: Voxel) => void;
  onSelectPiece?: (id: string | null) => void;
  colors: Props["colors"];
}) {
  const u = look.unit;
  const off = displayOffset(piece.voxels);
  const at = (v: Voxel): [number, number, number] => [
    (v.x + 0.5 + off.x) * u,
    (v.y + 0.5 + off.y) * u,
    (v.z + 0.5 + off.z) * u,
  ];
  const edges = useMemo(() => buildCubeEdges(piece.voxels, u), [piece.voxels, u]);
  const ghosts = useMemo(
    () => (editMode ? freeNeighbors(piece.voxels) : []),
    [piece.voxels, editMode],
  );

  return (
    <group position={piece.position}>
      <mesh
        geometry={piece.geometry}
        onClick={(e) => {
          if (!onSelectPiece) return;
          e.stopPropagation();
          onSelectPiece(piece.id);
        }}
      >
        <meshStandardMaterial
          color={piece.color}
          wireframe={look.wireframe}
          side={THREE.DoubleSide}
          {...MATERIALS[look.material]}
        />
      </mesh>
      {look.edges && !look.wireframe && (
        <lineSegments geometry={edges}>
          <lineBasicMaterial
            color={piece.selected ? colors.selection : look.edgeColor}
            transparent
            opacity={piece.selected ? 0.9 : 0.55}
          />
        </lineSegments>
      )}
      {piece.selected && !look.edges && (
        <lineSegments geometry={edges}>
          <lineBasicMaterial color={colors.selection} transparent opacity={0.85} />
        </lineSegments>
      )}

      {editMode &&
        piece.voxels.map((v, i) => (
          <mesh
            key={`c${piece.id}-${i}`}
            position={at(v)}
            onClick={(e) => {
              e.stopPropagation();
              onSelectVoxel(i);
            }}
          >
            <boxGeometry args={[u * 1.002, u * 1.002, u * 1.002]} />
            <meshBasicMaterial
              color={colors.selection}
              transparent
              opacity={selectedVoxel === i ? 0.45 : 0}
              depthWrite={false}
            />
          </mesh>
        ))}
      {ghosts.map((g) => (
        <mesh
          key={`g${piece.id}-${g.x},${g.y},${g.z}`}
          position={at(g)}
          onClick={(e) => {
            e.stopPropagation();
            onAddVoxel(g);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            (e.object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = 0.4;
          }}
          onPointerOut={(e) => {
            (e.object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = 0.1;
          }}
        >
          <boxGeometry args={[u * 0.9, u * 0.9, u * 0.9]} />
          <meshBasicMaterial color={colors.ghost} transparent opacity={0.1} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export function Viewport({
  frameVoxels,
  pieces,
  look,
  frameKey,
  editMode,
  selectedVoxel,
  onSelectVoxel,
  onAddVoxel,
  onSelectPiece,
  colors,
}: Props) {
  const u = look.unit;
  const sceneOff = displayOffset(frameVoxels);

  return (
    <Canvas
      camera={{ fov: 40, position: [5, 5, 5] }}
      dpr={[1, 2]}
      onPointerMissed={() => {
        onSelectVoxel(null);
        onSelectPiece?.(null);
      }}
    >
      <ambientLight intensity={0.35 * look.light} />
      <directionalLight position={[5, 9, 6]} intensity={1.6 * look.light} />
      <directionalLight position={[-6, 4, -3]} intensity={0.5 * look.light} />
      <Environment resolution={64}>
        <Lightformer
          intensity={1.5 * look.light}
          position={[0, 6, 0]}
          scale={[10, 10, 1]}
          rotation-x={Math.PI / 2}
        />
        <Lightformer
          intensity={0.8 * look.light}
          position={[-6, 1, -1]}
          rotation-y={Math.PI / 2}
          scale={[20, 2, 1]}
        />
        <Lightformer
          intensity={0.8 * look.light}
          position={[6, 1, 2]}
          rotation-y={-Math.PI / 2}
          scale={[20, 2, 1]}
        />
      </Environment>

      {pieces.map((p) => (
        <PieceMesh
          key={p.id}
          piece={p}
          look={look}
          editMode={editMode && pieces.length === 1}
          selectedVoxel={selectedVoxel}
          onSelectVoxel={onSelectVoxel}
          onAddVoxel={onAddVoxel}
          onSelectPiece={onSelectPiece}
          colors={colors}
        />
      ))}

      {look.grid && (
        <Grid
          position={[0, -0.002, 0]}
          infiniteGrid
          cellSize={u}
          sectionSize={u * 4}
          cellColor={colors.grid}
          sectionColor={colors.gridStrong}
          fadeDistance={u * 40}
          cellThickness={0.6}
          sectionThickness={1}
        />
      )}
      <axesHelper
        args={[u * 0.8]}
        position={[(sceneOff.x - 0.0) * u - u * 0.6, 0.001, sceneOff.z * u - u * 0.6]}
      />
      <OrbitControls makeDefault enableDamping />
      <Framer voxels={frameVoxels} unit={u} frameKey={frameKey} />
    </Canvas>
  );
}
