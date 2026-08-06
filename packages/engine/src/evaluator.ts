/**
 * Timeline evaluator (prototype-scale mirror of Doc 04 §4).
 * Pure & deterministic: evaluate(tracks, progress) → EvaluatedState.
 * Same input always yields identical output (FR-153); no internal clocks.
 * Per-frame path avoids allocation by writing into pre-allocated buffers.
 * Pure move to @bs/engine package (WS2-1c).
 */
import type { Track, Keyframe } from './commands/types';

export interface EvaluatedState {
  /** channel key `${target}.${channel}` → value buffer */
  channels: Map<string, Float64Array>;
}

const smooth = (u: number) => u * u * (3 - 2 * u);

/** Deterministic cubic-bezier easing y(x) for control points (x1,y1,x2,y2)
 *  (Phase 2.5 — FR-152, 04 GraphEditor/AnimationCurves). Allocation-free:
 *  Newton–Raphson with bisection fallback, fixed iteration counts. */
function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sampleDX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
  let u = x;
  for (let i = 0; i < 6; i++) {
    const d = sampleDX(u);
    if (Math.abs(d) < 1e-6) break;
    u -= (sampleX(u) - x) / d;
  }
  if (u < 0 || u > 1 || Math.abs(sampleX(u) - x) > 1e-4) {
    // bisection fallback keeps the result exact and deterministic (FR-153)
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      u = (lo + hi) / 2;
      if (sampleX(u) < x) lo = u;
      else hi = u;
    }
  }
  return ((ay * u + by) * u + cy) * u;
}

function sampleTrack(kfs: Keyframe[], t: number, out: Float64Array): void {
  if (kfs.length === 0) return;
  if (t <= kfs[0].t) {
    for (let i = 0; i < out.length; i++) out[i] = kfs[0].v[i];
    return;
  }
  const last = kfs[kfs.length - 1];
  if (t >= last.t) {
    for (let i = 0; i < out.length; i++) out[i] = last.v[i];
    return;
  }
  // binary search for span (keyframes pre-sorted by t — Doc 04 §4.1)
  let lo = 0;
  let hi = kfs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (kfs[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = kfs[lo];
  const b = kfs[hi];
  let u = (t - a.t) / (b.t - a.t);
  const ease = b.ease ?? 'smooth';
  if (ease === 'smooth') u = smooth(u);
  else if (ease === 'bezier') {
    const cp = b.bezier ?? [0.4, 0, 0.2, 1];
    u = cubicBezier(cp[0], cp[1], cp[2], cp[3], u);
  }
  for (let i = 0; i < out.length; i++) out[i] = a.v[i] + (b.v[i] - a.v[i]) * u;
}

/** Editor-rate sampling helper (allocating; used for add-keyframe-at-playhead). */
export function sampleKeyframes(kfs: Keyframe[], t: number): number[] {
  const out = new Float64Array(kfs[0]?.v.length ?? 3);
  sampleTrack(kfs, t, out);
  return Array.from(out);
}

/** Keyframe span per channel key (Phase 3 — audit A-7, 04 ObjectAnimation):
 *  outside its span a track releases ownership back to the manifest base
 *  value, so inspector writes stay live before/after the animated range. */
export function channelSpans(tracks: Track[]): Map<string, [number, number]> {
  const spans = new Map<string, [number, number]>();
  for (const t of tracks) {
    if (t.keyframes.length === 0) continue;
    spans.set(`${t.target}.${t.channel}`, [t.keyframes[0].t, t.keyframes[t.keyframes.length - 1].t]);
  }
  return spans;
}

/** Structural identity of a track list — when this changes (track added,
 *  removed, or retargeted) consumers must rebuild their evaluator (audit A-8).
 *  Keyframe-level edits do NOT change the signature (buffers stay valid). */
export function trackSignature(tracks: Track[]): string {
  return tracks.map((t) => `${t.id}|${t.target}|${t.channel}`).join(';');
}

export function createEvaluator(tracks: Track[]) {
  const state: EvaluatedState = { channels: new Map() };
  for (const track of tracks) {
    state.channels.set(
      `${track.target}.${track.channel}`,
      new Float64Array(track.keyframes[0]?.v.length ?? 3),
    );
  }
  return {
    /** Allocation-free per-frame evaluation. */
    evaluate(progress: number): EvaluatedState {
      for (const track of tracks) {
        const buf = state.channels.get(`${track.target}.${track.channel}`)!;
        sampleTrack(track.keyframes, progress, buf);
      }
      return state;
    },
  };
}
