/**
 * The one canonical progress clock — [0,1] (PRD-INV-01, IL-2).
 * Module-scoped Float64Array per Doc 04 §5.1; per-frame consumers subscribe
 * directly and bypass React entirely (Doc 04 §5 bridge rule).
 * Pure move to @bs/runtime package (WS2-1b).
 */
const buf = new Float64Array(1);

type Listener = (p: number) => void;
const listeners = new Set<Listener>();

export function getProgress(): number {
  return buf[0];
}

export function setProgress(p: number): void {
  const clamped = p < 0 ? 0 : p > 1 ? 1 : p;
  if (Math.abs(clamped - buf[0]) < 1e-9) return;
  buf[0] = clamped;
  for (const l of listeners) l(clamped);
}

export function subscribeProgress(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Time-based playback is a simulation of progress, never a second clock (ADR-001). */
let playing = false;
let rafId = 0;
const playListeners = new Set<(playing: boolean) => void>();

/** Loop toggle (Phase 2.5 — audit T-3): playback wraps at 1 instead of stopping. */
let looping = false;
const loopListeners = new Set<(looping: boolean) => void>();

export function isLooping(): boolean {
  return looping;
}
export function setLoop(v: boolean): void {
  looping = v;
  loopListeners.forEach((l) => l(v));
}
export function subscribeLoop(l: (looping: boolean) => void): () => void {
  loopListeners.add(l);
  return () => loopListeners.delete(l);
}

export function isPlaying(): boolean {
  return playing;
}
export function subscribePlaying(l: (p: boolean) => void): () => void {
  playListeners.add(l);
  return () => playListeners.delete(l);
}

export function play(durationSec = 12): void {
  if (playing) return;
  playing = true;
  playListeners.forEach((l) => l(true));
  let last = performance.now();
  const step = (now: number) => {
    if (!playing) return;
    const dt = (now - last) / 1000;
    last = now;
    let next = getProgress() + dt / durationSec;
    if (next >= 1) {
      if (looping) {
        // wrap: playback remains a simulation of the ONE progress clock (ADR-001)
        buf[0] = 0;
        next = next - 1;
      } else {
        next = 1;
        pause();
      }
    }
    setProgress(next);
    if (playing) rafId = requestAnimationFrame(step);
  };
  if (getProgress() >= 1) buf[0] = 0;
  rafId = requestAnimationFrame(step);
}

export function pause(): void {
  playing = false;
  cancelAnimationFrame(rafId);
  playListeners.forEach((l) => l(false));
}
