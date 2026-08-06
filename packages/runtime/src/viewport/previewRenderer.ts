/**
 * Shared material preview renderer (WS2-1b, Phase 2.6, Doc 05 §8).
 * Renders lit spheres into blob image URLs for Material Studio cards.
 */
import * as THREE from 'three';
import type { Material } from '@bs/engine';

let previewRenderer: THREE.WebGLRenderer | null = null;
let previewScene: THREE.Scene | null = null;
let previewCamera: THREE.PerspectiveCamera | null = null;
let previewSphere: THREE.Mesh | null = null;

function getPreviewStage(): {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sphere: THREE.Mesh;
} {
  if (!previewRenderer) {
    previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    previewRenderer.setSize(128, 128, false);
    previewRenderer.outputColorSpace = THREE.SRGBColorSpace;
    previewRenderer.toneMapping = THREE.ACESFilmicToneMapping;

    previewScene = new THREE.Scene();
    const key = new THREE.DirectionalLight('#ffffff', 2.5);
    key.position.set(3, 4, 5);
    const hemi = new THREE.HemisphereLight('#ffffff', '#1a202c', 1.2);
    previewScene.add(key, hemi);

    previewCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 10);
    previewCamera.position.set(0, 0, 2.2);

    previewSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 32, 32),
      new THREE.MeshStandardMaterial(),
    );
    previewScene.add(previewSphere);
  }
  return {
    renderer: previewRenderer,
    scene: previewScene!,
    camera: previewCamera!,
    sphere: previewSphere!,
  };
}

const previewCache = new Map<string, string>();

export function generateMaterialPreview(rec: Material): Promise<string> {
  const cacheKey = `${rec.id}:${rec.baseColor}:${rec.metallic}:${rec.roughness}:${rec.emissive}:${rec.emissiveIntensity}:${rec.opacity}`;
  const cached = previewCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);

  const { renderer, scene, camera, sphere } = getPreviewStage();
  const mat = sphere.material as THREE.MeshStandardMaterial;
  mat.color.set(rec.baseColor);
  mat.metalness = rec.metallic;
  mat.roughness = rec.roughness;
  mat.emissive.set(rec.emissive);
  mat.emissiveIntensity = rec.emissiveIntensity;
  mat.opacity = rec.opacity;
  mat.transparent = rec.opacity < 1;
  mat.needsUpdate = true;

  renderer.render(scene, camera);

  return new Promise<string>((resolve) => {
    renderer.domElement.toBlob((blob) => {
      if (!blob) {
        resolve('');
        return;
      }
      const url = URL.createObjectURL(blob);
      previewCache.set(cacheKey, url);
      resolve(url);
    });
  });
}
