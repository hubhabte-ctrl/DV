/**
 * Graph editor   " the Timeline Panel's graph mode (Spec 07   5: toggle `G`,
 * replaces the dope sheet in place; absorbs the former shell/AnimateGraphEditor.tsx   "
 * FR-152, 04 AnimateGraphEditor / 04 AnimationCurves). Renders the selected track as
 * a value-vs-progress curve: keyframe points drag in both axes, per-key ease
 * switches between linear / smooth / bezier, bezier segments expose draggable
 * tangent handles, and an easing preset shelf applies common curves. All
 * writes go through the command engine (IL-1) and coalesce per gesture (one
 * drag = one undo step). Locked tracks are read-only (04 TimelineEditor   2).
 */
import { useEffect, useRef, useState } from 'react';
import { toast } from '../../../../app/ui/Toast';
import {
  getManifest,
  getTrack,
  setTrackKeyframes,
  subscribeManifest,
  type Keyframe,
} from '@bs/engine';
import { sampleKeyframes } from '@bs/engine';
import { getProgress, pause, setProgress, subscribeProgress } from '../../../../engine/progress';
import { setUIState, useUIState } from '@bs/engine';

const W = 1000;
const H = 240;
const PAD = { l: 46, r: 12, t: 14, b: 20 };
const DEFAULT_BEZIER: [number, number, number, number] = [0.4, 0, 0.2, 1];

/** Easing preset shelf (Spec 07   5)   " canonical cubic-bezier vocabulary. */
const EASE_PRESETS: { label: string; cp: [number, number, number, number] }[] = [
  { label: 'Ease in', cp: [0.42, 0, 1, 1] },
  { label: 'Ease out', cp: [0, 0, 0.58, 1] },
  { label: 'Ease in-out', cp: [0.42, 0, 0.58, 1] },
  { label: 'Standard', cp: [0.4, 0, 0.2, 1] },
];

interface DragState {
  kind: 'key' | 'h1' | 'h2';
  /** identity by original t (indices shift when sorted) */
  fromT: number;
  currentT: number;
}

