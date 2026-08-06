/**
 * Viewport loaders & asset caching module (WS2-3d, Doc 04   5, Part 5 asset laws).
 * Pure move from runtime.ts (IL-11 behavior-identical).
 * Handles GLTF, HDR, OBJ, FBX, STL model loading, subPath resolution, and error states.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { getManifest, type SceneNode } from '@bs/engine';

/** One-time GLB parse per asset URL, shared by every extracted mesh node
 *  (Phase 1.1   " never re-loaded, never re-traversed per frame). */
const assetSceneCache = new Map<string, Promise<{ scene: THREE.Group }>>();

function loadAssetSceneCached(url: string): Promise<{ scene: THREE.Group }> {
  let p = assetSceneCache.get(url);
  if (!p) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    p = loader.loadAsync(url);
    assetSceneCache.set(url, p);
  }
  return p;
}

/** One-time HDR equirect load per URL (Phase 2.3   " 02 EnvironmentSystem/HDRAssets). */
const hdrTexCache = new Map<string, Promise<THREE.DataTexture>>();

export function loadHdrCached(url: string): Promise<THREE.DataTexture> {
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

/** Resolve an extracted mesh's source object by its index path in gltf.scene. */
function resolveSubPath(root: THREE.Object3D, subPath: string): THREE.Object3D | undefined {
  let obj: THREE.Object3D | undefined = root;
  for (const seg of subPath.split('/')) {
    obj = obj?.children[Number(seg)];
  }
  return obj;
}

const ERROR_NAME = 'bs-asset-error';

/** Explicit broken-asset state (audit A-5): a red wireframe box   " never a
 *  silently substituted fallback model. */
function errorPlaceholder(): THREE.Object3D {
  const grp = new THREE.Group();
  grp.name = ERROR_NAME;
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshBasicMaterial({ color: '#f87171', wireframe: true }),
  );
  box.position.y = 0.25;
  grp.add(box);
  return grp;
}

function clearErrorPlaceholder(into: THREE.Object3D, disposeSubtree: (root: THREE.Object3D) => void): void {
  const prev = into.children.find((c) => c.name === ERROR_NAME);
  if (prev) {
    into.remove(prev);
    disposeSubtree(prev);
  }
}

export function assetGenFor(node: SceneNode): string {
  const asset = getManifest().assets?.find((a) => a.id === node.props?.assetId);
  return `${asset?.id ?? 'missing'}@${asset?.version ?? 0}:${asset?.url ? 'u' : 'x'}`;
}

export interface ModelLoadContext {
  meshRoots: Map<string, THREE.Object3D>;
  meshGen: Map<string, string>;
  importedMaterials: Map<string, THREE.Material>;
  applyMaterials: () => void;
  invalidate: () => void;
  disposeSubtree: (root: THREE.Object3D) => void;
}

