/**
 * DOM Canvas workspace (Doc 05   3, new_task brief): a Figma-like free-form
 * canvas. Pointer-drag moves any element anywhere (converted to FR-121
 * absolute overlay positioning inside its section); an 8-handle selection
 * frame resizes; snap guides align to section edges/center (01 SnapSystem).
 * Assets   " including GLB files   " drop directly onto the canvas: a GLB becomes
 * a `scene3d` element rendering a gridless, transparent embedded 3D scene,
 * layered and animated with the page.
 * All mutations go through the command engine (IL-1); transient drag/hover
 * state never persists (FR-123).
 *
 * Sub-modules (WS2-3b split, IL-11 behavior-identical):
 *  - ./canvas/types.ts              " styles, CSS mapping, guide helpers & nodeFromTemplate
 *  - ./canvas/DOMNodeView.tsx          " node renderer & free-move gesture tracking
 *  - ./canvas/DOMSelectionFrame.tsx    " Figma-style 8-handle resize selection frame
 *  - ./canvas/DOMViewportControls.tsx          " minimap, scroll rail, align toolbar & 3D stage layer
 *  - ./canvas/domCanvasHelpers.ts   " canvas drop & alignment operations
 */
import { useEffect, useRef, useState } from 'react';
import {
  addSection,
  getManifest,
  subscribeManifest,
} from '@bs/engine';
import { categoryForFile, ingestFiles, isGltfFile } from '../../../../engine/assetIngest';
import { createEvaluator, trackSignature } from '@bs/engine';
import { audibleTracks } from '../../../../engine/audibleTracks';
import { getProgress, setProgress, subscribeProgress } from '../../../../engine/progress';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  getUIState,
  setCanvasZoom,
  setUIState,
  subscribeUIState,
  useUIState,
} from '@bs/engine';
import { Icons } from '../../../../app/ui/Icons';
import { toast } from '../../../../app/ui/Toast';
import { MIME_ASSET, MIME_COMPONENT } from '../../utils/dnd';
import {
  AlignToolbar,
  DOMContextMenu,
  HorizontalRuler,
  DOMNodeView,
  RulerCorner,
  SectionMinimap,
  DOMSelectionFrame,
  StageLayer,
  VerticalRuler,
  addScene3dNode,
  domEls,
  dropAssetOnCanvas,
  importGlbToCanvas,
  nodeFromTemplate,
  placeMediaNode,
  setCanvasRootEl,
  setGuideH,
  setGuideV,
  alignSelection,
} from '.';


interface MarqueeGesture {
  sx: number;
  sy: number;
  active: boolean;
}

interface PanGesture {
  sx: number;
  sy: number;
  sl: number;
  st: number;
}