export function AnimateGraphEditor() {
  const selTrack = useUIState((s) => s.selectedTrackId);
  const selKeyT = useUIState((s) => s.selectedKeyframeT);
  const [component, setComponent] = useState(0);
  const [, force] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const playheadRef = useRef<SVGLineElement>(null);
  const drag = useRef<DragState | null>(null);

  useEffect(() => subscribeManifest(() => force((n) => n + 1)), []);

  const track = selTrack ? getTrack(selTrack) : getManifest().tracks[0];
  const locked = track?.locked === true;
  const dims = track?.keyframes[0]?.v.length ?? 1;
  const c = Math.min(component, dims - 1);

  /* value   ' y scale from the track's own range (10% padding) */
  let vMin = 0;
  let vMax = 1;
  if (track && track.keyframes.length > 0) {
    vMin = Math.min(...track.keyframes.map((k) => k.v[c] ?? 0));
    vMax = Math.max(...track.keyframes.map((k) => k.v[c] ?? 0));
    if (vMax - vMin < 1e-6) {
      vMin -= 0.5;
      vMax += 0.5;
    }
    const pad = (vMax - vMin) * 0.1;
    vMin -= pad;
    vMax += pad;
  }
  const toX = (t: number) => PAD.l + t * (W - PAD.l - PAD.r);
  const toY = (v: number) => H - PAD.b - ((v - vMin) / (vMax - vMin)) * (H - PAD.t - PAD.b);
  const fromX = (x: number) => Math.max(0, Math.min(1, (x - PAD.l) / (W - PAD.l - PAD.r)));
  const fromY = (y: number) => vMin + ((H - PAD.b - y) / (H - PAD.t - PAD.b)) * (vMax - vMin);

  /* playhead line follows the one clock via refs   " never through React (IL-2) */
  useEffect(() => {
    const apply = (p: number) => {
      playheadRef.current?.setAttribute('x1', String(toX(p)));
      playheadRef.current?.setAttribute('x2', String(toX(p)));
    };
    apply(getProgress());
    return subscribeProgress(apply);
  });

  if (!track) {
    return (
      <div className="tl-graph tl-graph--empty bs-muted">
        Select a track (left list or dope sheet) to edit its curve.
      </div>
    );
  }

  const kfs = track.keyframes;

  const svgPoint = (e: React.PointerEvent): { x: number; y: number } => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  /* sampled curve polyline   " evaluator output, so what you see IS what plays */
  const steps = 160;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const v = sampleKeyframes(kfs, t)[c] ?? 0;
    pts.push(`${toX(t).toFixed(1)},${toY(v).toFixed(1)}`);
  }

  const updateKey = (fromT: number, patch: (k: Keyframe) => Keyframe, coalesce = true) => {
    if (locked) {
      toast('Track is locked — unlock it to edit the curve');
      return;
    }
    setTrackKeyframes(
      track.id,
      kfs.map((k) => (Math.abs(k.t - fromT) < 1e-6 ? patch(k) : k)),
      coalesce,
    );
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const { x, y } = svgPoint(e);
    if (d.kind === 'key') {
      const t = Math.round(fromX(x) * 100) / 100;
      const v = fromY(y);
      updateKey(d.currentT, (k) => {
        const nv = [...k.v];
        nv[c] = Number(v.toFixed(3));
        return { ...k, t, v: nv };
      });
      d.currentT = t;
      setUIState({ selectedKeyframeT: t });
    } else {
      /* bezier handle drag: convert back to normalized segment space */
      const i = kfs.findIndex((k) => Math.abs(k.t - d.currentT) < 1e-6);
      const a = kfs[i - 1];
      const b = kfs[i];
      if (!a || !b) return;
      const dt = b.t - a.t || 1e-6;
      const dv = (b.v[c] ?? 0) - (a.v[c] ?? 0);
      const nx = Math.max(0, Math.min(1, (fromX(x) - a.t) / dt));
      const ny = dv === 0 ? (d.kind === 'h1' ? 0 : 1) : (fromY(y) - (a.v[c] ?? 0)) / dv;
      updateKey(d.currentT, (k) => {
        const cp: [number, number, number, number] = [...(k.bezier ?? DEFAULT_BEZIER)];
        if (d.kind === 'h1') {
          cp[0] = Number(nx.toFixed(3));
          cp[1] = Number(ny.toFixed(3));
        } else {
          cp[2] = Number(nx.toFixed(3));
          cp[3] = Number(ny.toFixed(3));
        }
        return { ...k, ease: 'bezier', bezier: cp };
      });
    }
  };

  const selKey = selKeyT !== null ? kfs.find((k) => Math.abs(k.t - selKeyT) < 1e-6) : undefined;

  return (
    <div className="tl-graph">
      <div className="tl-graph__toolbar">
        <span className="tl-graph__title">
          {track.label}  * {track.channel}
          {locked ? '  * locked' : ''}
        </span>
        {dims > 1 && (
          <span className="tl-graph__dims" role="group" aria-label="Curve component">
            {Array.from({ length: Math.min(dims, 3) }, (_, i) => (
              <button
                key={i}
                className={`uk-filterchip ${c === i ? 'uk-filterchip--on' : ''}`}
                onClick={() => setComponent(i)}
              >
                {['X', 'Y', 'Z'][i]}
              </button>
            ))}
          </span>
        )}
        <span className="bs-spacer" />
        {selKey && (
          <span className="tl-graph__ease" role="group" aria-label="Keyframe ease">
            {(['linear', 'smooth', 'bezier'] as const).map((ease) => (
              <button
                key={ease}
                className={`uk-filterchip ${(selKey.ease ?? 'smooth') === ease ? 'uk-filterchip--on' : ''}`}
                onClick={() =>
                  updateKey(
                    selKey.t,
                    (k) => ({
                      ...k,
                      ease,
                      bezier: ease === 'bezier' ? (k.bezier ?? DEFAULT_BEZIER) : k.bezier,
                    }),
                    false,
                  )
                }
              >
                {ease}
              </button>
            ))}
          </span>
        )}
        {/* easing preset shelf (Spec 07   5)   " one click sets a bezier curve */}
        {selKey && (
          <span className="tl-graph__presets" role="group" aria-label="Easing presets">
            {EASE_PRESETS.map((p) => {
              const active =
                (selKey.ease ?? 'smooth') === 'bezier' &&
                (selKey.bezier ?? DEFAULT_BEZIER).every((v, i) => Math.abs(v - p.cp[i]) < 1e-6);
              return (
                <button
                  key={p.label}
                  className={`uk-filterchip ${active ? 'uk-filterchip--on' : ''}`}
                  title={`cubic-bezier(${p.cp.join(', ')})`}
                  onClick={() =>
                    updateKey(selKey.t, (k) => ({ ...k, ease: 'bezier', bezier: [...p.cp] }), false)
                  }
                >
                  {p.label}
                </button>
              );
            })}
          </span>
        )}
        <span className="tl-graph__range bs-mono">
          {vMin.toFixed(2)}     {vMax.toFixed(2)}
        </span>
      </div>
      <svg
        ref={svgRef}
        className="tl-graph__svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        onPointerDown={(e) => {
          if (drag.current) return;
          pause();
          setProgress(fromX(svgPoint(e).x)); // background scrub   " one clock (IL-2)
        }}
        onPointerMove={onPointerMove}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {/* grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={toX(t)} y1={PAD.t} x2={toX(t)} y2={H - PAD.b} className="tl-graph__grid" />
        ))}
        {[0, 0.5, 1].map((f) => {
          const v = vMin + f * (vMax - vMin);
          return (
            <g key={f}>
              <line x1={PAD.l} y1={toY(v)} x2={W - PAD.r} y2={toY(v)} className="tl-graph__grid" />
              <text x={6} y={toY(v) + 3} className="tl-graph__axis">
                {v.toFixed(1)}
              </text>
            </g>
          );
        })}
        {/* evaluated curve */}
        <polyline points={pts.join(' ')} className="tl-graph__curve" />
        {/* bezier handles for the segment ENDING at each bezier key */}
        {kfs.map((k, i) => {
          if ((k.ease ?? 'smooth') !== 'bezier' || i === 0) return null;
          const a = kfs[i - 1];
          const cp = k.bezier ?? DEFAULT_BEZIER;
          const dt = k.t - a.t;
          const dv = (k.v[c] ?? 0) - (a.v[c] ?? 0);
          const h1 = { x: toX(a.t + cp[0] * dt), y: toY((a.v[c] ?? 0) + cp[1] * dv) };
          const h2 = { x: toX(a.t + cp[2] * dt), y: toY((a.v[c] ?? 0) + cp[3] * dv) };
          return (
            <g key={`bz-${i}`}>
              <line
                x1={toX(a.t)}
                y1={toY(a.v[c] ?? 0)}
                x2={h1.x}
                y2={h1.y}
                className="tl-graph__handle-line"
              />
              <line
                x1={toX(k.t)}
                y1={toY(k.v[c] ?? 0)}
                x2={h2.x}
                y2={h2.y}
                className="tl-graph__handle-line"
              />
              {(['h1', 'h2'] as const).map((kind) => {
                const p = kind === 'h1' ? h1 : h2;
                return (
                  <circle
                    key={kind}
                    cx={p.x}
                    cy={p.y}
                    r={5}
                    className="tl-graph__handle"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (locked) return;
                      (e.target as Element).setPointerCapture(e.pointerId);
                      drag.current = { kind, fromT: k.t, currentT: k.t };
                      setUIState({ selectedTrackId: track.id, selectedKeyframeT: k.t });
                    }}
                  />
                );
              })}
            </g>
          );
        })}
        {/* keyframe points */}
        {kfs.map((k, i) => {
          const selected = selKeyT !== null && Math.abs(k.t - selKeyT) < 1e-6;
          return (
            <circle
              key={`k-${i}`}
              cx={toX(k.t)}
              cy={toY(k.v[c] ?? 0)}
              r={selected ? 7 : 5.5}
              className={`tl-graph__key ${selected ? 'tl-graph__key--sel' : ''}`}
              onPointerDown={(e) => {
                e.stopPropagation();
                setUIState({ selectedTrackId: track.id, selectedKeyframeT: k.t });
                setProgress(k.t);
                if (locked) return;
                (e.target as Element).setPointerCapture(e.pointerId);
                drag.current = { kind: 'key', fromT: k.t, currentT: k.t };
              }}
            />
          );
        })}
        {/* playhead */}
        <line ref={playheadRef} y1={PAD.t} y2={H - PAD.b} className="tl-graph__playhead" />
      </svg>
    </div>
  );
}
