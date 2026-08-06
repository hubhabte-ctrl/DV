import type { SaveState } from '@bs/engine';

interface ChipProps {
  label: string;
  /** Token name for the status dot colour, e.g. `--bs-color-save-saved`. */
  dotVar?: string;
  /** When provided the chip renders as a real <button> (keyboard-operable). */
  onClick?: () => void;
  /** Tooltip / accessible description   " required when `onClick` is set. */
  title?: string;
  className?: string;
}

/** Generic status chip with a state-colored dot. */
function Chip({ label, dotVar, onClick, title, className = '' }: ChipProps) {
  // The dot colour is runtime data (save state / connection state); it crosses
  // into CSS as a custom property   " the only sanctioned inline channel.
  const dotStyle = dotVar
    ? ({ ['--dot' as string]: `var(${dotVar})` } as React.CSSProperties)
    : undefined;
  const dot = dotVar ? <span className="uk-chip__dot" /> : null;

  if (onClick) {
    return (
      <button
        type="button"
        className={`uk-chip uk-chip--interactive ${className}`}
        style={dotStyle}
        onClick={onClick}
        title={title}
        aria-label={title ?? label}
      >
        {dot}
        {label}
      </button>
    );
  }

  return (
    <span className={`uk-chip ${className}`} style={dotStyle} title={title}>
      {dot}
      {label}
    </span>
  );
}

const SAVE_DOT: Record<SaveState, string> = {
  Saved: '--bs-color-save-saved',
  Saving: '--bs-color-save-saving',
  Unsaved: '--bs-color-save-unsaved',
  Offline: '--bs-color-save-offline',
  'Save failed': '--bs-color-save-failed',
};

/** Save-state chip per FR-114 (`Saved | Saving | Unsaved | Offline | Save failed`). */
export function SaveStateChip({ state }: { state: SaveState }) {
  return <Chip label={state} dotVar={SAVE_DOT[state]} />;
}
