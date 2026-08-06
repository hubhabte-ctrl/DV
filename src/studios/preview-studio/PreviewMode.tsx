/**
 * PreviewMode   " Production-Quality Published Preview Workspace.
 *
 * Architecture:
 *  - PreviewStage: Three.js WebGL canvas pinned `position: absolute; inset: 0; z-index: 0`
 *    inside its parent   " fully transparent background (chrome=false / setChrome(false))
 *    so it renders the 3D model without any backdrop, visible through section overlays.
 *  - DOM Content: DOMNodeView sections rendered above the 3D canvas (z-index: 1) with
 *    transparent section backgrounds so the 3D model shines through.
 *  - Scroll drives progress clock [0, 1] (PRD-INV-01). GSAP never owns the clock.
 *  - Scaling: auto-computed `transform: scale(...)` so preset widths (1440/768/390) fit
 *    developer screens of any size   " isolated from browser viewport CSS.
 */
import { useEffect, useRef, useState } from 'react';
import { getManifest, subscribeManifest } from '@bs/engine';
import { getProgress, setProgress, subscribeProgress } from '../../engine/progress';
import { setUIState, useUIState } from '@bs/engine';
import { Icons } from '../../app/ui/Icons';
import { Scene3DViewport } from './components/scene3d-viewport/Scene3DViewport';
import { DOMNodeView } from './components/dom-viewport';

/** 3D Background Stage without editor overlays   " pins canvas behind DOM nodes */
function PreviewStage() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apply = () => {
      const el = ref.current;
      if (!el) return;
      const m = getManifest();
      const stage = m.stage;
      const p = getProgress();
      let active = stage.visible;
      /* Section-scoped stage: only show in the active section range */
      if (active && stage.mode === 'section' && stage.sectionId) {
        const sec = m.sections.find((s) => s.id === stage.sectionId);
        if (sec) {
          active = p >= sec.range[0] && (p < sec.range[1] || (sec.range[1] === 1 && p <= 1));
        }
      }
      el.style.opacity = active ? String(stage.opacity) : '0';
      el.style.zIndex = stage.placement === 'overlay' ? '3' : '0';
    };
    apply();
    const unsubProgress = subscribeProgress(apply);
    const unsubManifest = subscribeManifest(apply);
    return () => {
      unsubProgress();
      unsubManifest();
    };
  }, []);

  return (
    <div
      ref={ref}
      className="bs-preview-stage"
      aria-label="Scroll-driven 3D scene"
    >
      {/* chrome=false: transparent canvas, no grid/ground   " 3D model floats over DOM sections */}
      <Scene3DViewport navigation="track" chrome={false} />
    </div>
  );
}

/** Glassmorphic Floating Preview Bar with device presets & zoom scale indicator */
function FloatingPreviewToolbar({
  progress,
  zoomPct,
}: {
  progress: number;
  zoomPct: number;
}) {
  const profile = useUIState((s) => s.profile);
  const m = getManifest();
  const bp = m.breakpoints[profile] ?? { label: 'Desktop', canvasWidth: 1440 };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="bs-preview-toolbar" role="toolbar" aria-label="Preview controls">
      <div className="bs-preview-toolbar__group">
        <button
          className={`bs-preview-toolbar__btn ${profile === 'desktop' ? 'bs-preview-toolbar__btn--active' : ''}`}
          onClick={() => setUIState({ profile: 'desktop' })}
          title="Desktop Preset (1440px)"
        >
          {Icons.desktop}
        </button>
        <button
          className={`bs-preview-toolbar__btn ${profile === 'tablet' ? 'bs-preview-toolbar__btn--active' : ''}`}
          onClick={() => setUIState({ profile: 'tablet' })}
          title="Tablet Preset (768px)"
        >
          {Icons.tablet}
        </button>
        <button
          className={`bs-preview-toolbar__btn ${profile === 'mobile' ? 'bs-preview-toolbar__btn--active' : ''}`}
          onClick={() => setUIState({ profile: 'mobile' })}
          title="Mobile Preset (390px)"
        >
          {Icons.mobile}
        </button>
      </div>

      <div className="bs-preview-toolbar__divider" />

      <span className="bs-preview-toolbar__info">
        {bp.label}  * {bp.canvasWidth}px ({zoomPct}%)
      </span>

      <div className="bs-preview-toolbar__divider" />

      <span className="bs-preview-toolbar__pct">
        Progress {Math.round(progress * 100)}%
      </span>

      <div className="bs-preview-toolbar__divider" />

      <button
        className="bs-preview-toolbar__btn"
        onClick={toggleFullscreen}
        title="Toggle Fullscreen"
      >
        {Icons.maximize}
      </button>

      <button
        className="bs-preview-toolbar__exit"
        onClick={() => setUIState({ mode: 'dom' })}
        title="Exit Preview Mode"
      >
        <span>   </span> Exit Preview
      </button>
    </div>
  );
}

