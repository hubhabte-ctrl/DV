import type { ReactNode } from 'react';

export interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  accent?: 'brand' | 'waypoint' | 'clay' | 'blue';
  'aria-label': string;
}

/** Shared segmented switcher   " used by the Mode Switch and Device Profile switcher (Doc 05   2). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accent,
  ...aria
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`uk-seg ${accent ? `uk-seg--${accent}` : ''}`}
      role="tablist"
      aria-label={aria['aria-label']}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={opt.value === value}
          className={`uk-seg__item ${opt.value === value ? 'uk-seg__item--active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.icon && <span className="uk-seg__icon">{opt.icon}</span>}
          <span className="uk-seg__label">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
