/**
 * Local persistence layer (Phase 0.2   " verification brief   5: assets and the
 * project live in the local prototype database; audit finding A-1/AS-4).
 *
 * IndexedDB layout:
 *  - 'kv'      ' manifest snapshot under key 'manifest' (plain JSON)
 *  - 'blobs'   ' imported asset files (File/Blob) keyed by asset id
 *
 * Session-local `blob:` object URLs are never persisted (they die with the
 * session): they are stripped on save and re-created from the stored Blobs on
 * load. Static seed URLs (e.g. '/assets/   ') persist as-is.
 *
 * The save-state chip (FR-112/114) is driven by REAL writes here   " not a
 * simulation. Where IndexedDB is unavailable (tests / SSR) the module degrades
 * to a chip-only no-op so the engine stays testable in Node.
 */
import { setUIState } from '@bs/engine';
import { registerPersistenceHook, registerAssetBlobHooks } from '@bs/engine';

/* ---------------- Boot-time hook registration (Plan 06   3.4) ----------------
 *
 * `@bs/engine` never imports from `src/`. Instead, this shell-level module
 * (which owns IndexedDB) registers itself with the engine at boot so the
 * command bus can trigger persistence without a reverse packages  'src import.
 *
 * Idempotent   " safe to call from `main.tsx` (once) or a hot-reload path.
 */
export function registerStorageHooks(): void {
  registerPersistenceHook((getSnapshot) => schedulePersist(getSnapshot));
  registerAssetBlobHooks({
    save: saveAssetBlob,
    copy: copyAssetBlob,
    delete: deleteAssetBlob,
  });
}

const DB_NAME = 'build-studio-prototype';
const DB_VERSION = 1;
const KV = 'kv';
const BLOBS = 'blobs';

const hasIDB = typeof indexedDB !== 'undefined';

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(KV)) d.createObjectStore(KV);
        if (!d.objectStoreNames.contains(BLOBS)) d.createObjectStore(BLOBS);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(store, mode);
        const r = op(t.objectStore(store));
        r.onsuccess = () => resolve(r.result as T);
        r.onerror = () => reject(r.error);
      }),
  );
}

interface PersistedAsset {
  id: string;
  url?: string;
  [k: string]: unknown;
}

export interface LoadedProject {
  manifest: Record<string, unknown>;
  /** asset id   ' freshly created object URL for its stored Blob */
  blobUrls: Map<string, string>;
}

/** Hydration source: saved manifest + object URLs for every stored asset Blob. */
export async function loadProject(): Promise<LoadedProject | null> {
  if (!hasIDB) return null;
  try {
    const manifest = await tx<Record<string, unknown> | undefined>(KV, 'readonly', (s) => s.get('manifest'));
    if (!manifest) return null;
    const blobUrls = new Map<string, string>();
    const keys = await tx<IDBValidKey[]>(BLOBS, 'readonly', (s) => s.getAllKeys());
    for (const key of keys) {
      const blob = await tx<Blob | undefined>(BLOBS, 'readonly', (s) => s.get(key));
      if (blob) blobUrls.set(String(key), URL.createObjectURL(blob));
    }
    return { manifest, blobUrls };
  } catch (err) {
    console.warn('[storage] load failed   " starting from seed data', err);
    return null;
  }
}

/** Store an imported asset file so it survives reload (fire-and-forget). */
export function saveAssetBlob(assetId: string, blob: Blob): void {
  if (!hasIDB) return;
  tx(BLOBS, 'readwrite', (s) => s.put(blob, assetId)).catch((e) =>
    console.warn('[storage] blob save failed', e),
  );
}

/** Duplicated assets get their own Blob copy so they persist independently (AS-8). */
function copyAssetBlob(fromId: string, toId: string): void {
  if (!hasIDB) return;
  tx<Blob | undefined>(BLOBS, 'readonly', (s) => s.get(fromId))
    .then((blob) => {
      if (blob) return tx(BLOBS, 'readwrite', (s) => s.put(blob, toId));
    })
    .catch((e) => console.warn('[storage] blob copy failed', e));
}

function deleteAssetBlob(assetId: string): void {
  if (!hasIDB) return;
  tx(BLOBS, 'readwrite', (s) => s.delete(assetId)).catch((e) =>
    console.warn('[storage] blob delete failed', e),
  );
}

/* ---------------- debounced persist (drives the save-state chip) ---------------- */

let persistTimer: ReturnType<typeof setTimeout> | undefined;
let chipTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Called by the command engine on every mutation (dispatch/undo/redo).
 * Debounces 700 ms, then writes the manifest snapshot; the chip reflects the
 * actual write lifecycle: Unsaved   ' Saving   ' Saved | Save failed.
 */
/* Server draft-sync hook (FR-112    10 s server persistence): registered by
   main.tsx with the service layer; engine stays free of service imports. */
let draftSync: ((manifest: unknown) => void) | null = null;
export function registerDraftSync(fn: (manifest: unknown) => void): void {
  draftSync = fn;
}

export function schedulePersist(getSnapshot: () => unknown): void {
  setUIState({ saveState: 'Unsaved' });
  clearTimeout(persistTimer);
  clearTimeout(chipTimer);
  persistTimer = setTimeout(async () => {
    setUIState({ saveState: 'Saving' });
    if (!hasIDB) {
      // Node/test environment: no real store   " settle the chip and return.
      chipTimer = setTimeout(() => setUIState({ saveState: 'Saved' }), 200);
      return;
    }
    try {
      const snapshot = structuredClone(getSnapshot()) as { assets?: PersistedAsset[] };
      // blob: URLs are session-local   " never persist them (re-created on load)
      for (const a of snapshot.assets ?? []) {
        if (a.url?.startsWith('blob:')) delete a.url;
      }
      await tx(KV, 'readwrite', (s) => s.put(snapshot, 'manifest'));
      setUIState({ saveState: 'Saved' });
      draftSync?.(snapshot); // best-effort push to PostgreSQL (ADR-005)
    } catch (err) {
      console.warn('[storage] save failed', err);
      setUIState({ saveState: 'Save failed' });
    }
  }, 700);
}

/** Immediate write   " File     Save now (Phase 2.9 real menus, audit U-3). */
export async function persistNow(getSnapshot: () => unknown): Promise<boolean> {
  clearTimeout(persistTimer);
  clearTimeout(chipTimer);
  setUIState({ saveState: 'Saving' });
  if (!hasIDB) {
    setUIState({ saveState: 'Saved' });
    return true;
  }
  try {
    const snapshot = structuredClone(getSnapshot()) as { assets?: PersistedAsset[] };
    for (const a of snapshot.assets ?? []) {
      if (a.url?.startsWith('blob:')) delete a.url;
    }
    await tx(KV, 'readwrite', (s) => s.put(snapshot, 'manifest'));
    setUIState({ saveState: 'Saved' });
    draftSync?.(snapshot); // best-effort push to PostgreSQL (ADR-005)
    return true;
  } catch (err) {
    console.warn('[storage] save failed', err);
    setUIState({ saveState: 'Save failed' });
    return false;
  }
}

/** Wipe the stored project (dev helper   " seed data returns on next reload). */
export async function clearProject(): Promise<void> {
  if (!hasIDB) return;
  await tx(KV, 'readwrite', (s) => s.delete('manifest'));
  const keys = await tx<IDBValidKey[]>(BLOBS, 'readonly', (s) => s.getAllKeys());
  for (const key of keys) await tx(BLOBS, 'readwrite', (s) => s.delete(key));
}
