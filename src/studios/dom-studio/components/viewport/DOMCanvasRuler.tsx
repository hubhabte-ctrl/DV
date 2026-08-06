/**
 * Canvas-based ruler system for DOM Studio (Doc 05   3).
 *
 * Two ruler components   " HorizontalRuler and VerticalRuler   " drawn with
 * the 2D Canvas API so tick rendering is O(1) DOM nodes regardless of zoom.
 * Both observe scroll and zoom changes imperatively (IL-2: React never runs
 * on the scroll/zoom hot path). A cursor crosshair tracks pointer position
 * across both rulers simultaneously.
 *
 * Ruler constants:
 *   RULER_SIZE = 20px    " thickness of each ruler strip
 *   Tick spacing adapts to zoom: major ticks every 50 canvas-units,
 *   minor ticks every 10. Below 0.5 - zoom minor ticks are suppressed.
 */
import { useEffect, useRef } from 'react';
import { useUIState } from '@bs/engine';

const RULER_SIZE = 20;
const MAJOR_INTERVAL = 50;   // canvas-unit spacing between labeled ticks
const MINOR_INTERVAL = 10;   // canvas-unit spacing between unlabeled ticks
const TICK_MAJOR_LEN = 10;   // px length of a major tick
const TICK_MINOR_LEN = 5;    // px length of a minor tick

/**
 * Ruler palette   " resolved from the `--bs-ruler-*` tokens (T2, DS-alignment plan).
 * Canvas 2D needs concrete values, so tokens are resolved via getComputedStyle
 * ONCE per theme and cached; scroll/zoom redraws hit the cache (IL-2 hot path).
 * Tokens are guaranteed: applyTokens() runs in main.tsx before first render and
 * defines all four names in both themes   " no hex fallbacks needed here.
 */
interface RulerPalette {
  bg: string;
  border: string;
  tick: string;
  label: string;
}

let paletteCache: RulerPalette | null = null;
let paletteCacheTheme: string | null = null;

function rulerPalette(): RulerPalette {
  const theme = document.documentElement.getAttribute('data-theme') ?? 'dark';
  if (paletteCache && paletteCacheTheme === theme) return paletteCache;
  const style = getComputedStyle(document.documentElement);
  paletteCacheTheme = theme;
  const bg = style.getPropertyValue('--bs-ruler-bg').trim() || (theme === 'light' ? '#F3F5F7' : '#0C0F14');
  const border = style.getPropertyValue('--bs-ruler-border').trim() || (theme === 'light' ? '#D0D5DE' : '#1E2430');
  const tick = style.getPropertyValue('--bs-ruler-tick').trim() || (theme === 'light' ? '#6B7280' : '#465060');
  const label = style.getPropertyValue('--bs-ruler-label').trim() || (theme === 'light' ? '#4B5563' : '#7A8898');
  paletteCache = { bg, border, tick, label };
  return paletteCache;
}

function getRulerIntervals(zoom: number): { major: number; minor: number } {
  if (zoom < 0.5) return { major: 200, minor: 40 };
  if (zoom < 0.9) return { major: 100, minor: 20 };
  return { major: 50, minor: 10 };
}

