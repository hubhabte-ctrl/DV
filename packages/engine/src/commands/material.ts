/**
 * Material-domain commands (WS2-3c — pure move from commands.ts, IL-11 behavior-identical).
 * Covers: PBR property edits, texture slot assignment, UV edits, duplicate/add/delete.
 * Spec refs: FR-140..142, Doc 05 §8, 03 TexturePipeline, Doc 13 Part 4.
 */
import { dispatch, getManifest, newNodeId } from './bus';
import type { Material, MaterialMapSlot, MaterialUv } from './types';

/** Edit a shared material record — propagates to every linked mesh (Part 4). */
export function setMaterialProp(
  materialId: string,
  prop: keyof Material,
  value: string | number,
  coalesce = false,
): void {
  const path = `materials.${materialId}.${prop}`;
  dispatch({ type: 'set', path, value, coalesceKey: coalesce ? path : undefined });
}

/** Assign/clear a texture slot on a material record (audit M-1). */
export function setMaterialMap(materialId: string, slot: MaterialMapSlot, assetId: string | undefined): void {
  dispatch({ type: 'set', path: `materials.${materialId}.maps.${slot}`, value: assetId });
}

/** Edit the material's UV transform (audit M-2). */
export function setMaterialUv(
  materialId: string,
  key: keyof MaterialUv,
  value: [number, number] | number,
  coalesce = false,
): void {
  const path = `materials.${materialId}.uv.${key}`;
  dispatch({ type: 'set', path, value, coalesceKey: coalesce ? path : undefined });
}

/** Duplication is the only fork mechanism for materials (Part 4).
 *  A fork of an imported material becomes a standalone editable record. */
export function duplicateMaterial(materialId: string): string | null {
  const m = getManifest();
  const src = m.materials[materialId];
  if (!src) return null;
  const copy: Material = { ...structuredClone(src), id: newNodeId('mat'), name: `${src.name} copy` };
  delete copy.imported; // the fork no longer tracks the GLB's original instance
  dispatch({ type: 'set', path: `materials.${copy.id}`, value: copy });
  return copy.id;
}

export function addMaterial(): string {
  const m = getManifest();
  const mat: Material = {
    id: newNodeId('mat'),
    name: `Material ${Object.keys(m.materials).length + 1}`,
    baseColor: '#8a96b0',
    metallic: 0,
    roughness: 0.5,
    emissive: '#000000',
    emissiveIntensity: 0,
    opacity: 1,
  };
  dispatch({ type: 'set', path: `materials.${mat.id}`, value: mat });
  return mat.id;
}

/** How many meshes link the material — deletion of in-use materials is refused. */
export function materialUsedBy(materialId: string): number {
  const m = getManifest();
  return Object.values(m.sceneNodes).filter((n) => n.props?.materialId === materialId).length;
}

export function deleteMaterial(materialId: string): boolean {
  const m = getManifest();
  if (!m.materials[materialId] || materialUsedBy(materialId) > 0) return false;
  dispatch({ type: 'set', path: `materials.${materialId}`, value: undefined });
  return true;
}
