/**
 * DOMViewport controls & stage layer components (WS2-3b).
 * Pure move from DOMViewport.tsx (IL-11 behavior-identical).
 */
import { useEffect, useRef } from 'react';
import { getManifest, subscribeManifest } from '@bs/engine';
import { getProgress, pause, setProgress, subscribeProgress } from '../../../../engine/progress';
import { useUIState } from '@bs/engine';
import { Scene3DViewport } from '../scene3d-viewport/Scene3DViewport';
import { ALIGN_BUTTONS, alignSelection } from '../../../../engine/domCanvasHelpers';

/** Section minimap (v4 reference .minimap): one cell per section; the active
 *  cell tracks the clock via direct class writes (IL-2). Click jumps to the
 *  section's progress range start. */
function SectionMinimap() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sections = getManifest().sections;

  useEffect(() => {
    const apply = (p: number) => {
      const cells = wrapRef.current?.children;
      if (!cells) return;
      const secs = getManifest().sections;
      for (let i = 0; i < cells.length; i++) {
        const s = secs[i];
        const on = !!s && p >= s.range[0] && (p < s.range[1] || (p === 1 && s.range[1] === 1));
        cells[i].classList.toggle('on', on);
      }
    };
    apply(getProgress());
    return subscribeProgress(apply);
  }, [sections.length]);

  return (
    <div className="bs-minimap" ref={wrapRef} aria-label="Section minimap">
      {sections.map((s) => (
        <button
          key={s.id}
          className="bs-minimap__cell"
          title={`${s.name}  * ${Math.round(s.range[0] * 100)}  "${Math.round(s.range[1] * 100)}%`}
          onClick={() => setProgress(s.range[0])}
        />
      ))}
    </div>
  );
}

/** Scroll progress rail (v4 reference .scroll-rail): percentage readout plus a
 *  scrubbable track. Fill/knob/label update via refs per-frame (IL-2). */
function ScrollRail() {
  const pctRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);

  useEffect(() => {
    const apply = (p: number) => {
      const pct = `${(p * 100).toFixed(1)}%`;
      if (fillRef.current) fillRef.current.style.width = pct;
      if (knobRef.current) knobRef.current.style.left = pct;
      if (pctRef.current) pctRef.current.textContent = `${Math.round(p * 100)}%`;
      trackRef.current?.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    };
    apply(getProgress());
    return subscribeProgress(apply);
  }, []);

  const scrubTo = (e: React.PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setProgress((e.clientX - rect.left) / rect.width);
  };

  return (
    <div className="bs-scrollrail">
      <span className="bs-scrollrail__pct" ref={pctRef}>
        0%
      </span>
      <div
        className="bs-scrollrail__track"
        role="slider"
        aria-label="Scroll progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        tabIndex={0}
        ref={trackRef}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.1 : 0.01;
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            pause();
            setProgress(getProgress() + step);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            pause();
            setProgress(getProgress() - step);
          } else if (e.key === 'Home') {
            e.preventDefault();
            setProgress(0);
          } else if (e.key === 'End') {
            e.preventDefault();
            setProgress(1);
          }
        }}
        onPointerDown={(e) => {
          pause();
          scrubbing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          scrubTo(e);
        }}
        onPointerMove={(e) => {
          if (scrubbing.current) scrubTo(e);
        }}
        onPointerUp={() => {
          scrubbing.current = false;
        }}
      >
        <div className="bs-scrollrail__ticks" aria-hidden>
          {Array.from({ length: 11 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
        <div className="bs-scrollrail__fill" ref={fillRef} />
        <div className="bs-scrollrail__knob" ref={knobRef} />
      </div>
    </div>
  );
}

/** Floating align/distribute toolbar   " appears with 2+ selected elements. */
function AlignToolbar() {
  const ids = useUIState((s) => s.selectedDomNodeIds);
  const profile = useUIState((s) => s.profile);
  if (ids.length < 2) return null;
  return (
    <div className="bs-aligntb" role="toolbar" aria-label="Align and distribute">
      {ALIGN_BUTTONS.map((b: any) => (
        <button key={b.op} title={b.title} onClick={() => alignSelection(b.op, profile)}>
          {b.icon}
        </button>
      ))}
      <span className="bs-aligntb__count">{ids.length} selected</span>
    </div>
  );
}

/** The scroll-driven 3D stage (issues.md): a first-class editable layer of the
 *  DOM Studio. Its settings live in `manifest.stage` (Layers row + Inspector);
 *  per-frame section gating writes styles directly (IL-2)   " React never runs
 *  on the scroll path. */
function StageLayer({
  pageRef,
  scrollerRef,
}: {
  pageRef?: React.RefObject<HTMLDivElement | null>;
  scrollerRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const zoom = useUIState((s) => s.canvasZoom);
  const profile = useUIState((s) => s.profile);

  useEffect(() => {
    const apply = () => {
      const el = ref.current;
      if (!el) return;
      const m = getManifest();
      const stage = m.stage;
      const p = getProgress();
      let active = stage.visible;
      if (active && stage.mode === 'section') {
        const sec = m.sections.find((s) => s.id === stage.sectionId) ?? m.sections[0];
        active = !!sec && p >= sec.range[0] && (p < sec.range[1] || (sec.range[1] === 1 && p <= 1));
      }
      el.style.opacity = active ? String(stage.opacity) : '0';
      el.style.zIndex = stage.placement === 'overlay' ? '4' : '0';

      // Clip stage layer to the page card bounds so 3D background never bleeds into workspace grid
      const page = pageRef?.current;
      const root = el.parentElement;
      if (page && root) {
        const pr = page.getBoundingClientRect();
        const rr = root.getBoundingClientRect();
        const top = Math.max(0, Math.round(pr.top - rr.top));
        const bottom = Math.max(0, Math.round(rr.bottom - pr.bottom));
        const left = Math.max(0, Math.round(pr.left - rr.left));
        const right = Math.max(0, Math.round(rr.right - pr.right));
        el.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px)`;
      }
    };
    apply();
    const unsubProgress = subscribeProgress(apply);
    const unsubManifest = subscribeManifest(apply);

    const scroller = scrollerRef?.current;
    scroller?.addEventListener('scroll', apply, { passive: true });
    window.addEventListener('resize', apply);

    const page = pageRef?.current;
    let ro: ResizeObserver | null = null;
    if (page) {
      ro = new ResizeObserver(apply);
      ro.observe(page);
    }

    return () => {
      unsubProgress();
      unsubManifest();
      scroller?.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      ro?.disconnect();
    };
  }, [pageRef, scrollerRef, zoom, profile]);

  return (
    <div
      className="bs-domcanvas__stage"
      ref={ref}
      style={{ pointerEvents: 'none', transition: 'opacity 240ms ease' }}
      aria-label="Scroll-driven 3D scene"
    >
      <Scene3DViewport navigation="track" chrome={false} />
    </div>
  );
}
