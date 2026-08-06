/**
 * DOMFlowStrip   " DOM Studio's scroll storyboard (Spec 07   3).
 * Purpose-driven replacement for the shared TimelineBar in DOM mode: a
 * horizontal band of section spans on the [0,1] scroll progress axis with
 * waypoint markers and a scrub handle. No tracks, no keyframes   " motion is
 * authored in Animation Studio (deep link per section band).
 *
 * IL-1: no direct manifest mutation. IL-2: binds to the canonical @bs/runtime
 * progress clock   " scrubbing here drives DOM canvas and the 3D stage alike.
 */
import { useEffect, useRef, useState } from 'react';
import { Icons } from '../../../../app/ui/Icons';
import { getManifest, subscribeManifest } from '@bs/engine';
import {
  getProgress,
  isPlaying,
  pause,
  play,
  setProgress,
  subscribePlaying,
  subscribeProgress,
} from '../../../../engine/progress';
import { setUIState, useUIState } from '@bs/engine';

export function DOMFlowStrip() {
  const [, force] = useState(0);
  const [progress, setLocalProgress] = useState(getProgress());
  const [playing, setPlaying] = useState(isPlaying());
  const bandRef = useRef<HTMLDivElement>(null);
  const selectedWaypointId = useUIState((s) => s.selectedWaypointId);

  useEffect(() => subscribeManifest(() => force((n) => n + 1)), []);
  useEffect(() => subscribeProgress(setLocalProgress), []);
  useEffect(() => subscribePlaying(setPlaying), []);

  const m = getManifest();
  const sections = m.sections;

  const scrubTo = (clientX: number): void => {
    const el = bandRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setProgress(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
  };

  return (
    <div className="bs-flowstrip" role="region" aria-label="Scroll flow storyboard">
      <div className="bs-flowstrip__transport">
        <button
          className="bs-flowstrip__play"
          title={playing ? 'Pause (Space)' : 'Play through (Space)'}
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={() => (playing ? pause() : play())}
        >
          {playing ? Icons.pause : Icons.play}
        </button>
        <span className="bs-flowstrip__readout">{progress.toFixed(3)}</span>
      </div>

      <div
        ref={bandRef}
        className="bs-flowstrip__band"
        role="slider"
        aria-label="Scroll progress"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={Number(progress.toFixed(3))}
        tabIndex={0}
        onPointerDown={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          scrubTo(e.clientX);
          const onMove = (ev: PointerEvent) => scrubTo(ev.clientX);
          const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
          };
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') setProgress(Math.min(1, getProgress() + 0.01));
          else if (e.key === 'ArrowLeft') setProgress(Math.max(0, getProgress() - 0.01));
        }}
      >
        {sections.map((s) => {
          const [r0, r1] = s.range;
          const active = progress >= r0 && progress <= r1;
          return (
            <div
              key={s.id}
              className={`bs-flowstrip__section ${active ? 'bs-flowstrip__section--active' : ''}`}
              style={{ '--flow-left': `${r0 * 100}%`, '--flow-width': `${(r1 - r0) * 100}%` } as React.CSSProperties}
              title={`${s.name} · ${r0.toFixed(2)}—${r1.toFixed(2)}`}
            >
              <span className="bs-flowstrip__section-name">{s.name}</span>
              <button
                className="bs-flowstrip__animate"
                title="Animate this range in Animation Studio"
                aria-label={`Animate ${s.name} in Animation Studio`}
                onClick={(e) => {
                  e.stopPropagation();
                  setProgress(r0);
                  setUIState({ mode: 'animate' });
                }}
              >
                {Icons.clock ?? '  '}
              </button>
            </div>
          );
        })}

        {m.waypoints.map((w) => (
          <button
            key={w.id}
            className={`bs-flowstrip__waypoint ${w.anchorId ? '' : 'bs-flowstrip__waypoint--unbound'} ${
              selectedWaypointId === w.id ? 'bs-flowstrip__waypoint--selected' : ''
            }`}
            style={{ '--flow-left': `${w.range[0] * 100}%` } as React.CSSProperties}
            title={`Waypoint · ${w.label}${w.anchorId ? '' : ' (no anchor bound)'}`}
            aria-label={`Select waypoint ${w.label}`}
            onClick={(e) => {
              e.stopPropagation();
              setUIState({ selectedWaypointId: w.id });
            }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ))}

        <div className="bs-flowstrip__playhead" style={{ '--flow-left': `${progress * 100}%` } as React.CSSProperties} />
      </div>
    </div>
  );
}
