/**
 * Keyframe operations for the Timeline Panel (Spec 07   5: add-key `K`,
 * multi-delete, copy/paste at playhead; snapping to grid steps, section
 * bounds, markers and sibling keys). All writes go through the command
 * engine (IL-1); locked tracks reject edits (04 TimelineEditor   2).
 *
 * Exported for App.tsx's global keymap (K  * Delete  * Ctrl+C  * Ctrl+V)   "
 * same pattern as the previous `addKeyframeAtPlayhead` export.
 */
import { toast } from '../../../app/ui/Toast';
import { getManifest, getTrack, setTrackKeyframes, type Keyframe } from '@bs/engine';
import { sampleKeyframes } from '@bs/engine';
import { getProgress } from '../../../engine/progress';
import { getSelectedKeys, setSelectedKeys, type KeyRef } from './animateKeySelection';

const EPS = 1e-6;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const round4 = (t: number) => Math.round(t * 10000) / 10000;

/**
 * Snap a keyframe time to the 0.01 grid, then to section bounds, markers and
 * (optionally) sibling keys of the same track (Spec 07   5; 04 TimelineEditor
 *   1 markers as snap targets). `excludeTs` keeps a dragged selection from
 * snapping to itself.
 */
export function snapKeyT(t: number, trackId?: string, excludeTs: number[] = []): number {
  let out = clamp01(Math.round(t * 100) / 100);
  const m = getManifest();
  const targets: number[] = [];
  for (const s of m.sections) targets.push(...s.range);
  for (const mk of m.markers) targets.push(mk.t);
  if (trackId) {
    const track = m.tracks.find((tr) => tr.id === trackId);
    if (track) {
      for (const k of track.keyframes) {
        if (!excludeTs.some((e) => Math.abs(e - k.t) < EPS)) targets.push(k.t);
      }
    }
  }
  for (const target of targets) {
    if (Math.abs(out - target) < 0.02) out = target;
  }
  return out;
}

/** `K` / transport button: keyframe at the playhead sampling the current
 *  evaluated value (existing contract, moved from TimelineBar   " IL-11). */
export function addKeyframeAtPlayhead(trackId: string | null): void {
  if (!trackId) {
    toast('Select a track first, then press K or use keyframe add button');
    return;
  }
  const track = getTrack(trackId);
  if (!track) return;
  if (track.locked) {
    toast('Track is locked — unlock it to add keyframes');
    return;
  }
  const t = snapKeyT(getProgress());
  if (track.keyframes.some((k) => Math.abs(k.t - t) < EPS)) {
    toast(`Keyframe already exists at t=${t}`);
    return;
  }
  const v = sampleKeyframes(track.keyframes, t);
  setTrackKeyframes(trackId, [...track.keyframes, { t, v, ease: 'smooth' }]);
  setSelectedKeys([{ trackId, t }]);
  toast(`Keyframe added at t=${t}`);
}

function selectionByTrack(sel: KeyRef[]): Map<string, number[]> {
  const byTrack = new Map<string, number[]>();
  for (const k of sel) {
    const ts = byTrack.get(k.trackId) ?? [];
    ts.push(k.t);
    byTrack.set(k.trackId, ts);
  }
  return byTrack;
}

/** Delete every selected key (Delete/Backspace). A track always keeps     1
 *  keyframe (same guard as `deleteKeyframe`); locked tracks are skipped.
 *  Returns true when the panel consumed the event. */
export function deleteSelectedKeyframes(): boolean {
  const sel = getSelectedKeys();
  if (sel.length === 0) return false;
  let deleted = 0;
  let lockedCount = 0;
  let floorCount = 0;
  for (const [trackId, ts] of selectionByTrack(sel)) {
    const track = getTrack(trackId);
    if (!track) continue;
    if (track.locked) {
      lockedCount++;
      continue;
    }
    const remaining = track.keyframes.filter((k) => !ts.some((t) => Math.abs(k.t - t) < EPS));
    if (remaining.length === 0) {
      floorCount++;
      continue;
    }
    deleted += track.keyframes.length - remaining.length;
    setTrackKeyframes(trackId, remaining);
  }
  setSelectedKeys([]);
  if (deleted > 0) {
    toast(
      `${deleted} keyframe${deleted === 1 ? '' : 's'} deleted — Ctrl+Z restores` +
        (floorCount > 0 ? ' (tracks keep their last keyframe)' : ''),
    );
  } else if (lockedCount > 0) {
    toast('Track is locked — unlock it to delete keyframes');
  } else if (floorCount > 0) {
    toast('A track keeps at least one keyframe — delete the track instead');
  }
  return true;
}

/*  "  "  copy/paste (Spec 07   5)   " editor-session clipboard, transient  "  "  */

let clipboard: { keys: { trackId: string; k: Keyframe }[]; origin: number } | null = null;

export function copySelectedKeyframes(): boolean {
  const sel = getSelectedKeys();
  if (sel.length === 0) return false;
  const keys: { trackId: string; k: Keyframe }[] = [];
  let origin = Infinity;
  for (const ref of sel) {
    const track = getTrack(ref.trackId);
    const k = track?.keyframes.find((kf) => Math.abs(kf.t - ref.t) < EPS);
    if (!track || !k) continue;
    keys.push({ trackId: ref.trackId, k: { ...k, v: [...k.v] } });
    origin = Math.min(origin, k.t);
  }
  if (keys.length === 0) return false;
  clipboard = { keys, origin };
  toast(`${keys.length} keyframe${keys.length === 1 ? '' : 's'} copied — Ctrl+V pastes at the playhead`);
  return true;
}

/** Paste preserving relative offsets, first key landing on the playhead.
 *  Existing keys at a pasted t are replaced (sorted-unique law, Doc 13 Part 4). */
export function pasteKeyframesAtPlayhead(): boolean {
  if (!clipboard) return false;
  const offset = getProgress() - clipboard.origin;
  const byTrack = new Map<string, Keyframe[]>();
  for (const { trackId, k } of clipboard.keys) {
    const list = byTrack.get(trackId) ?? [];
    list.push({ ...k, v: [...k.v], t: round4(clamp01(k.t + offset)) });
    byTrack.set(trackId, list);
  }
  const pasted: KeyRef[] = [];
  let lockedCount = 0;
  for (const [trackId, keys] of byTrack) {
    const track = getTrack(trackId);
    if (!track) continue;
    if (track.locked) {
      lockedCount++;
      continue;
    }
    const kept = track.keyframes.filter(
      (existing) => !keys.some((nk) => Math.abs(nk.t - existing.t) < EPS),
    );
    setTrackKeyframes(trackId, [...kept, ...keys]);
    pasted.push(...keys.map((k) => ({ trackId, t: k.t })));
  }
  if (pasted.length > 0) {
    setSelectedKeys(pasted);
    toast(`${pasted.length} keyframe${pasted.length === 1 ? '' : 's'} pasted at the playhead`);
  } else if (lockedCount > 0) {
    toast('Track is locked — unlock it to paste keyframes');
  }
  return pasted.length > 0;
}
