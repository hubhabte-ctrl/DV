/**
 * Embedded GLB viewer   " a lightweight, React-free (IL-3) renderer for `scene3d`
 * DOM nodes: a GLB dropped onto the DOM canvas renders seamlessly inside the
 * page with a transparent background and NO grid/ground chrome, layered and
 * positioned like any other DOM element (new_task brief).
 *
 * Phase 2.8 (audit A-4/D-9):
 *  - renders through the SHARED embed renderer pool   " one WebGL context for
 *    any number of embeds, never one context each;
 *  - embed content is track-addressable: a timeline track targeting the
 *    embed's DOM node with channel `rotationY` (radians) owns the model's
 *    rotation; without one, the embed falls back to the scroll turntable.
 *
 * Driven exclusively by the one [0,1] progress clock (IL-2). Demand-rendered;
 * dispose() is mandatory (Doc 13 Part 5).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import {
  defaultScene3dSettings,
  getManifest,
  scene3dSettingsOf,
  subscribeManifest,
  type Scene3dSettings,
} from '@bs/engine';
import { createEvaluator, trackSignature } from '@bs/engine';
import { audibleTracks } from '../engine/audibleTracks';
import { getProgress, subscribeProgress } from '../engine/progress';
import { subscribeUIState } from '@bs/engine';
import { acquirePooledTarget } from './embedPool';

export interface EmbedViewerHandle {
  dispose(): void;
}

/** One-time HDR equirect load per URL (shared across embeds   " Part 5). */
const hdrTexCache = new Map<string, Promise<THREE.DataTexture>>();

function loadHdrCached(url: string): Promise<THREE.DataTexture> {
  let p = hdrTexCache.get(url);
  if (!p) {
    p = new RGBELoader().loadAsync(url).then((tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      return tex;
    });
    hdrTexCache.set(url, p);
  }
  return p;
}

export function createEmbedViewer(container: HTMLElement, url: string, nodeId?: string): EmbedViewerHandle {
  /* pooled rendering (A-4): the embed owns a plain 2D canvas, not a context */
  const target = acquirePooledTarget();
  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const scene = new THREE.Scene(); // no grid, no ground   " page-seamless
  const hemi = new THREE.HemisphereLight('#cfe0ff', '#141820', 0.9);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  key.position.set(3, 5, 4);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 60);
  /* pivot carries the scroll spin; modelGroup carries the instance transform
     from the Inspector (issues.md)   " independent, both undoable via IL-1 */
  const pivot = new THREE.Group();
  const modelGroup = new THREE.Group();
  pivot.add(modelGroup);
  scene.add(pivot);

  let needsFrame = true;
  let running = true;
  const invalidate = () => {
    needsFrame = true;
  };

  /*  "  "  per-instance settings (issues.md Inspector Requirements): camera,
     lighting, HDR environment, model transform, scroll animation   " read from
     the embed's OWN DomNode record and re-applied on every manifest change  "  "  */
  let settings: Scene3dSettings = defaultScene3dSettings();
  let appliedEnvKey = '';

  const applySettings = () => {
    const node = nodeId ? getManifest().domNodes[nodeId] : undefined;
    settings = node && node.type === 'scene3d' ? scene3dSettingsOf(node) : defaultScene3dSettings();
    const s = settings;
    modelGroup.position.fromArray(s.model.position);
    modelGroup.rotation.set(s.model.rotation[0] ?? 0, s.model.rotation[1] ?? 0, s.model.rotation[2] ?? 0);
    modelGroup.scale.setScalar(s.model.scale || 1);
    camera.fov = s.camera.fov;
    camera.position.set(0, s.camera.height, s.camera.distance);
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0, 0);
    key.intensity = s.lighting.keyIntensity;
    key.color.set(s.lighting.keyColor);
    hemi.intensity = s.lighting.hemiIntensity;
    scene.environmentIntensity = s.environment.envIntensity;
    scene.background =
      s.environment.background === 'color' ? new THREE.Color(s.environment.backgroundColor) : null;
    const asset = s.environment.hdrAssetId
      ? getManifest().assets.find((a) => a.id === s.environment.hdrAssetId)
      : undefined;
    const envKey = asset?.url ? `${asset.url}@${asset.version}` : '';
    if (envKey !== appliedEnvKey) {
      appliedEnvKey = envKey;
      if (!asset?.url) {
        scene.environment = null;
      } else {
        loadHdrCached(asset.url)
          .then((tex) => {
            if (!running || appliedEnvKey !== envKey) return; // superseded meanwhile
            scene.environment = tex;
            invalidate();
          })
          .catch((err) => console.warn('[embed-viewer] HDR environment load failed', err));
      }
    }
    invalidate();
  };

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(
    url,
    (gltf) => {
      const root = gltf.scene;
      // one-time normalization traversal (never per frame   " Part 5)
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = 1.5 / Math.max(size.x, size.y, size.z, 1e-6);
      root.scale.setScalar(scale);
      root.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
      modelGroup.add(root);
      invalidate();
    },
    undefined,
    (err) => console.error('[embed-viewer] GLB load failed', err),
  );

  /* track-addressable rotation (D-9): the embed consumes the same shared
     Experience Timeline through its own evaluator (Rule 7   " no coupling) */
  const rotationKey = nodeId ? `${nodeId}.rotationY` : null;
  let evaluator = createEvaluator(audibleTracks(getManifest().tracks));
  let evalSig = trackSignature(audibleTracks(getManifest().tracks));
  const unsubManifest = subscribeManifest(() => {
    const sig = trackSignature(audibleTracks(getManifest().tracks));
    if (sig !== evalSig) {
      evalSig = sig;
      evaluator = createEvaluator(audibleTracks(getManifest().tracks));
    }
    applySettings(); // inspector edits apply live (issues.md)
    applyProgress(getProgress());
  });
  /* transient mute/solo (04 TimelineEditor   2) rebuilds the audible evaluator */
  const unsubUIState = subscribeUIState(() => {
    const sig = trackSignature(audibleTracks(getManifest().tracks));
    if (sig !== evalSig) {
      evalSig = sig;
      evaluator = createEvaluator(audibleTracks(getManifest().tracks));
      applyProgress(getProgress());
    }
  });

  const applyProgress = (p: number) => {
    let owned = false;
    if (rotationKey) {
      const buf = evaluator.evaluate(p).channels.get(rotationKey);
      if (buf) {
        pivot.rotation.y = buf[0];
        owned = true;
      }
    }
    if (!owned) {
      // scroll animation settings (issues.md): mode / speed / progress band
      const sc = settings.scroll;
      if (sc.mode === 'static') {
        pivot.rotation.y = 0;
      } else {
        const [a, b] = sc.range;
        const t = b > a ? Math.min(1, Math.max(0, (p - a) / (b - a))) : 0;
        pivot.rotation.y = t * Math.PI * 2 * sc.speed;
      }
    }
    invalidate();
  };
  applySettings();
  applyProgress(getProgress());
  const unsubProgress = subscribeProgress(applyProgress);

  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    invalidate();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const loop = () => {
    if (!running) return;
    if (needsFrame) {
      needsFrame = false;
      target.render(scene, camera, canvas);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  return {
    dispose() {
      running = false;
      unsubProgress();
      unsubManifest();
      unsubUIState();
      ro.disconnect();
      pivot.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) m?.dispose();
        }
      });
      target.release();
      if (canvas.parentElement === container) container.removeChild(canvas);
    },
  };
}
