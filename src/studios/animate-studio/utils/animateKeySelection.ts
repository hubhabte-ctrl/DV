/**
 * Dope-sheet multi-key selection (Spec 07   5: marquee/shift multi-select).
 * Transient UI state (FR-123) held module-locally like the UI store   " NEVER
 * in the manifest. The anchor (last-selected key) mirrors into the UI store's
 * `selectedTrackId`/`selectedKeyframeT` so the Inspector, LeftRail and Graph
 * Editor keep their existing single-anchor contract unchanged.
 */
import { useSyncExternalStore } from 'react';
import { setUIState } from '@bs/engine';

export interface KeyRef {
  trackId: string;
  t: number;
}

const EPS = 1e-6;

let selection: KeyRef[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

export function getSelectedKeys(): KeyRef[] {
  return selection;
}

export function isKeySelected(trackId: string, t: number): boolean {
  return selection.some((k) => k.trackId === trackId && Math.abs(k.t - t) < EPS);
}

/** Replace the selection; the last entry becomes the anchor in the UI store. */
export function setSelectedKeys(next: KeyRef[]): void {
  selection = next;
  const anchor = next[next.length - 1];
  setUIState(
    anchor
      ? { selectedTrackId: anchor.trackId, selectedKeyframeT: anchor.t }
      : { selectedKeyframeT: null },
  );
  emit();
}

/** Shift-click toggle: adds/removes one key without dropping the rest. */
export function toggleKeySelected(trackId: string, t: number): void {
  if (isKeySelected(trackId, t)) {
    setSelectedKeys(selection.filter((k) => !(k.trackId === trackId && Math.abs(k.t - t) < EPS)));
  } else {
    setSelectedKeys([...selection, { trackId, t }]);
  }
}

function clearKeySelection(): void {
  if (selection.length > 0) setSelectedKeys([]);
}

/** Drag-in-progress remap: selected keys moved by a delta keep their identity
 *  (t is the key's identity   " indices shift when tracks re-sort). */
function remapSelectedKeys(map: (k: KeyRef) => KeyRef): void {
  selection = selection.map(map);
  emit();
}

export function useSelectedKeys(): KeyRef[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => selection,
  );
}
