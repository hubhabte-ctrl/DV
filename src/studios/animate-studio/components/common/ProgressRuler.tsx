/**
 * ProgressRuler   " shared [0,1] scrub-surface primitive (Spec 07   9.2:
 * "Shared scrub math   ' @bs/ui-kit ProgressRuler primitive   " one clock,
 * three instruments").
 *
 * Owns ONLY the scrub math: pointer   ' normalized t (with capture), keyboard
 * nudge (04 TimelineEditor   7: 0.001 step, Shift  -10, Home/End) and the a11y
 * slider contract. It is fully controlled and stateless   " the progress value
 * itself lives with the caller (the canonical @bs/runtime clock, IL-2).
 * Consumers: Animation AnimateTimelinePanel ruler, DOM DOMFlowStrip band, 3D Scene3DShotBar strip.
 */
import type { HTMLAttributes, KeyboardEvent, PointerEvent, ReactNode } from 'react';

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

export interface ProgressRulerProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'role' | 'aria-label'> {
  /** current progress on the canonical [0,1] clock */
  value: number;
  /** scrub callback   " the caller forwards this to the one clock (IL-2) */
  onScrub: (t: number) => void;
  /** called once when a pointer scrub gesture begins (e.g. to pause playback) */
  onScrubStart?: () => void;
  /** called once when the pointer scrub gesture ends */
  onScrubEnd?: () => void;
  ariaLabel: string;
  /** keyboard nudge step (04 TimelineEditor   7)   " Shift multiplies  -10 */
  step?: number;
  /** overlays rendered inside the surface: bands, markers, keys, playhead */
  children?: ReactNode;
}

export function ProgressRuler({
  value,
  onScrub,
  onScrubStart,
  onScrubEnd,
  ariaLabel,
  step = 0.001,
  children,
  onPointerDown: externalPointerDown,
  onKeyDown: externalKeyDown,
  ...rest
}: ProgressRulerProps) {
  const scrubTo = (el: HTMLElement, clientX: number) => {
    const rect = el.getBoundingClientRect();
    onScrub(clamp01((clientX - rect.left) / rect.width));
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    externalPointerDown?.(e);
    if (e.defaultPrevented) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    onScrubStart?.();
    scrubTo(el, e.clientX);
    const onMove = (ev: globalThis.PointerEvent) => scrubTo(el, ev.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onScrubEnd?.();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    externalKeyDown?.(e);
    if (e.defaultPrevented) return;
    const nudge = step * (e.shiftKey ? 10 : 1);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      onScrubStart?.();
      onScrub(clamp01(value + nudge));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onScrubStart?.();
      onScrub(clamp01(value - nudge));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onScrub(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onScrub(1);
    }
  };

  return (
    <div
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={Number(value.toFixed(3))}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {children}
    </div>
  );
}