/** Draw the horizontal ruler given current scroll + zoom state. */
function drawHRuler(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scrollLeft: number,
  zoom: number,
  dpr: number,
): void {
  ctx.clearRect(0, 0, width, height);

  const { bg, border, tick: tickColor, label: labelColor } = rulerPalette();
  const { major: MAJOR_INTERVAL, minor: MINOR_INTERVAL } = getRulerIntervals(zoom);

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Bottom border
  ctx.fillStyle = border;
  ctx.fillRect(0, height - 1 * dpr, width, 1 * dpr);

  ctx.fillStyle = tickColor;

  // The first canvas-unit that is visible (in canvas-coord space)
  const startUnit = scrollLeft / zoom;
  const endUnit = startUnit + width / dpr / zoom;

  // Snap to nearest interval below startUnit
  const majorStart = Math.floor(startUnit / MAJOR_INTERVAL) * MAJOR_INTERVAL;
  const minorStart = Math.floor(startUnit / MINOR_INTERVAL) * MINOR_INTERVAL;

  // Determine whether to draw minor ticks (suppress when too dense)
  const minorPxSpacing = MINOR_INTERVAL * zoom;
  const showMinor = minorPxSpacing >= 6;

  ctx.font = `${9 * dpr}px "IBM Plex Mono", ui-monospace, SFMono-Regular, monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  if (showMinor) {
    ctx.fillStyle = tickColor;
    for (let u = minorStart; u <= endUnit; u += MINOR_INTERVAL) {
      if (u % MAJOR_INTERVAL === 0) continue; // major tick handles it
      const x = Math.round((u * zoom - scrollLeft) * dpr);
      if (x < 0 || x > width) continue;
      ctx.fillRect(x, (height - TICK_MINOR_LEN * dpr), 1 * dpr, TICK_MINOR_LEN * dpr);
    }
  }

  ctx.fillStyle = tickColor;
  for (let u = majorStart; u <= endUnit; u += MAJOR_INTERVAL) {
    const x = Math.round((u * zoom - scrollLeft) * dpr);
    if (x < 0 || x > width) continue;
    ctx.fillRect(x, height - TICK_MAJOR_LEN * dpr, 1 * dpr, TICK_MAJOR_LEN * dpr);
    if (x + 3 * dpr < width) {
      ctx.fillStyle = labelColor;
      ctx.fillText(String(Math.round(u)), x + 3 * dpr, 2 * dpr);
      ctx.fillStyle = tickColor;
    }
  }
}

/** Draw the vertical ruler given current scroll + zoom state. */
function drawVRuler(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scrollTop: number,
  zoom: number,
  dpr: number,
): void {
  ctx.clearRect(0, 0, width, height);

  const { bg, border, tick: tickColor, label: labelColor } = rulerPalette();
  const { major: MAJOR_INTERVAL, minor: MINOR_INTERVAL } = getRulerIntervals(zoom);

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Right border
  ctx.fillStyle = border;
  ctx.fillRect(width - 1 * dpr, 0, 1 * dpr, height);

  const startUnit = scrollTop / zoom;
  const endUnit = startUnit + height / dpr / zoom;

  const majorStart = Math.floor(startUnit / MAJOR_INTERVAL) * MAJOR_INTERVAL;
  const minorStart = Math.floor(startUnit / MINOR_INTERVAL) * MINOR_INTERVAL;
  const minorPxSpacing = MINOR_INTERVAL * zoom;
  const showMinor = minorPxSpacing >= 6;

  if (showMinor) {
    ctx.fillStyle = tickColor;
    for (let u = minorStart; u <= endUnit; u += MINOR_INTERVAL) {
      if (u % MAJOR_INTERVAL === 0) continue;
      const y = Math.round((u * zoom - scrollTop) * dpr);
      if (y < 0 || y > height) continue;
      ctx.fillRect(width - TICK_MINOR_LEN * dpr, y, TICK_MINOR_LEN * dpr, 1 * dpr);
    }
  }

  ctx.fillStyle = tickColor;
  ctx.font = `${9 * dpr}px "IBM Plex Mono", ui-monospace, SFMono-Regular, monospace`;
  for (let u = majorStart; u <= endUnit; u += MAJOR_INTERVAL) {
    const y = Math.round((u * zoom - scrollTop) * dpr);
    if (y < 0 || y > height) continue;
    ctx.fillRect(width - TICK_MAJOR_LEN * dpr, y, TICK_MAJOR_LEN * dpr, 1 * dpr);
    if (y + 3 * dpr < height) {
      ctx.save();
      ctx.translate(3 * dpr, y + 3 * dpr);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = labelColor;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(String(Math.round(u)), 0, 0);
      ctx.restore();
      ctx.fillStyle = tickColor;
    }
  }
}

export interface RulerProps {
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
}

/**
 * Horizontal ruler strip   " sits at the top of the canvas workspace.
 * Redraws imperatively on scroll and zoom; never triggers React renders.
 */
export function HorizontalRuler({ scrollerRef, zoom }: RulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const theme = useUIState((s) => s.theme);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // Redraw function (called on scroll and on initial mount / zoom / theme change)
  const redraw = () => {
    const canvas = canvasRef.current;
    const scroller = scrollerRef.current;
    if (!canvas || !scroller) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawHRuler(ctx, w * dpr, h * dpr, scroller.scrollLeft, zoomRef.current, dpr);
  };

  useEffect(() => {
    redraw();

    const scroller = scrollerRef.current;
    if (!scroller) return;

    const onScroll = () => redraw();
    scroller.addEventListener('scroll', onScroll, { passive: true });

    const ro = new ResizeObserver(redraw);
    if (canvasRef.current) ro.observe(canvasRef.current);

    return () => {
      scroller.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-draw whenever zoom or theme prop changes
  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, theme]);

  const onPointerMove = (e: React.PointerEvent) => {
    const cursor = cursorRef.current;
    if (!cursor) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    cursor.style.left = `${e.clientX - rect.left}px`;
    cursor.style.display = 'block';
  };

  const onPointerLeave = () => {
    if (cursorRef.current) cursorRef.current.style.display = 'none';
  };

  return (
    <div className="bs-ruler bs-ruler--h" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
      <canvas ref={canvasRef} className="bs-ruler__canvas" />
      <div ref={cursorRef} className="bs-ruler__cursor bs-ruler__cursor--h" />
    </div>
  );
}

/**
 * Vertical ruler strip   " sits at the left edge of the canvas workspace.
 * Redraws imperatively on scroll and zoom.
 */
export function VerticalRuler({ scrollerRef, zoom }: RulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const theme = useUIState((s) => s.theme);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const redraw = () => {
    const canvas = canvasRef.current;
    const scroller = scrollerRef.current;
    if (!canvas || !scroller) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawVRuler(ctx, w * dpr, h * dpr, scroller.scrollTop, zoomRef.current, dpr);
  };

  useEffect(() => {
    redraw();

    const scroller = scrollerRef.current;
    if (!scroller) return;

    const onScroll = () => redraw();
    scroller.addEventListener('scroll', onScroll, { passive: true });

    const ro = new ResizeObserver(redraw);
    if (canvasRef.current) ro.observe(canvasRef.current);

    return () => {
      scroller.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, theme]);

  const onPointerMove = (e: React.PointerEvent) => {
    const cursor = cursorRef.current;
    if (!cursor) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    cursor.style.top = `${e.clientY - rect.top}px`;
    cursor.style.display = 'block';
  };

  const onPointerLeave = () => {
    if (cursorRef.current) cursorRef.current.style.display = 'none';
  };

  return (
    <div className="bs-ruler bs-ruler--v" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
      <canvas ref={canvasRef} className="bs-ruler__canvas" />
      <div ref={cursorRef} className="bs-ruler__cursor bs-ruler__cursor--v" />
    </div>
  );
}

export function RulerCorner() {
  return (
    <div
      className="bs-ruler__corner"
      aria-hidden
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'var(--text-label)',
        fontWeight: 600,
        color: 'var(--bs-ruler-label, #94a3b8)',
        fontFamily: 'monospace',
      }}
    >
      px
    </div>
  );
}

;