export function DOMViewport() {
  const profile = useUIState((s) => s.profile);
  const zoom = useUIState((s) => s.canvasZoom);
  const showRulers = useUIState((s) => s.showRulers);
  const showGrid = useUIState((s) => s.showGrid);
  const [, force] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const zoomLayerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const marquee = useRef<MarqueeGesture | null>(null);
  const marqueeConsumed = useRef(false);
  const pan = useRef<PanGesture | null>(null);
  const fromScroll = useRef(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; targetId: string | null } | null>(null);
  useEffect(() => subscribeManifest(() => force((n) => n + 1)), []);


  /* DOM studio timeline bridge (Rule 3/7): tracks targeting DOM nodes drive
     the full QC-B-07 channel set   " opacity, translateX/Y, scale, rotate and
     blur (transform/opacity/filter; Phase 3   " audit T-9, 04 DOMAnimation).
     The DOM studio never touches 3D internals   " it consumes the same shared
     Experience Timeline through its own evaluator. */
  useEffect(() => {
    let evaluator = createEvaluator(audibleTracks(getManifest().tracks));
    let sig = trackSignature(audibleTracks(getManifest().tracks));
    /** per-node transform accumulator, reused across frames (no per-frame Map churn) */
    const txAcc = new Map<string, { tx: number; ty: number; s: number; r: number }>();
    const apply = (p: number) => {
      const state = evaluator.evaluate(p);
      const m = getManifest();
      for (const acc of txAcc.values()) {
        acc.tx = 0;
        acc.ty = 0;
        acc.s = 1;
        acc.r = 0;
      }
      const touched = new Set<string>();
      for (const [key, buf] of state.channels) {
        const dot = key.lastIndexOf('.');
        const targetId = key.slice(0, dot);
        if (!m.domNodes[targetId]) continue;
        const el = domEls.get(targetId);
        if (!el) continue;
        const channel = key.slice(dot + 1);
        if (channel === 'opacity') {
          el.style.opacity = buf[0].toFixed(3);
          continue;
        }
        if (channel === 'blur') {
          el.style.filter = buf[0] > 0.01 ? `blur(${buf[0].toFixed(1)}px)` : '';
          continue;
        }
        let acc = txAcc.get(targetId);
        if (!acc) {
          acc = { tx: 0, ty: 0, s: 1, r: 0 };
          txAcc.set(targetId, acc);
        }
        if (channel === 'translateY') acc.ty = buf[0];
        else if (channel === 'translateX') acc.tx = buf[0];
        else if (channel === 'scale') acc.s = buf[0];
        else if (channel === 'rotate') acc.r = buf[0];
        else continue;
        touched.add(targetId);
      }
      for (const targetId of touched) {
        const el = domEls.get(targetId);
        const acc = txAcc.get(targetId);
        if (!el || !acc) continue;
        el.style.transform =
          `translate(${acc.tx.toFixed(1)}px, ${acc.ty.toFixed(1)}px)` +
          (acc.r !== 0 ? ` rotate(${acc.r.toFixed(2)}deg)` : '') +
          (acc.s !== 1 ? ` scale(${acc.s.toFixed(3)})` : '');
      }
    };
    /* rebuild when tracks change structurally OR audibility toggles
       (mute/solo are transient UI state   " 04 TimelineEditor   2) */
    const rebuild = () => {
      const next = trackSignature(audibleTracks(getManifest().tracks));
      if (next !== sig) {
        sig = next;
        evaluator = createEvaluator(audibleTracks(getManifest().tracks));
        apply(getProgress());
      }
    };
    const unsubManifest = subscribeManifest(rebuild);
    const unsubUI = subscribeUIState(rebuild);
    apply(getProgress());
    const unsubProgress = subscribeProgress(apply);
    return () => {
      unsubManifest();
      unsubUI();
      unsubProgress();
    };
  }, []);

  /* Scroll IS the clock: scrolling the canvas writes the one [0,1] progress
     value (PRD-INV-01); scrubbing the timeline scrolls the canvas back. */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = () => el.scrollHeight - el.clientHeight || 1;
    el.scrollTop = getProgress() * max();
    return subscribeProgress((p) => {
      if (fromScroll.current) return;
      el.scrollTop = p * max();
    });
  }, []);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    fromScroll.current = true;
    setProgress(el.scrollTop / (el.scrollHeight - el.clientHeight || 1));
    fromScroll.current = false;
  };

  useEffect(() => {
    const page = pageRef.current;
    const layer = zoomLayerRef.current;
    if (!page || !layer) return;
    const sync = () => {
      layer.style.height = `${page.offsetHeight * getUIState().canvasZoom}px`;
      layer.style.width = `${page.offsetWidth * getUIState().canvasZoom}px`;
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(page);
    return () => ro.disconnect();
  }, [zoom, profile]);

  useEffect(() => {
    const onAlign = (e: Event) => {
      const ce = e as CustomEvent;
      alignSelection(ce.detail.op, ce.detail.profile);
    };
    const onInsert = (e: Event) => {
      const ce = e as CustomEvent;
      const cmpId = ce.detail.cmpId;
      const m = getManifest();
      const p = getProgress();
      const section = m.sections.find((s) => p >= s.range[0] && p <= s.range[1]) ?? m.sections[0];
      if (!section) {
        toast('Add a section first — sections are the scroll panels of the page', 'info', 'No Section');
        return;
      }
      const fresh = nodeFromTemplate(cmpId);
      if (!fresh) return;
      import('@bs/engine').then(({ addDomNode }) => {
        addDomNode(section.rootDomNodeId, fresh, m.domNodes[section.rootDomNodeId].children.length);
        setUIState({ mode: 'dom', selectedDomNodeId: fresh.id });
        toast(`${fresh.label} added to ${section.name}`, 'ok', 'Element Created');
      });
    };
    window.addEventListener('bs:dom:align', onAlign);
    window.addEventListener('bs:dom:insert', onInsert);
    return () => {
      window.removeEventListener('bs:dom:align', onAlign);
      window.removeEventListener('bs:dom:insert', onInsert);
    };
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const ui = getUIState();
      const selectedIds =
        ui.selectedDomNodeIds.length > 0
          ? ui.selectedDomNodeIds
          : ui.selectedDomNodeId
          ? [ui.selectedDomNodeId]
          : [];

      const hasSelection = selectedIds.length > 0;
      const isCtrlCmd = e.ctrlKey || e.metaKey;

      // Mouse wheel performs normal page/workspace scrolling if no element is selected and Ctrl/Cmd is not held
      if (!hasSelection && !isCtrlCmd) {
        return;
      }

      e.preventDefault();

      const cur = ui.canvasZoom;
      // Smooth zoom factor based on deltaY (handles trackpad pinch & mouse wheel)
      const factor = Math.pow(1.0015, -e.deltaY);
      const next = Math.min(Math.max(cur * factor, MIN_ZOOM), MAX_ZOOM);

      if (Math.abs(next - cur) < 0.0001) return;

      const rect = el.getBoundingClientRect();
      const vpCenterX = rect.width / 2;
      const vpCenterY = rect.height / 2;

      let focusX = e.clientX - rect.left;
      let focusY = e.clientY - rect.top;
      let hasTargetCenter = false;

      if (hasSelection) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const id of selectedIds) {
          const domEl = domEls.get(id);
          if (domEl) {
            const tr = domEl.getBoundingClientRect();
            if (tr.width > 0 && tr.height > 0) {
              minX = Math.min(minX, tr.left);
              minY = Math.min(minY, tr.top);
              maxX = Math.max(maxX, tr.right);
              maxY = Math.max(maxY, tr.bottom);
            }
          }
        }

        if (minX !== Infinity && maxX !== -Infinity) {
          focusX = (minX + maxX) / 2 - rect.left;
          focusY = (minY + maxY) / 2 - rect.top;
          hasTargetCenter = true;
        }
      }

      const ratio = next / cur;
      const oldScrollLeft = el.scrollLeft;
      const oldScrollTop = el.scrollTop;

      // When zooming a selected element, keep it centered in the viewport
      const targetVpX = hasTargetCenter ? vpCenterX : focusX;
      const targetVpY = hasTargetCenter ? vpCenterY : focusY;

      const newScrollLeft = (oldScrollLeft + focusX) * ratio - targetVpX;
      const newScrollTop = (oldScrollTop + focusY) * ratio - targetVpY;

      setCanvasZoom(next);

      requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, newScrollLeft);
        const maxScroll = el.scrollHeight - el.clientHeight || 1;
        const clampedScrollTop = Math.max(0, Math.min(newScrollTop, maxScroll));
        const newProgress = Math.min(Math.max(clampedScrollTop / maxScroll, 0), 1);
        setProgress(newProgress);
        el.scrollTop = clampedScrollTop;
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const fitZoom = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const width = getManifest().breakpoints[profile].canvasWidth;
    setCanvasZoom((el.clientWidth - 64) / width);
  };

  const zoomToSelection = () => {
    const el = scrollerRef.current;
    const selId = getUIState().selectedDomNodeId;
    const target = selId ? domEls.get(selId) : null;
    if (!el || !target) return;
    const cur = getUIState().canvasZoom;
    const unscaledW = target.getBoundingClientRect().width / cur;
    setCanvasZoom((el.clientWidth * 0.6) / Math.max(unscaledW, 1));
    requestAnimationFrame(() => {
      const r = target.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      el.scrollTop += r.top + r.height / 2 - (er.top + er.height / 2);
    });
  };


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.code === 'Digit0') {
        e.preventDefault();
        setCanvasZoom(1);
      } else if (e.shiftKey && e.code === 'Digit1') {
        e.preventDefault();
        fitZoom();
      } else if (e.shiftKey && e.code === 'Digit2') {
        e.preventDefault();
        zoomToSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const updateMarqueeRect = (x1: number, y1: number, x2: number, y2: number) => {
    const mq = marqueeRef.current;
    const cr = scrollerRef.current?.parentElement?.getBoundingClientRect();
    if (!mq || !cr) return;
    mq.style.display = 'block';
    mq.style.left = `${Math.min(x1, x2) - cr.left}px`;
    mq.style.top = `${Math.min(y1, y2) - cr.top}px`;
    mq.style.width = `${Math.abs(x2 - x1)}px`;
    mq.style.height = `${Math.abs(y2 - y1)}px`;
  };

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    const el = scrollerRef.current;
    if (!el) return;
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      pan.current = { sx: e.clientX, sy: e.clientY, sl: el.scrollLeft, st: el.scrollTop };
      el.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button === 0) marquee.current = { sx: e.clientX, sy: e.clientY, active: false };
  };

  const onCanvasPointerMove = (e: React.PointerEvent) => {
    const el = scrollerRef.current;
    if (pan.current && el) {
      el.scrollLeft = pan.current.sl - (e.clientX - pan.current.sx);
      el.scrollTop = pan.current.st - (e.clientY - pan.current.sy);
      return;
    }
    const mq = marquee.current;
    if (!mq) return;
    if (!mq.active) {
      if (Math.hypot(e.clientX - mq.sx, e.clientY - mq.sy) < 4) return;
      mq.active = true;
      el?.setPointerCapture(e.pointerId);
    }
    updateMarqueeRect(mq.sx, mq.sy, e.clientX, e.clientY);
  };

  const onCanvasPointerUp = (e: React.PointerEvent) => {
    if (pan.current) {
      pan.current = null;
      return;
    }
    const mq = marquee.current;
    marquee.current = null;
    if (marqueeRef.current) marqueeRef.current.style.display = 'none';
    if (!mq?.active) return;
    marqueeConsumed.current = true;
    const rect = {
      left: Math.min(mq.sx, e.clientX),
      right: Math.max(mq.sx, e.clientX),
      top: Math.min(mq.sy, e.clientY),
      bottom: Math.max(mq.sy, e.clientY),
    };
    const man = getManifest();
    const hit: string[] = [];
    for (const [id, el] of domEls) {
      const n = man.domNodes[id];
      if (!n || n.hidden || n.locked || man.domRootOrder.includes(id)) continue;
      const r = el.getBoundingClientRect();
      if (r.left < rect.right && r.right > rect.left && r.top < rect.bottom && r.bottom > rect.top) {
        hit.push(id);
      }
    }
    setUIState({
      selectedDomNodeIds: hit,
      selectedDomNodeId: hit[hit.length - 1] ?? null,
      selectedWaypointId: null,
    });
  };

  const m = getManifest();

  return (
    <div
      className="bs-domcanvas"
      style={{ backgroundImage: showGrid ? undefined : 'none' }}
      ref={(el) => {
        setCanvasRootEl(el);
      }}
      onContextMenu={(e: React.MouseEvent) => {
        e.preventDefault();
        const target = (e.target as HTMLElement).closest?.('[data-node-id]');
        const targetId = target ? target.getAttribute('data-node-id') : null;
        if (targetId) {
          setUIState({ selectedDomNodeId: targetId });
        }
        setCtxMenu({ x: e.clientX, y: e.clientY, targetId });
      }}
    >

      <StageLayer pageRef={pageRef} scrollerRef={scrollerRef} />
      <div
        ref={scrollerRef}
        className="bs-domcanvas__scroller"
        style={{ top: showRulers ? 20 : 0, left: showRulers ? 20 : 0 }}
        onScroll={onScroll}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onPointerCancel={onCanvasPointerUp}
        onClick={() => {
          if (marqueeConsumed.current) {
            marqueeConsumed.current = false;
            return;
          }
          setUIState({ selectedDomNodeId: null, selectedWaypointId: null, stageSelected: false });
        }}
        onDragOver={(e) => {
          if (
            e.dataTransfer.types.includes(MIME_COMPONENT) ||
            e.dataTransfer.types.includes(MIME_ASSET) ||
            e.dataTransfer.types.includes('Files')
          ) {
            e.preventDefault();
          }
        }}
        onDrop={(e) => {
          const files = Array.from(e.dataTransfer.files ?? []);
          if (files.length > 0) {
            e.preventDefault();
            let placed = 0;
            const rest: File[] = [];
            for (const file of files) {
              const offset = placed * 28;
              const category = categoryForFile(file.name);
              if (isGltfFile(file.name)) {
                importGlbToCanvas(file, e.clientX + offset, e.clientY + offset);
                placed++;
              } else if (category === 'Images' || category === 'SVG' || category === 'Videos') {
                const { imported } = ingestFiles([file]);
                if (imported[0]) {
                  placeMediaNode(imported[0], e.clientX + offset, e.clientY + offset);
                  placed++;
                }
              } else {
                rest.push(file);
              }
            }
            if (rest.length > 0) {
              const { imported, rejected } = ingestFiles(rest);
              if (imported.length) toast(`${imported.length} asset(s) imported to the Asset Studio`);
              if (rejected.length) toast(`Unsupported file type: ${rejected.join(', ')}`);
            }
            return;
          }
          const assetId = e.dataTransfer.getData(MIME_ASSET);
          if (assetId) {
            e.preventDefault();
            dropAssetOnCanvas(assetId, e.clientX, e.clientY);
            return;
          }
          const componentId = e.dataTransfer.getData(MIME_COMPONENT);
          if (componentId === 'cmp-scene3d') {
            e.preventDefault();
            addScene3dNode(undefined, 'New Scene', e.clientX, e.clientY);
            toast('3D Scene added — assign a GLB/GLTF asset in the Inspector');
            return;
          }
          if (componentId === 'cmp-section') {
            e.preventDefault();
            const fresh = nodeFromTemplate('cmp-section');
            if (fresh) {
              addSection(`0${getManifest().sections.length + 1} · New`, fresh);
              setUIState({ selectedDomNodeId: fresh.id });
              toast('Section added — scroll ranges redistributed');
            }
          }
        }}
      >
        <div className="bs-domcanvas__zoomlayer" ref={zoomLayerRef}>
          <div
            className="bs-domcanvas__page"
            ref={pageRef}
            style={{
              width: m.breakpoints[profile].canvasWidth,
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {m.domRootOrder.map((id) => (
              <DOMNodeView key={id} id={id} profile={profile} />
            ))}
          </div>
        </div>
      </div>
      {/* Ruler system   " horizontal along top, vertical along left, corner square */}
      {showRulers && <HorizontalRuler scrollerRef={scrollerRef} zoom={zoom} />}
      {showRulers && <VerticalRuler scrollerRef={scrollerRef} zoom={zoom} />}
      {showRulers && <RulerCorner />}
      <div
        className="bs-domcanvas__guide bs-domcanvas__guide--v"
        ref={(el) => {
          setGuideV(el);
        }}
      />
      <div
        className="bs-domcanvas__guide bs-domcanvas__guide--h"
        ref={(el) => {
          setGuideH(el);
        }}
      />
      <div className="bs-marquee" ref={marqueeRef} />
      <DOMSelectionFrame scrollerRef={scrollerRef} />
      <AlignToolbar />
      {/* Bottom-left fixed info cards & workspace controls stack */}
      <SectionMinimap />
      <div
        className="bs-domcanvas__info"
        title={`${m.breakpoints[profile].label} · ${m.breakpoints[profile].canvasWidth}px · ${Math.round(zoom * 100)}% zoom\nCtrl+wheel to zoom · Alt/middle-drag to pan · drag to marquee-select`}
        aria-label="Canvas info"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span className="bs-domcanvas__info-label">
          {m.breakpoints[profile].label} · {Math.round(zoom * 100)}%
        </span>
      </div>

      {ctxMenu && (
        <DOMContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          targetId={ctxMenu.targetId}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

