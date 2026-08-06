/**
 * Asset-domain commands (WS2-3c — pure move from commands.ts, IL-11 behavior-identical).
 * Covers: multi-file ingest, versioned replace, metadata/organization patches, bulk ops, delete.
 * Spec refs: FR-180..184, Doc 05 §9, 06 Metadata, Doc 13 Part 4 (immutable version law).
 *
 * Physical move into @bs/engine (Plan 06 §3.4). Asset-blob persistence uses the
 * hook pattern (`registerAssetBlobHooks`) to avoid a reverse packages→src import;
 * `src/engine/storage.ts` registers the hooks at boot.
 */
import { dispatch, getManifest, newNodeId } from './bus';
import type { AssetRecord } from './types';

/* ---------------- Asset-blob hook (Plan 06 §3.4, no reverse packages→src) ---------------- */
export interface AssetBlobHooks {
  save(assetId: string, blob: Blob): void;
  copy(fromId: string, toId: string): void;
  delete(assetId: string): void;
}
let assetBlobHooks: AssetBlobHooks | null = null;
export function registerAssetBlobHooks(hooks: AssetBlobHooks | null): void {
  assetBlobHooks = hooks;
}
function saveAssetBlob(assetId: string, blob: Blob): void {
  if (assetBlobHooks) assetBlobHooks.save(assetId, blob);
}
function copyAssetBlob(fromId: string, toId: string): void {
  if (assetBlobHooks) assetBlobHooks.copy(fromId, toId);
}
function deleteAssetBlob(assetId: string): void {
  if (assetBlobHooks) assetBlobHooks.delete(assetId);
}

/** Register several assets in one transaction (multi-file import, audit AS-1). */
export function addAssets(records: AssetRecord[]): void {
  if (records.length === 0) return;
  const m = getManifest();
  dispatch({ type: 'set', path: 'assets', value: [...m.assets, ...records] });
}

/** Live usage count — scene nodes plus DOM `scene3d` embeds referencing the asset. */
export function assetUsedBy(asset: AssetRecord): number {
  const m = getManifest();
  const dynamic =
    Object.values(m.sceneNodes).filter((n) => n.props?.assetId === asset.id).length +
    Object.values(m.domNodes).filter((n) => n.assetId === asset.id).length;
  return dynamic > 0 ? dynamic : asset.usedBy;
}

export function addAsset(asset: AssetRecord): void {
  const m = getManifest();
  dispatch({ type: 'set', path: 'assets', value: [...m.assets, asset] });
}

export function renameAsset(assetId: string, name: string): void {
  const m = getManifest();
  dispatch({
    type: 'set',
    path: 'assets',
    value: m.assets.map((a) => (a.id === assetId ? { ...a, name } : a)),
  });
}

/** Replacement creates a new version — never mutates in place (Part 4 asset law). */
export function replaceAsset(assetId: string, url?: string, stats?: string): void {
  const m = getManifest();
  dispatch({
    type: 'set',
    path: 'assets',
    value: m.assets.map((a) =>
      a.id === assetId ? { ...a, version: a.version + 1, url: url ?? a.url, stats: stats ?? a.stats } : a,
    ),
  });
}

/** REAL content replacement (Phase 2.10 — FR-183, audit AS-5): the picked file
 *  becomes the new version; every reference reloads via the version bump. */
export function replaceAssetWithFile(assetId: string, file: File): void {
  const m = getManifest();
  const url = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : undefined;
  saveAssetBlob(assetId, file); // persists with the record (Phase 0.2)
  dispatch({
    type: 'set',
    path: 'assets',
    value: m.assets.map((a) =>
      a.id === assetId
        ? {
            ...a,
            version: a.version + 1,
            url,
            stats: `${Math.max(1, Math.round(file.size / 1024))} KB`,
            mime: file.type || a.mime,
            size: file.size,
            modifiedAt: new Date().toISOString(),
          }
        : a,
    ),
  });
}

/** Patch organization/metadata fields on one asset (Phase 2.10 — AS-2/AS-6). */
export function setAssetProps(assetId: string, patch: Partial<AssetRecord>, coalesce = false): void {
  const m = getManifest();
  dispatch({
    type: 'set',
    path: 'assets',
    value: m.assets.map((a) => (a.id === assetId ? { ...a, ...patch } : a)),
    coalesceKey: coalesce ? `assets.${assetId}.props` : undefined,
  });
}

/** Bulk organization ops — ONE transaction = one undo step (Phase 2.10, AS-2). */
export function setAssetsProps(assetIds: string[], patch: Partial<AssetRecord>): void {
  const m = getManifest();
  const ids = new Set(assetIds);
  dispatch({
    type: 'set',
    path: 'assets',
    value: m.assets.map((a) => (ids.has(a.id) ? { ...a, ...patch } : a)),
  });
}

/** Bulk delete: in-use assets are skipped (soft-delete-and-warn, Part 4); returns
 *  { deleted, skipped } so the UI can report honestly. */
export function deleteAssets(assetIds: string[]): { deleted: number; skipped: string[] } {
  const m = getManifest();
  const skipped: string[] = [];
  const deletable = new Set<string>();
  for (const id of assetIds) {
    const asset = m.assets.find((a) => a.id === id);
    if (!asset) continue;
    if (assetUsedBy(asset) > 0) skipped.push(asset.name);
    else deletable.add(id);
  }
  if (deletable.size > 0) {
    dispatch({ type: 'set', path: 'assets', value: m.assets.filter((a) => !deletable.has(a.id)) });
    for (const id of deletable) deleteAssetBlob(id);
  }
  return { deleted: deletable.size, skipped };
}

/** Distinct folder names in use (Phase 2.10 — AS-2). */
export function assetFolders(): string[] {
  const m = getManifest();
  return [...new Set(m.assets.map((a) => a.folder).filter((f): f is string => !!f))].sort();
}

export function duplicateAsset(assetId: string): void {
  const m = getManifest();
  const src = m.assets.find((a) => a.id === assetId);
  if (!src) return;
  const copy: AssetRecord = {
    ...structuredClone(src),
    id: newNodeId('asset'),
    name: src.name.replace(/(\.[a-z0-9]+)?$/i, ' copy$1'),
    usedBy: 0,
  };
  const at = m.assets.findIndex((a) => a.id === assetId);
  const next = [...m.assets];
  next.splice(at + 1, 0, copy);
  copyAssetBlob(assetId, copy.id); // duplicates persist independently (AS-8)
  dispatch({ type: 'set', path: 'assets', value: next });
}

/** Deletion of in-use assets is refused (soft-delete-and-warn law, Part 4). */
export function deleteAsset(assetId: string): boolean {
  const m = getManifest();
  const asset = m.assets.find((a) => a.id === assetId);
  if (!asset || assetUsedBy(asset) > 0) return false;
  dispatch({ type: 'set', path: 'assets', value: m.assets.filter((a) => a.id !== assetId) });
  deleteAssetBlob(assetId);
  return true;
}
