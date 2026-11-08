import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const download = (data: BlobPart, name: string, type: string) => {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const makeMesh = (geometry: THREE.BufferGeometry, color: string, metal = 0, rough = 0.5) => {
  const m = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough }),
  );
  m.name = "Cubes";
  return m;
};

export const exportGLB = async (
  geometry: THREE.BufferGeometry,
  color: string,
  name: string,
  metal?: number,
  rough?: number,
) => {
  const buf = await new GLTFExporter().parseAsync(makeMesh(geometry, color, metal, rough), {
    binary: true,
  });
  download(buf as ArrayBuffer, `${name}.glb`, "model/gltf-binary");
};

export const exportSTL = (geometry: THREE.BufferGeometry, name: string) => {
  const data = new STLExporter().parse(makeMesh(geometry, "#fff"), { binary: true }) as DataView;
  download(data.buffer as ArrayBuffer, `${name}.stl`, "model/stl");
};

/**
 * Merge piece geometries after applying each group's world translation.
 * Used for scene export (single mesh). Caller should dispose the returned geometry if needed.
 */
export const mergeTranslatedGeometries = (
  parts: { geometry: THREE.BufferGeometry; position: [number, number, number] }[],
): THREE.BufferGeometry | null => {
  if (parts.length === 0) return null;
  const clones: THREE.BufferGeometry[] = [];
  for (const p of parts) {
    const g = p.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().makeTranslation(...p.position));
    clones.push(g);
  }
  const merged = mergeGeometries(clones, false);
  for (const g of clones) g.dispose();
  return merged;
};
