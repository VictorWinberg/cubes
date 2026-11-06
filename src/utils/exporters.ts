import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";

const download = (data: BlobPart, name: string, type: string) => {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const makeMesh = (geometry: THREE.BufferGeometry, color: string, metal = 0, rough = 0.5) => {
  const m = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough }));
  m.name = "Tetrocube";
  return m;
};

export const exportGLB = async (geometry: THREE.BufferGeometry, color: string, name: string, metal?: number, rough?: number) => {
  const buf = await new GLTFExporter().parseAsync(makeMesh(geometry, color, metal, rough), { binary: true });
  download(buf as ArrayBuffer, `${name}.glb`, "model/gltf-binary");
};

export const exportSTL = (geometry: THREE.BufferGeometry, name: string) => {
  const data = new STLExporter().parse(makeMesh(geometry, "#fff"), { binary: true }) as DataView;
  download(data.buffer as ArrayBuffer, `${name}.stl`, "model/stl");
};
