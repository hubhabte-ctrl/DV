/**
 * Timeline-domain commands (WS2-3c — pure move from commands.ts, IL-11 behavior-identical).
 * Covers: track CRUD, keyframe edits, named markers.
 * Spec refs: FR-151/152, Doc 05 §7, 04 GraphEditor, 04 AnimationCurves, audit T-1..T-6.
 */
import { dispatch, getManifest, newNodeId } from './bus';
import type { Keyframe, Marker, Track } from './types';

/* ---------------- Keyframe operations (FR-151/152, Doc 05 §7) ---------------- */

/** Replace a track's keyframes (kept sorted, unique t — Doc 13 Part 4 Timeline law). */
export function setTrackKeyframes(trackId: string, keyframes: Keyframe[], coalesce = false): void {
  const m = getManifest();
  const idx = m.tracks.findIndex((t) => t.id === trackId);
  if (idx < 0) return;
  const sorted = [...keyframes].sort((a, b) => a.t - b.t);
  const unique = sorted.filter((k, i) => i === 0 || k.t - sorted[i - 1].t > 1e-6);
  dispatch({
    type: 'set',
    path: `tracks.${idx}.keyframes`,
    value: unique,
    coalesceKey: coalesce ? `tracks.${trackId}.keyframes` : undefined,
  });
}

export function getTrack(trackId: string): Track | undefined {
  return getManifest().tracks.find((t) => t.id === trackId);
}

export function deleteKeyframe(trackId: string, t: number): void {
  const track = getTrack(trackId);
  if (!track || track.keyframes.length <= 1) return;
  setTrackKeyframes(
    trackId,
    track.keyframes.filter((k) => Math.abs(k.t - t) > 1e-6),
  );
}

export function getKeyframeName(track: Track, k: Keyframe, index?: number): string {
  if (k.name && k.name.trim()) return k.name;

  const cleanLabel = track.label.replace(/\s+·\s+/g, '_').replace(/\s+/g, '_');
  const pct = Math.round(k.t * 100);

  if (k.t === 0) return `${cleanLabel}_Start`;
  if (k.t === 1) return `${cleanLabel}_End`;

  if (track.id.includes('cam-pos')) {
    if (k.t < 0.3) return 'Camera_Position_Hero_View';
    if (k.t < 0.7) return 'Camera_Position_Mid_Focus';
    return 'Camera_Position_Detail_Angle';
  }
  if (track.id.includes('cam-target')) {
    if (k.t < 0.6) return 'Camera_Target_Center';
    return 'Camera_Target_Focus_Point';
  }
  if (cleanLabel.toLowerCase().includes('fade')) {
    return `${cleanLabel}_In`;
  }
  if (cleanLabel.toLowerCase().includes('rotation')) {
    return `${cleanLabel}_Spin_${pct}pct`;
  }
  return `${cleanLabel}_Pos_${pct}pct`;
}

export function renameKeyframe(trackId: string, t: number, name: string): void {
  const track = getTrack(trackId);
  if (!track) return;
  const updated = track.keyframes.map((k) =>
    Math.abs(k.t - t) <= 1e-6 ? { ...k, name } : k,
  );
  setTrackKeyframes(trackId, updated);
}

export function updateKeyframe(trackId: string, t: number, patch: Partial<Keyframe>): void {
  const track = getTrack(trackId);
  if (!track) return;
  const updated = track.keyframes.map((k) =>
    Math.abs(k.t - t) <= 1e-6 ? { ...k, ...patch } : k,
  );
  setTrackKeyframes(trackId, updated);
}

/* ---------------- Timeline markers (Phase 2.5 — brief §4, audit T-3) ---------------- */

export function addMarker(t: number, label?: string): Marker {
  const m = getManifest();
  const marker: Marker = {
    id: newNodeId('mk'),
    label: label ?? `Marker ${m.markers.length + 1}`,
    t: Math.max(0, Math.min(1, t)),
  };
  const next = [...m.markers, marker].sort((a, b) => a.t - b.t);
  dispatch({ type: 'set', path: 'markers', value: next });
  return marker;
}

export function removeMarker(markerId: string): void {
  const m = getManifest();
  dispatch({ type: 'set', path: 'markers', value: m.markers.filter((mk) => mk.id !== markerId) });
}

export function setMarkerProp(
  markerId: string,
  prop: 'label' | 't',
  value: string | number,
  coalesce = false,
): void {
  const m = getManifest();
  const next = m.markers
    .map((mk) => (mk.id === markerId ? { ...mk, [prop]: value } : mk))
    .sort((a, b) => a.t - b.t);
  dispatch({
    type: 'set',
    path: 'markers',
    value: next,
    coalesceKey: coalesce ? `markers.${markerId}` : undefined,
  });
}

/* ---------------- Track operations (FR-151, audit T-1) ---------------- */

/** Author a new animation track (evaluators rebuild via trackSignature). */
export function addTrack(track: Track): void {
  const m = getManifest();
  dispatch({ type: 'set', path: 'tracks', value: [...m.tracks, track] });
}

export function removeTrack(trackId: string): void {
  const m = getManifest();
  dispatch({ type: 'set', path: 'tracks', value: m.tracks.filter((t) => t.id !== trackId) });
}

export function renameTrack(trackId: string, label: string): void {
  const m = getManifest();
  const idx = m.tracks.findIndex((t) => t.id === trackId);
  if (idx < 0) return;
  dispatch({ type: 'set', path: `tracks.${idx}.label`, value: label });
}

/** Lock/unlock a track (04 TimelineEditor §2: lock is persisted — one command,
 *  undoable; locked tracks reject keyframe edits in the Timeline Panel). */
export function setTrackLocked(trackId: string, locked: boolean): void {
  const m = getManifest();
  const idx = m.tracks.findIndex((t) => t.id === trackId);
  if (idx < 0) return;
  dispatch({ type: 'set', path: `tracks.${idx}.locked`, value: locked });
}

/** Duplicate a track with all keyframes (04 TimelineEditor §2). The copy
 *  targets the same property — QC-B-06 (one owner per property per profile)
 *  surfaces it in validation; duplication is the explicit authoring fork. */
export function duplicateTrack(trackId: string): string | null {
  const m = getManifest();
  const src = m.tracks.find((t) => t.id === trackId);
  if (!src) return null;
  const copy: Track = {
    ...src,
    id: newNodeId('trk'),
    label: `${src.label} copy`,
    keyframes: src.keyframes.map((k) => ({ ...k, v: [...k.v] })),
  };
  dispatch({ type: 'set', path: 'tracks', value: [...m.tracks, copy] });
  return copy.id;
}
