/**
 * Ingest queue   " transient per-file processing state for the Asset Studio
 * AssetIngestTray (Spec 07   7: "per-file rows with resumable progress and processing
 * stages scan   ' compress   ' thumbnail; auto-dismisses on completion").
 *
 * This is transient UI state (FR-123) held module-locally like the animate-studio
 * animateKeySelection store   " NEVER in the manifest. The actual asset records are still
 * created by `engine/assetIngest.ingestFiles` (IL-1: one command per batch); this
 * module only drives the progress affordance in front of that work.
 */
import { useSyncExternalStore } from 'react';

export type IngestStage = 'queued' | 'scan' | 'compress' | 'thumbnail' | 'done' | 'rejected';

export interface IngestRow {
  id: string;
  name: string;
  /** bytes   " drives the row's size readout */
  size: number;
  stage: IngestStage;
  /** 0..1 within the current stage; the row bar shows overall progress */
  progress: number;
  /** set when stage === 'rejected' */
  reason?: string;
}

/** Ordered pipeline the progress bar walks through (excludes terminal states). */
const PIPELINE: IngestStage[] = ['scan', 'compress', 'thumbnail'];

let rows: IngestRow[] = [];
const listeners = new Set<() => void>();
let seq = 0;

function emit(): void {
  rows = [...rows];
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Snapshot for `useSyncExternalStore`   " stable reference between emits. */
function snapshot(): IngestRow[] {
  return rows;
}

export function useIngestRows(): IngestRow[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

function getIngestRows(): IngestRow[] {
  return rows;
}

/** Overall fraction of the queue that has reached a terminal state. */
function overallStageProgress(row: IngestRow): number {
  if (row.stage === 'done') return 1;
  if (row.stage === 'rejected') return 1;
  if (row.stage === 'queued') return 0;
  const idx = PIPELINE.indexOf(row.stage);
  return (idx + row.progress) / PIPELINE.length;
}

function ingestOverallProgress(): number {
  if (rows.length === 0) return 1;
  return rows.reduce((sum, r) => sum + overallStageProgress(r), 0) / rows.length;
}

export function ingestActiveCount(): number {
  return rows.filter((r) => r.stage !== 'done' && r.stage !== 'rejected').length;
}

/** Add a file to the queue and return its row id. */
export function enqueueIngest(name: string, size: number): string {
  const id = `ingest-${++seq}`;
  rows.push({ id, name, size, stage: 'queued', progress: 0 });
  emit();
  return id;
}

function setIngestStage(id: string, stage: IngestStage, progress = 0): void {
  const row = rows.find((r) => r.id === id);
  if (!row) return;
  row.stage = stage;
  row.progress = progress;
  emit();
}

function setIngestProgress(id: string, progress: number): void {
  const row = rows.find((r) => r.id === id);
  if (!row) return;
  row.progress = Math.max(0, Math.min(1, progress));
  emit();
}

export function rejectIngest(id: string, reason: string): void {
  const row = rows.find((r) => r.id === id);
  if (!row) return;
  row.stage = 'rejected';
  row.progress = 1;
  row.reason = reason;
  emit();
}

/** Drop finished/rejected rows (called on tray dismiss). */
export function clearFinishedIngest(): void {
  rows = rows.filter((r) => r.stage !== 'done' && r.stage !== 'rejected');
  emit();
}

function clearAllIngest(): void {
  rows = [];
  emit();
}

/**
 * Drive a queued row through scan   ' compress   ' thumbnail   ' done with animated
 * progress. Deterministic, cancel-safe, and self-cleaning: resolves once the
 * row reaches `done`. Real encoding/thumbnailing is a server concern (Doc 06
 * asset pipeline); this simulates the affordance client-side per Spec 07   7.
 */
export function runIngestPipeline(id: string): Promise<void> {
  const STAGE_MS = 260;
  const TICK_MS = 40;
  return new Promise((resolve) => {
    let stageIdx = 0;
    const stepStage = () => {
      if (stageIdx >= PIPELINE.length) {
        setIngestStage(id, 'done', 1);
        resolve();
        return;
      }
      const stage = PIPELINE[stageIdx];
      setIngestStage(id, stage, 0);
      let elapsed = 0;
      const tick = setInterval(() => {
        elapsed += TICK_MS;
        const p = Math.min(1, elapsed / STAGE_MS);
        setIngestProgress(id, p);
        if (p >= 1) {
          clearInterval(tick);
          stageIdx += 1;
          stepStage();
        }
      }, TICK_MS);
    };
    stepStage();
  });
}
