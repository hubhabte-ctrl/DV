/**
 * Scene3DShotBar   " 3D Studio's cinematography context strip (Spec 07   4).
 * Purpose-driven replacement for the shared TimelineBar in 3D mode: a thin
 * [0,1] scrub with section bands and read-only camera keyframe ticks, plus a
 * deep link into Animation Studio for authoring. Artists *check* motion in
 * spatial context here; they *author* it in Animation Studio.
 *
 * IL-1: read-only over the manifest. IL-2: binds to the canonical clock.
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
import { setUIState } from '@bs/engine';

export function Scene3DShotBar() {
  const [, force] = useState(0);
  const [progress, setLocalProgress] = useState(getProgress());
  const [playing, setPlaying] = useState(isPlaying());
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeManifest(() => force((n) => n + 1)), []);
  useEffect(() => subscribeProgress(setLocalProgress), []);
  useEffect(() => subscribePlaying(setPlaying), []);

  const m = getManifest();
  const cameraIds = new Set(
    Object.values(m.sceneNodes)
      .filter((n) => n.type === 'camera')
      .map((n) => n.id),
  );
  const activeCamera = Object.values(m.sceneNodes).find((n) => n.type === 'camera');
  const cameraTracks = m.tracks.filter((t) => cameraIds.has(t.target) || t.channel.startsWith('camera'));
  const firstCameraTrack = cameraTracks[0];

  const scrubTo = (clientX: number): void => {
    const el = stripRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setProgress(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
  };

  return (
    <div className="bs-shotbar" role="region" aria-label="Shot bar">
      <button
        className="bs-shotbar__play"
        title={playing ? 'Pause (Space)' : 'Play through (Space)'}
        aria-label={playing ? 'Pause' : 'Play'}
        onClick={() => (playing ? pause() : play())}
      >
        {playing ? Icons.pause : Icons.play}
      </button>
      <span className="bs-shotbar__readout">{progress.toFixed(3)}</span>
      {activeCamera && (
        <span className="bs-shotbar__camera" title="Active camera">
          {Icons.video ?? Icons.cube} {activeCamera.label}
        </span>
      )}

      <div
        ref={stripRef}
        className="bs-shotbar__strip"
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
        {m.sections.map((s) => (
          <div
            key={s.id}
            className="bs-shotbar__band"
            style={{ '--flow-left': `${s.range[0] * 100}%`, '--flow-width': `${(s.range[1] - s.range[0]) * 100}%` } as React.CSSProperties}
            title={s.name}
          />
        ))}
        {cameraTracks.flatMap((t) =>
          t.keyframes.map((k, i) => (
            <div
              key={`${t.id}-${i}`}
              className="bs-shotbar__key"
              style={{ '--flow-left': `${k.t * 100}%` } as React.CSSProperties}
              title={`${t.label} @ ${k.t.toFixed(2)}`}
            />
          )),
        )}
        <div className="bs-shotbar__playhead" style={{ '--flow-left': `${progress * 100}%` } as React.CSSProperties} />
      </div>

      <button
        className="bs-shotbar__edit"
        title="Author camera and object motion in Animation Studio"
        onClick={() =>
          setUIState({ mode: 'animate', ...(firstCameraTrack ? { selectedTrackId: firstCameraTrack.id } : {}) })
        }
      >
        Edit in Animation Studio {Icons.chevronRight ?? '->'}
      </button>
    </div>
  );
}
