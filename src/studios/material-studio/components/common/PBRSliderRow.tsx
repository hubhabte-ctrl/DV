/**
 * SSOT slider row   " the inspector's canonical scalar control.
 *
 * Ports the reference markup from `UI_UX_reference/src/app/App.ts:615`:
 *
 *   <div class="slider-row">
 *     <label>   </label>
 *     <input type="range" class="slider">
 *     <span class="slider-val">   </span>
 *   </div>
 *
 * styled by the already-migrated block in `src/shared/Inspector.css:640-664`.
 * That shape was previously hand-rolled inline in `DOMInspector.tsx` (four
 * copies) and bypassed entirely by Material Studio, which rendered the
 * pre-migration `NumberSliderField` instead. This component is the single
 * factored home for it, so the two studios cannot drift again.
 *
 * Deviation (  5.3): the SSOT value cell is a static `<span>`. The control this
 * replaces in Material Studio (`@bs/ui-kit` `NumberSliderField`) offered typed
 * numeric entry, and the migration brief forbids removing existing
 * functionality   " so the cell is an `<input>` that inherits `.slider-val`
 * geometry and typography verbatim and is stripped of every UA input affordance
 * (see `.slider-val__input`). It is visually identical to the SSOT span; only
 * the interaction is additive. Authorised by   5.3 "avoiding a duplicate
 * mechanism"   " the alternative was keeping a second, non-SSOT slider widget
 * alongside this one.
 *
 * Values are carried in MODEL units throughout (`0   1` for a PBR factor). `scale`
 * exists purely for presentation: the SSOT displays such factors as whole
 * percentages ("82%", "28%"), never as `0.82`. Display is derived, never stored.
 */
import { useId, useState, type ChangeEvent, type FocusEvent, type KeyboardEvent } from 'react';

/** Decimal places implied by one step, measured in display units. */
function decimalsFor(displayStep: number): number {
  if (!Number.isFinite(displayStep) || displayStep <= 0) return 0;
  if (displayStep >= 1) return 0;
  // `1e-7` absorbs the float error in products like `0.05 * 100`.
  const decimals = Math.ceil(-Math.log10(displayStep) - 1e-7);
  return Math.min(Math.max(decimals, 0), 4);
}

export function PBRSliderRow({
  label,
  value = 0,
  min = 0,
  max = 1,
  step = 0.05,
  scale = 1,
  unit,
  disabled,
  onChange,
  onScrub,
}: {
  label: string;
  /** model-unit value */
  value?: number;
  /** model-unit bounds */
  min?: number;
  max?: number;
  /** model-unit granularity */
  step?: number;
  /** model   ' display multiplier. `100` renders a `0   1` factor as a percentage. */
  scale?: number;
  /** rendered after the number, e.g. `%`. Presentation only. */
  unit?: string;
  disabled?: boolean;
  onChange: (v: number) => void;
  /** high-frequency updates during drag; coalesced into one undo step by the command engine */
  onScrub?: (v: number) => void;
}) {
  const id = useId();
  const safeValue = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  const safeStep = step || 1;
  const safeScale = scale || 1;

  /* Uncommitted keystrokes. A fully-controlled cell would reformat mid-typing
     and make intermediate states like "1." impossible to reach. */
  const [draft, setDraft] = useState<string | null>(null);

  /* Clamp + step-snap, carried over verbatim from `NumberSliderField` so the
     numeric behaviour of every call site is unchanged by the markup swap. */
  const clamp = (v: number) => {
    let out = v;
    if (min !== undefined && out < min) out = min;
    if (max !== undefined && out > max) out = max;
    return Math.round(out / safeStep) * safeStep;
  };

  const decimals = decimalsFor(safeStep * safeScale);
  const display = (safeValue * safeScale).toFixed(decimals);

  /* `type="text"` rather than `type="number"`: a number input is rendered with
     the host locale's decimal separator, which is what produced the "0,2" /
     "1,5" cells in the shipped build where the SSOT shows "20%" / "1.50". */
  const commit = (raw: string) => {
    setDraft(null);
    const parsed = parseFloat(raw.replace(/[^0-9.eE+-]/g, ''));
    if (Number.isNaN(parsed)) return;
    onChange(clamp(parsed / safeScale));
  };

  const onValueKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') setDraft(null);
  };

  return (
    <div className="slider-row">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="slider"
        type="range"
        min={min}
        max={max}
        step={safeStep}
        value={safeValue}
        disabled={disabled}
        aria-valuetext={`${display}${unit ?? ''}`}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          (onScrub ?? onChange)(clamp(parseFloat(e.target.value) || 0))
        }
      />
      <span className="slider-val slider-val--edit">
        <input
          className="slider-val__input"
          type="text"
          inputMode="decimal"
          aria-label={label}
          value={draft ?? display}
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
          onBlur={(e: FocusEvent<HTMLInputElement>) => commit(e.target.value)}
          onKeyDown={onValueKeyDown}
        />
        {unit && <span className="slider-val__unit">{unit}</span>}
      </span>
    </div>
  );
}