export function loadMesh(
  node: SceneNode,
  into: THREE.Object3D,
  ctx: ModelLoadContext,
): void {
  clearErrorPlaceholder(into, ctx.disposeSubtree);
  const asset = getManifest().assets?.find((a) => a.id === node.props?.assetId);
  const url = asset?.url; // strict   " no hardcoded fallback (audit A-5/AS-8)
  ctx.meshGen.set(node.id, assetGenFor(node));
  if (!url) {
    console.warn(
      `[viewport] mesh '${node.id}' references asset '${String(node.props?.assetId ?? '(none)')}' with no content URL   " showing error state`,
    );
    into.add(errorPlaceholder());
    ctx.invalidate();
    return;
  }
  /* shared normalization: center on origin, rest on ground, fit ~1.6 units */
  const finishModel = (root: THREE.Object3D) => {
    clearErrorPlaceholder(into, ctx.disposeSubtree);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = 1.6 / Math.max(size.x, size.y, size.z, 1e-6);
    root.scale.setScalar(scale);
    root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    root.traverse((child) => {
      // one-time setup traversal only (never per frame)
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = Boolean(node.props?.castShadow);
        child.receiveShadow = Boolean(node.props?.receiveShadow);
      }
    });
    into.add(root);
    ctx.meshRoots.set(node.id, root);
    ctx.applyMaterials();
    ctx.invalidate();
  };
  const fail = (err: unknown) => {
    console.error('[viewport] model load failed', err);
    into.add(errorPlaceholder());
    ctx.invalidate();
  };
  /* extension-routed loaders (Phase 3   " audit S-6): OBJ / FBX / STL join
     GLB/GLTF; STL geometry gets a neutral standard material so the shared
     library can still be assigned on top. */
  const ext = (asset?.name ?? url).split('.').pop()?.toLowerCase() ?? 'glb';
  if (ext === 'obj') {
    new OBJLoader().load(url, finishModel, undefined, fail);
  } else if (ext === 'fbx') {
    new FBXLoader().load(url, finishModel, undefined, fail);
  } else if (ext === 'stl') {
    new STLLoader().load(
      url,
      (geometry) => {
        geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({ color: '#8a96b0', roughness: 0.6 }),
        );
        finishModel(mesh);
      },
      undefined,
      fail,
    );
  } else {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(url, (gltf) => finishModel(gltf.scene), undefined, fail);
  }
}

export function loadExtractedMesh(
  node: SceneNode,
  into: THREE.Object3D,
  ctx: ModelLoadContext,
): void {
  clearErrorPlaceholder(into, ctx.disposeSubtree);
  // drop previously attached shared-content meshes (asset replace path)
  for (const c of [...into.children]) {
    if ((c as THREE.Mesh).userData?.sharedContent) into.remove(c);
  }
  const asset = getManifest().assets?.find((a) => a.id === node.props?.assetId);
  const url = asset?.url; // strict   " no fallback (audit A-5)
  ctx.meshGen.set(node.id, assetGenFor(node));
  if (!url) {
    console.warn(`[viewport] extracted mesh '${node.id}' has no asset URL   " showing error state`);
    into.add(errorPlaceholder());
    ctx.invalidate();
    return;
  }
  loadAssetSceneCached(url)
    .then((gltf) => {
      if (!getManifest().sceneNodes[node.id]) return; // node deleted meanwhile
      const src = resolveSubPath(gltf.scene, String(node.props?.subPath)) as THREE.Mesh | undefined;
      if (!src || !src.isMesh) {
        console.warn(`[viewport] subPath '${String(node.props?.subPath)}' did not resolve to a mesh`);
        into.add(errorPlaceholder());
        ctx.invalidate();
        return;
      }
      clearErrorPlaceholder(into, ctx.disposeSubtree);
      // per-mesh material record (goal.md   2): bind the record to a CLONE of
      // the source material, so meshes that shared one GLTF material stay
      // independently editable   " textures are carried by shared references
      const recId = String(node.props?.materialId ?? '');
      const orig = Array.isArray(src.material) ? src.material[0] : src.material;
      let meshMat: THREE.Material | THREE.Material[] = src.material;
      if (recId && orig) {
        let bound = ctx.importedMaterials.get(recId);
        if (!bound) {
          bound = orig.clone();
          ctx.importedMaterials.set(recId, bound);
        }
        meshMat = bound;
      }
      const mesh = new THREE.Mesh(src.geometry, meshMat);
      mesh.userData.sharedContent = true; // geometry owned by the asset cache
      mesh.castShadow = Boolean(node.props?.castShadow);
      mesh.receiveShadow = Boolean(node.props?.receiveShadow);
      into.add(mesh);
      ctx.meshRoots.set(node.id, mesh); // material ops target ONLY this mesh, not child nodes
      ctx.applyMaterials();
      ctx.invalidate();
    })
    .catch((err) => {
      console.error('[viewport] extracted mesh load failed', err);
      into.add(errorPlaceholder());
      ctx.invalidate();
    });
}
