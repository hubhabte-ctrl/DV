import { Icons } from '../../../../app/ui/Icons';

/** Search input   " every list is searchable/filterable (Doc 05   2); also powers the
 *  search-driven Inspector (PRD-F-17). Styling is SSOT `.lp-search` (UIKit.css);
 *  no inline styles here per governance   9.
 *  T4.3:    K kbd chip removed   " SSOT `.lp-search` emits no shortcut hint. */
export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="uk-search">
      <span className="uk-search__icon" aria-hidden="true">
        {Icons.search}
      </span>
      <input
        className="uk-input"
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

