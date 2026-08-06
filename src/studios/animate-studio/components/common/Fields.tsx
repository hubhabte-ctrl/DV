/**
 * Field controls for the schema-driven Inspector (Doc 05   2).
 * NumberField supports direct entry, drag-scrubbing, units, and reset-to-default.
 * FieldRow renders the breakpoint override dot exactly per Doc 05   4.
 */
import { useRef, type ReactNode } from 'react';

/* ---------- FieldRow with override dot (Doc 05   4) ---------- */

export function FieldRow({
  label,
  overridden,
  overrideProfileLabel,
  onClearOverride,
  children,
}: {
  label: string;
  /** solid blue when the active profile carries a sparse patch for this property */
  overridden?: boolean;
  overrideProfileLabel?: string;
  onClearOverride?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="field-row">
      <div className="field">
        <label>
          {label}
          {overridden && (
            <button
              className="uk-overridedot uk-overridedot--active bs-ml-sm"
              title={`${overrideProfileLabel} Override Active. Click to reset.`}
              onClick={onClearOverride}
            />
          )}
        </label>
        {children}
      </div>
    </div>
  );
}

/* ---------- NumberField ---------- */

export function NumberField({
  value = 0,
  onChange,
  onScrub,
  min,
  max,
  step = 1,
  unit,
  axisLabel,
  compact = false,
}: {
  value?: number;
  onChange: (v: number) => void;
  /** high-frequency updates during drag; coalesced into one undo step by the command engine */
  onScrub?: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  axisLabel?: string;
  compact?: boolean;
}) {
  const safeValue = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  const safeStep = step || 1;
  const dragRef = useRef<{ startX: number; startV: number } | null>(null);

  const clamp = (v: number) => {
    let out = v;
    if (min !== undefined && out < min) out = min;
    if (max !== undefined && out > max) out = max;
    return Math.round(out / safeStep) * safeStep;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startV: safeValue };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!dragRef.current) return;
    const delta = (e.clientX - dragRef.current.startX) * safeStep * 0.5;
    (onScrub ?? onChange)(clamp(dragRef.current.startV + delta));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const formattedVal = Number.isInteger(safeValue) ? safeValue : Number(safeValue.toFixed(3));

  return (
    <span
      className={`uk-numfield ${axisLabel ? 'uk-numfield--has-axis' : ''} ${compact ? 'uk-numfield--compact' : ''}`}
    >
      {axisLabel ? (
        <span
          className="uk-numfield__axis"
          title="Drag to scrub"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {axisLabel.toLowerCase()}
        </span>
      ) : (
        <span
          className="uk-numfield__scrub"
          title="Drag to scrub"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          ↔
        </span>
      )}
      <input
        className="f-input uk-numfield__input"
        type="number"
        value={formattedVal}
        min={min}
        max={max}
        step={safeStep}
        onChange={(e) => onChange(clamp(parseFloat(e.target.value) || 0))}
      />
      {unit && <span className="uk-numfield__unit">{unit}</span>}
    </span>
  );
}

/* ---------- NumberSliderField ---------- */

function NumberSliderField({
  value = 0,
  onChange,
  onScrub,
  min = 0,
  max = 100,
  step = 1,
  unit,
}: {
  value?: number;
  onChange: (v: number) => void;
  onScrub?: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  const safeValue = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  const safeStep = step || 1;

  const clamp = (v: number) => {
    let out = v;
    if (min !== undefined && out < min) out = min;
    if (max !== undefined && out > max) out = max;
    return Math.round(out / safeStep) * safeStep;
  };

  const formattedVal = Number.isInteger(safeValue) ? safeValue : Number(safeValue.toFixed(3));

  return (
    <div className="uk-sliderfield">
      <div className="uk-sliderfield__input-box">
        <input
          className="uk-sliderfield__valinput"
          type="number"
          value={formattedVal}
          min={min}
          max={max}
          step={safeStep}
          onChange={(e) => onChange(clamp(parseFloat(e.target.value) || 0))}
        />
        {unit && <span className="uk-sliderfield__unit">{unit}</span>}
      </div>
      <div className="uk-sliderfield__track-wrapper">
        <input
          className="uk-sliderfield__range"
          type="range"
          min={min}
          max={max}
          step={safeStep}
          value={safeValue}
          onChange={(e) => (onScrub ?? onChange)(clamp(parseFloat(e.target.value) || 0))}
        />
      </div>
    </div>
  );
}

/* ---------- TextField ---------- */

export function TextField({
  value,
  onChange,
  placeholder,
  disabled,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <div className="uk-field-wrapper">
      <input
        className={`f-input ${error ? 'error' : ''}`}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      {error && <span className="uk-field-error">{error}</span>}
    </div>
  );
}

/* ---------- SelectField ---------- */

export function SelectField({
  value,
  options,
  onChange,
  disabled,
  error,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <div className="uk-field-wrapper uk-field-wrapper--select">
      <select
        className={`f-select ${error ? 'error' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {error && <span className="uk-field-error">{error}</span>}
    </div>
  );
}

/* ---------- ColorField ---------- */

function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // <input type=color> accepts only #rrggbb; rgba()/named values edit via the text input
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
  return (
    <span className="uk-colorfield">
      <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} aria-label="Color" />
      <input
        className="uk-input bs-mono"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  );
}

/* ---------- Vector3Field ---------- */

function Vector3Field({
  value,
  onChange,
  step = 0.1,
}: {
  value: number[];
  onChange: (v: number[]) => void;
  step?: number;
}) {
  const set = (i: number, v: number) => {
    const next = [...value];
    next[i] = v;
    onChange(next);
  };
  return (
    <span className="uk-vec3">
      {(['x', 'y', 'z'] as const).map((axis, i) => (
        <NumberField
          key={axis}
          axisLabel={axis}
          value={value[i] ?? 0}
          step={step}
          onChange={(v) => set(i, v)}
          onScrub={(v) => set(i, v)}
        />
      ))}
    </span>
  );
}
