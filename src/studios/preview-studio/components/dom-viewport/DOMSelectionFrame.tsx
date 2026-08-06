/**
 * Figma-style 8-handle selection frame component (WS2-3b, Doc 05   3).
 * Pure move from DOMViewport.tsx (IL-11 behavior-identical).
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  dispatchBatch,
  getManifest,
  resolveStyle,
  subscribeManifest,
  type Command,
} from '@bs/engine';
import { getUIState, useUIState } from '@bs/engine';
import { Icons } from '../../../../app/ui/Icons';
import {
  canvasRootEl,
  domEls,
  sectionRootIdOf,
  stylePath,
} from '../../../../engine/domTypes';

const HANDLES_ABS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
const HANDLES_FLOW = ['e', 'se', 's'] as const;
type HandleDir = (typeof HANDLES_ABS)[number];

const HANDLE_POS: Record<HandleDir, CSSProperties> = {
  nw: { top: -4, left: -4, cursor: 'nwse-resize' },
  n: { top: -4, left: '50%', marginLeft: -4, cursor: 'ns-resize' },
  ne: { top: -4, right: -4, cursor: 'nesw-resize' },
  e: { top: '50%', right: -4, marginTop: -4, cursor: 'ew-resize' },
  se: { bottom: -4, right: -4, cursor: 'nwse-resize' },
  s: { bottom: -4, left: '50%', marginLeft: -4, cursor: 'ns-resize' },
  sw: { bottom: -4, left: -4, cursor: 'nesw-resize' },
  w: { top: '50%', left: -4, marginTop: -4, cursor: 'ew-resize' },
};

interface ResizeGesture {
  pid: number;
  dir: HandleDir;
  sx: number;
  sy: number;
  l0: number;
  t0: number;
  w0: number;
  h0: number;
  abs: boolean;
  /** zoom captured at gesture start (Phase 1.5) */
  zoom: number;
}

function DOMSelectionFrame({ scrollerRef }: { scrollerRef: React.RefObject<HTMLDivElement> }) {
  const selId = useUIState((s) => s.selectedDomNodeId);
  const profile = useUIState((s) => s.profile);
  const [, force] = useState(0);
  const gesture = useRef<ResizeGesture | null>(null);

  useEffect(() => subscribeManifest(() => force((n) => n + 1)), []);
  useEffect(() => {
    const el = scrollerRef.current;
    const bump = () => force((n) => n + 1);
    el?.addEventListener('scroll', bump);
    window.addEventListener('resize', bump);
    return () => {
      el?.removeEventListener('scroll', bump);
      window.removeEventListener('resize', bump);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!selId || !canvasRootEl) return null;
  const m = getManifest();
  const node = m.domNodes[selId];
  const el = domEls.get(selId);
  if (!node || !el || node.hidden) return null;
  const isRoot = m.domRootOrder.includes(selId);
  const style = resolveStyle(node, profile);
  const abs = style.position === 'absolute';
  const r = el.getBoundingClientRect();
  const cr = canvasRootEl.getBoundingClientRect();
  /* locked nodes show a READ-ONLY frame   " visible, never editable
     (Phase 3   " audit D-10, Doc 05   3) */
  if (node.locked) {
    return (
      <div
        className="bs-selframe bs-selframe--locked"
        style={{ left: r.left - cr.left, top: r.top - cr.top, width: r.width, height: r.height }}
      >
        <span className="bs-selframe__lockbadge" title="Locked - unlock in the Layers panel to edit">
          {Icons.lock}
          Locked
        </span>
      </div>
    );
  }
  const dirs: readonly HandleDir[] = isRoot ? [] : abs ? HANDLES_ABS : HANDLES_FLOW;

  const begin = (dir: HandleDir) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const zoom = getUIState().canvasZoom;
    const sectionEl = domEls.get(sectionRootIdOf(selId));
    const sr = sectionEl?.getBoundingClientRect();
    gesture.current = {
      pid: e.pointerId,
      dir,
      sx: e.clientX,
      sy: e.clientY,
      l0: Number(style.left ?? (sr ? (r.left - sr.left) / zoom : 0)),
      t0: Number(style.top ?? (sr ? (r.top - sr.top) / zoom : 0)),
      w0: r.width / zoom,
      h0: r.height / zoom,
      abs,
      zoom,
    };
  };
  const move = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pid) return;
    const dx = (e.clientX - g.sx) / g.zoom;
    const dy = (e.clientY - g.sy) / g.zoom;
    const cmds: Command[] = [];
    const set = (prop: string, v: number) =>
      cmds.push({ type: 'set', path: stylePath(selId, profile, prop), value: Math.round(v) });
    if (g.dir.includes('e')) set('width', Math.max(24, g.w0 + dx));
    if (g.dir.includes('s')) set('height', Math.max(24, g.h0 + dy));
    if (g.abs && g.dir.includes('w')) {
      set('left', g.l0 + Math.min(dx, g.w0 - 24));
      set('width', Math.max(24, g.w0 - dx));
    }
    if (g.abs && g.dir.includes('n')) {
      set('top', g.t0 + Math.min(dy, g.h0 - 24));
      set('height', Math.max(24, g.h0 - dy));
    }
    if (cmds.length) dispatchBatch(cmds, `resize:${selId}`); // one undo per gesture
  };
  const end = () => {
    gesture.current = null;
  };

  return (
    <div
      className="bs-selframe"
      style={{ left: r.left - cr.left, top: r.top - cr.top, width: r.width, height: r.height }}
    >
      {dirs.map((dir) => (
        <span
          key={dir}
          className="bs-selframe__handle"
          style={HANDLE_POS[dir]}
          onPointerDown={begin(dir)}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
      ))}
    </div>
  );
}
