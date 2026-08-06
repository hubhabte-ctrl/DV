/**
 * Viewport material & texture pipeline module (WS2-3d, FR-140..142, Doc 05   8, Part 4 Material law).
 * Pure move from runtime.ts (IL-11 behavior-identical).
 */
import * as THREE from 'three';
import {
  getManifest,
  MATERIAL_MAP_SLOTS,
  type Material,
} from '@bs/engine';

export interface MaterialPipelineContext {
  libMaterials: Map<string, THREE.MeshPhysicalMaterial>;
  importedMaterials: Map<string, THREE.Material>;
  originalMats: Map<string, Map<THREE.Mesh, THREE.Material | THREE.Material[]>>;
  meshRoots: Map<string, THREE.Object3D>;
  invalidate: () => void;
}

const baseTexCache = new Map<string, THREE.Texture>();
const matTexCache = new Map<string, { src: string; tex: THREE.Texture }>();

function materialTexture(
  rec: Material,
  slot: string,
  assetId: string,
  onTextureLoaded: () => void,
): THREE.Texture | null {
  const asset = getManifest().assets?.find((a) => a.id === assetId);
  const url = asset?.url;
  if (!url) return null;
  let base = baseTexCache.get(url);
  if (!base) {
    base = new THREE.TextureLoader().load(url, () => {
      // image arrived: refresh clones made before the pixels existed
      for (const [k, v] of [...matTexCache]) {
        if (v.src === url) matTexCache.delete(k);
      }
      onTextureLoaded();
    });
    base.wrapS = base.wrapT = THREE.RepeatWrapping;
    baseTexCache.set(url, base);
  }
  const key = `${rec.id}:${slot}`;
  let entry = matTexCache.get(key);
  if (!entry || entry.src !== url) {
    const tex = base.clone();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = slot === 'map' || slot === 'emissiveMap' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    entry = { src: url, tex };
    matTexCache.set(key, entry);
  }
  const uv = rec.uv;
  entry.tex.repeat.set(uv?.tiling?.[0] ?? 1, uv?.tiling?.[1] ?? 1);
  entry.tex.offset.set(uv?.offset?.[0] ?? 0, uv?.offset?.[1] ?? 0);
  entry.tex.rotation = uv?.rotation ?? 0;
  entry.tex.needsUpdate = true;
  return entry.tex;
}

/** Write a record's channels + texture slots onto a THREE material. */
function applyRecordToMaterial(
  rec: Material,
  mat: THREE.Material,
  onTextureLoaded: () => void,
): void {
  const std = mat as THREE.MeshStandardMaterial;
  std.color?.set(rec.baseColor);
  if ('metalness' in std) std.metalness = rec.metallic;
  if ('roughness' in std) std.roughness = rec.roughness;
  std.emissive?.set(rec.emissive);
  std.emissiveIntensity = rec.emissiveIntensity;
  std.opacity = rec.opacity;
  /* transparency modes (Phase 3   " audit M-7): blend / alpha-clip override
     the opacity-derived default; imported records only change what the user
     explicitly set (never stomp GLB alpha modes) */
  if (rec.alphaMode === 'blend') {
    std.transparent = true;
    std.alphaTest = 0;
  } else if (rec.alphaMode === 'clip') {
    std.transparent = false;
    std.alphaTest = 0.5;
  } else if (rec.imported) {
    if (rec.opacity < 1) std.transparent = true;
  } else {
    std.transparent = rec.opacity < 1;
    std.alphaTest = 0;
  }
  /* clearcoat + refraction (Phase 3   " audit M-7, 03 Inspector specs);
     undefined on imported records = keep the GLB's own values */
  const phys = std as unknown as THREE.MeshPhysicalMaterial;
  if ('clearcoat' in phys) {
    if (rec.clearcoat !== undefined || !rec.imported) phys.clearcoat = rec.clearcoat ?? 0;
    if (rec.clearcoatRoughness !== undefined || !rec.imported) {
      phys.clearcoatRoughness = rec.clearcoatRoughness ?? 0;
    }
    if (rec.transmission !== undefined || !rec.imported) phys.transmission = rec.transmission ?? 0;
    if (rec.ior !== undefined || !rec.imported) phys.ior = rec.ior ?? 1.5;
  }
  const slots = std as unknown as Record<string, THREE.Texture | null>;
  for (const slot of MATERIAL_MAP_SLOTS) {
    const assetId = rec.maps?.[slot];
    if (assetId !== undefined) {
      // explicit record slot: assigned asset or explicit clear
      slots[slot] = assetId ? materialTexture(rec, slot, assetId, onTextureLoaded) : null;
    } else if (!rec.imported) {
      slots[slot] = null; // lib materials own all their slots
    }
    // imported + undefined slot   ' keep the GLB's embedded texture
  }
  std.needsUpdate = true;
}

export function libMaterialFor(
  materialId: string,
  ctx: MaterialPipelineContext,
): THREE.Material | null {
  const rec = getManifest().materials?.[materialId];
  if (!rec) return null;
  const onTextureLoaded = () => {
    applyMaterials(ctx);
    ctx.invalidate();
  };
  if (rec.imported) {
    const orig = ctx.importedMaterials.get(materialId);
    if (!orig) return null; // GLB content not resolved yet
    applyRecordToMaterial(rec, orig, onTextureLoaded);
    return orig;
  }
  let mat = ctx.libMaterials.get(materialId);
  if (!mat) {
    mat = new THREE.MeshPhysicalMaterial();
    ctx.libMaterials.set(materialId, mat);
  }
  applyRecordToMaterial(rec, mat, onTextureLoaded);
  return mat;
}

/** Editor-rate application (on manifest change only   " never per frame). */
export function applyMaterials(ctx: MaterialPipelineContext): void {
  const m = getManifest();
  for (const [nodeId, root] of ctx.meshRoots) {
    const node = m.sceneNodes[nodeId];
    if (!node) continue;
    const materialId = String(node.props?.materialId ?? '');
    const lib = materialId ? libMaterialFor(materialId, ctx) : null;
    if (lib) {
      let cache = ctx.originalMats.get(nodeId);
      if (!cache) {
        cache = new Map();
        ctx.originalMats.set(nodeId, cache);
      }
      root.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          if (!cache!.has(mesh)) cache!.set(mesh, mesh.material);
          mesh.material = lib;
        }
      });
    } else {
      const cache = ctx.originalMats.get(nodeId);
      if (cache) {
        for (const [mesh, original] of cache) mesh.material = original;
        ctx.originalMats.delete(nodeId);
      }
    }
  }
  ctx.invalidate();
}
