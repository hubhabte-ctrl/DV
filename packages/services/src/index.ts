/**
 * Service entry point (WS1). Boot order (FR-115 + FR-113 offline posture):
 *   1. PostgreSQL bootstrap via the local data-access service — source of truth.
 *   2. Fallback: IndexedDB autosave buffer (handled by the caller) + bundled seed.
 * Draft sync: after every local autosave the manifest is pushed to PostgreSQL
 * (FR-112 server persistence ≤ 10 s; best-effort when offline).
 */
import type { BootstrapData, DataService } from '@bs/schema';
import { ApiDataService } from './api';
import { seedBootstrap } from './seed';
import { setAppData } from './appData';

let service: DataService | null = null;

export function getDataService(): DataService | null {
  return service;
}

/**
 * Initialize the data layer. Returns the bootstrap payload; `source` tells the
 * caller whether PostgreSQL is live ('postgresql') or the seed fallback is in
 * effect ('seed' — offline dev / Node tests).
 */
export async function initData(): Promise<BootstrapData> {
  try {
    const api = new ApiDataService();
    const data = await api.init();
    if (!data || (data as unknown as Record<string, unknown>).offline || !data.manifest) {
      console.info('[services] Offline local mode active — seed manifest loaded.');
      const seedData = seedBootstrap();
      setAppData(seedData);
      return seedData;
    }
    service = api;
    setAppData(data);
    return data;
  } catch {
    console.info('[services] Offline local mode active — seed manifest loaded.');
    const data = seedBootstrap();
    setAppData(data);
    return data;
  }
}

/* Conflict surfacing (WS1-R5, FR-103/FR-113): the shell registers a handler
   (main.tsx → toast); services stay free of ui-kit imports (Doc 04 §1).
   Notified once per distinct server version to avoid autosave spam. */
let onConflict: ((serverVersion: number | undefined) => void) | null = null;
let lastNotifiedConflictVersion: number | null = null;

export function registerConflictHandler(fn: (serverVersion: number | undefined) => void): void {
  onConflict = fn;
}

/** Best-effort server draft sync, wired into the storage layer by main.tsx. */
export function syncDraft(manifest: unknown): void {
  if (!service) return;
  service.saveDraft(manifest).catch((err) => {
    const e = err as { code?: string; draftVersion?: number };
    if (e.code === 'conflict') {
      console.warn('[services] draft conflict — local copy kept; resolve via export/import (FR-113).', err);
      if (lastNotifiedConflictVersion !== (e.draftVersion ?? -1)) {
        lastNotifiedConflictVersion = e.draftVersion ?? -1;
        onConflict?.(e.draftVersion);
      }
    } else {
      console.warn('[services] draft sync skipped (offline?)', err);
    }
  });
}

/** Force local draft version sync override when user chooses to keep local changes after conflict (FR-103) */
export function setServiceDraftVersion(version: number): void {
  if (service && 'setDraftVersion' in service) {
    (service as ApiDataService).setDraftVersion(version);
  }
}

export async function forceSyncLocalDraft(manifest: unknown, serverVersion: number): Promise<{ draftVersion: number } | null> {
  if (!service) return null;
  setServiceDraftVersion(serverVersion);
  lastNotifiedConflictVersion = null;
  return service.saveDraft(manifest);
}

export type { BootstrapData, DataService } from '@bs/schema';