export function PreviewMode() {
  const profile = useUIState((s) => s.profile);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [progress, setLocalProgress] = useState(getProgress());
  const [scale, setScale] = useState(1);
  const [, force] = useState(0);

  useEffect(() => subscribeManifest(() => force((n) => n + 1)), []);

  const m = getManifest();
  const bp = m.breakpoints[profile] ?? { label: 'Desktop', canvasWidth: 1440 };
  const targetWidth = bp.canvasWidth || (profile === 'mobile' ? 390 : profile === 'tablet' ? 768 : 1440);

  /* Auto-calculate viewport scale factor based on container width vs preset targetWidth */
  useEffect(() => {
    const calcScale = () => {
      const el = containerRef.current;
      if (!el) return;
      const availW = el.clientWidth - (profile === 'desktop' ? 0 : 40);
      const availH = el.clientHeight - 80;
      if (availW <= 0) return;

      if (profile === 'desktop') {
        const s = availW < targetWidth ? availW / targetWidth : 1;
        setScale(Math.max(0.35, Math.min(1, s)));
      } else {
        const frameH = profile === 'mobile' ? 840 : 900;
        const scaleX = availW < targetWidth ? availW / targetWidth : 1;
        const scaleY = availH < frameH ? availH / frameH : 1;
        setScale(Math.max(0.35, Math.min(1, Math.min(scaleX, scaleY))));
      }
    };

    calcScale();
    window.addEventListener('resize', calcScale);
    return () => window.removeEventListener('resize', calcScale);
  }, [profile, targetWidth]);

  /* Sync progress   ' scroll position when progress changes externally (Timeline Studio) */
  useEffect(() => {
    const unsub = subscribeProgress((p) => {
      setLocalProgress(p);
      const el = scrollerRef.current;
      if (el) {
        const maxScroll = el.scrollHeight - el.clientHeight;
        if (maxScroll > 0) {
          const targetTop = p * maxScroll;
          if (Math.abs(el.scrollTop - targetTop) > 3) {
            el.scrollTop = targetTop;
          }
        }
      }
    });
    return unsub;
  }, [profile]);

  /* Scroll   ' progress clock [0, 1] (PRD-INV-01) */
  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll > 0) {
      setProgress(el.scrollTop / maxScroll);
    }
  };

  const isDesktop = profile === 'desktop';
  const isMobile = profile === 'mobile';
  const zoomPct = Math.round(scale * 100);

  return (
    <div className="bs-preview-container" ref={containerRef}>
      <FloatingPreviewToolbar progress={progress} zoomPct={zoomPct} />

      {isDesktop ? (
        /*  "  "  Desktop: full-width canvas stage pinned behind scrolling DOM sections  "  "  */
        <div className="bs-preview-stage-container">
          {/* 3D canvas: absolute, inset 0, z-index 0, transparent background */}
          <PreviewStage />
          {/* DOM sections: absolute, inset 0, z-index 1, overflow scroll */}
          <div
            className="bs-preview-scroller"
            ref={scrollerRef}
            onScroll={onScroll}
          >
            <div
              className="bs-preview-stage-wrap"
              style={{
                width: `${targetWidth}px`,
                margin: '0 auto',
                transform: scale < 1 ? `scale(${scale})` : undefined,
                transformOrigin: 'top center',
              }}
            >
              <div className="bs-preview-viewport bs-preview-viewport--desktop">
                {m.domRootOrder.map((rootId) => (
                  <DOMNodeView key={rootId} id={rootId} profile={profile} />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /*  "  "  Mobile / Tablet: device shell with canvas pinned behind scroll sections  "  "  */
        <div className="bs-preview-device-wrap">
          <div
            className={`bs-device-frame bs-device-frame--${profile}`}
            style={{
              width: `${targetWidth}px`,
              transform: scale < 1 ? `scale(${scale})` : undefined,
              transformOrigin: 'center center',
            }}
          >
            {/* Dynamic Island notch (mobile only) */}
            {isMobile && (
              <div className="bs-device-notch">
                <span className="bs-device-camera" />
                <span className="bs-device-speaker" />
              </div>
            )}

            {/* iOS-style status bar */}
            <div className="bs-device-statusbar">
              <span className="bs-device-time">9:41</span>
              <div className="bs-device-icons">
                <span> -  -  -  - </span>
                <span>  " </span>
                <span>  " </span>
              </div>
            </div>

            {/* Screen: 3D stage + scrollable DOM sections stacked */}
            <div className="bs-device-screen-wrap">
              {/* 3D canvas: pinned absolute behind sections */}
              <PreviewStage />
              {/* Scroll layer: absolute, inset 0, transparent sections on top of 3D */}
              <div
                className="bs-device-screen"
                ref={scrollerRef}
                onScroll={onScroll}
              >
                <div className="bs-preview-viewport">
                  {m.domRootOrder.map((rootId) => (
                    <DOMNodeView key={rootId} id={rootId} profile={profile} />
                  ))}
                </div>
              </div>
            </div>

            {/* Home indicator bar */}
            <div className="bs-device-homebar" />
          </div>
        </div>
      )}
    </div>
  );
}
