/**
 * Evaluator regression tests (Phase 0.1   " FR-153 determinism, Doc 04   4).
 * The evaluator must be pure: same (tracks, progress)   ' identical output,
 * across calls and across instances, with no internal clocks.
 */
// @ts-ignore
import { describe, expect, it } from 'vitest';
import { createEvaluator, sampleKeyframes, trackSignature } from '@bs/engine';
import type { Track } from '@bs/engine';

const linearTrack: Track = {
  id: 'trk-a',
  label: 'A',
  target: 'node-a',
  channel: 'position',
  keyframes: [
    { t: 0, v: [0, 0, 0], ease: 'linear' },
    { t: 1, v: [10, 20, 30], ease: 'linear' },
  ],
};

const smoothTrack: Track = {
  id: 'trk-b',
  label: 'B',
  target: 'node-b',
  channel: 'opacity',
  keyframes: [
    { t: 0.2, v: [0], ease: 'smooth' },
    { t: 0.8, v: [10], ease: 'smooth' },
  ],
};

describe('evaluator (FR-153)', () => {
  it('is deterministic: same input yields identical output across instances', () => {
    const a = createEvaluator([linearTrack, smoothTrack]);
    const b = createEvaluator([linearTrack, smoothTrack]);
    for (const p of [0, 0.1, 0.33, 0.5, 0.77, 1]) {
      const sa = a.evaluate(p);
      const sb = b.evaluate(p);
      for (const [key, bufA] of sa.channels) {
        const bufB = sb.channels.get(key)!;
        expect(Array.from(bufA)).toEqual(Array.from(bufB));
      }
      // repeat call with same progress   ' identical values (no hidden state)
      const sa2 = a.evaluate(p);
      expect(Array.from(sa2.channels.get('node-a.position')!)).toEqual(
        Array.from(b.evaluate(p).channels.get('node-a.position')!),
      );
    }
  });

  it('clamps before the first and after the last keyframe', () => {
    const e = createEvaluator([smoothTrack]);
    expect(e.evaluate(0).channels.get('node-b.opacity')![0]).toBe(0);
    expect(e.evaluate(0.1).channels.get('node-b.opacity')![0]).toBe(0);
    expect(e.evaluate(0.9).channels.get('node-b.opacity')![0]).toBe(10);
    expect(e.evaluate(1).channels.get('node-b.opacity')![0]).toBe(10);
  });

  it('interpolates linearly when ease=linear', () => {
    const e = createEvaluator([linearTrack]);
    const buf = e.evaluate(0.5).channels.get('node-a.position')!;
    expect(Array.from(buf)).toEqual([5, 10, 15]);
  });

  it('applies smoothstep when ease=smooth', () => {
    const e = createEvaluator([smoothTrack]);
    // u = (0.35 - 0.2) / 0.6 = 0.25   ' smoothstep(0.25) = 0.15625   ' 1.5625
    const buf = e.evaluate(0.35).channels.get('node-b.opacity')!;
    expect(buf[0]).toBeCloseTo(1.5625, 10);
  });

  it('is allocation-free per frame: buffers keep identity across evaluations', () => {
    const e = createEvaluator([linearTrack]);
    const buf1 = e.evaluate(0.2).channels.get('node-a.position');
    const buf2 = e.evaluate(0.9).channels.get('node-a.position');
    expect(buf1).toBe(buf2); // same Float64Array instance, values rewritten
  });

  it('sampleKeyframes matches the per-frame evaluation path', () => {
    const e = createEvaluator([linearTrack]);
    const buf = e.evaluate(0.4).channels.get('node-a.position')!;
    expect(sampleKeyframes(linearTrack.keyframes, 0.4)).toEqual(Array.from(buf));
  });
});

describe('trackSignature (audit A-8   " evaluator rebuild trigger)', () => {
  it('changes when a track is added, removed, or retargeted', () => {
    const base = trackSignature([linearTrack]);
    expect(trackSignature([linearTrack, smoothTrack])).not.toBe(base);
    expect(trackSignature([])).not.toBe(base);
    expect(trackSignature([{ ...linearTrack, target: 'other' }])).not.toBe(base);
    expect(trackSignature([{ ...linearTrack, channel: 'rotation' }])).not.toBe(base);
  });

  it('does NOT change on keyframe-level edits', () => {
    const base = trackSignature([linearTrack]);
    const edited: Track = {
      ...linearTrack,
      keyframes: [
        { t: 0, v: [1, 1, 1], ease: 'smooth' },
        { t: 0.5, v: [2, 2, 2], ease: 'linear' },
        { t: 1, v: [3, 3, 3], ease: 'linear' },
      ],
    };
    expect(trackSignature([edited])).toBe(base);
  });
});
