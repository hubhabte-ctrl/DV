/**
 * Inspector note — the one-line advisory that sits under a group of controls.
 *
 * Replaces the raw `<div className="bs-muted bs-insp-hint">` blocks that were
 * hand-rolled at 11 call sites across the studios. Those had drifted into
 * multi-sentence paragraphs wedged between controls, which is the single
 * loudest source of visual noise in the inspector.
 *
 * The API enforces the rule rather than documenting it: `children` is the ONE
 * line that renders, and anything that used to follow it goes in `detail`,
 * which surfaces on hover as a `title` instead of occupying vertical space.
 * If a note cannot be said in one line it is documentation, not UI — it belongs
 * in the docs, not between two sliders.
 *
 * `action` renders a trailing `›` affordance. Like InspectorObjectHeader's
 * chevron it appears only when something real is wired to it.
 */
import type { ReactNode } from 'react';

export function InspectorNote({
  children,
  detail,
  action,
  actionLabel,
}: {
  /** The single line of advisory text. Keep it short enough not to wrap. */
  children: ReactNode;
  /** Supporting sentence, shown as the hover `title`. Never takes up layout. */
  detail?: string;
  /** Optional drill-in handler; renders the trailing chevron when supplied. */
  action?: () => void;
  /** Accessible name for the action button. */
  actionLabel?: string;
}) {
  return (
    <div className="insp-note" title={detail}>
      <svg
        className="insp-note__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <span className="insp-note__text">{children}</span>
      {action && (
        <button
          type="button"
          className="insp-note__action"
          onClick={action}
          aria-label={actionLabel ?? 'Learn more'}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
