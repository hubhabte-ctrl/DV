/**
 * Inspector identity header   " the icon + kind + name block at the top of the
 * inspector body.
 *
 * Global on purpose. Pre-refactor this markup lived once in
 * `InspectorPanel.tsx:834-842`, driven by a `mode` switch. Moving the per-studio
 * *content* out without also offering the *block* would have left five studios
 * hand-rolling the same three divs   " exactly the "duplicate components" defect
 * the governance forbids, and the way visual drift starts.
 *
 * Markup is preserved verbatim from the pre-refactor shell so the existing
 * `.insp-obj-head` styling continues to apply unchanged.
 */
import type { ReactNode } from 'react';

export function InspectorObjectHeader({
  kind,
  name,
  icon,
  onOpen,
  openLabel,
}: {
  /** Small muted line, e.g. `Section · hero-1`. Title Case — the CSS no longer
   *  uppercases it, so the string must arrive cased correctly. */
  kind: string;
  /** Primary line, e.g. the node label. */
  name: string;
  icon: ReactNode;
  /**
   * Optional drill-in action. The trailing chevron renders ONLY when this is
   * supplied, so the affordance is always real — a chevron that does nothing
   * promises navigation the panel cannot deliver.
   */
  onOpen?: () => void;
  /** Accessible name for the drill-in button. Required in spirit when `onOpen`
   *  is passed; falls back to something honest rather than silently unlabelled. */
  openLabel?: string;
}) {
  return (
    <div className="insp-obj-head">
      <div className="ic">{icon}</div>
      <div className="insp-obj-head__text">
        <div className="kind">{kind}</div>
        <div className="name">{name}</div>
      </div>
      {onOpen && (
        <button
          type="button"
          className="insp-obj-head__open"
          onClick={onOpen}
          aria-label={openLabel ?? `Open ${name}`}
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
