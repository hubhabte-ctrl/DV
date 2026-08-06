/**
 * Menubar dropdown (Phase 2.9   " audit U-3): REAL File/Edit/View/Insert menus.
 * Accessible: aria-haspopup/expanded, Escape closes, ArrowUp/Down navigate,
 * Enter activates (spec template   11 a11y bar). Styles live in UIKit.css   "
 * no inline hover mutation (audit U-2).
 */
import { useEffect, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  onSelect?: () => void;
  /** renders a separator line above this item */
  separator?: boolean;
}

export function MenuButton({
  label,
  items,
  alignRight,
}: {
  label: string;
  items: MenuItem[];
  alignRight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDocDown);
    return () => document.removeEventListener('pointerdown', onDocDown);
  }, [open]);

  const enabled = items.map((it, i) => (!it.disabled ? i : -1)).filter((i) => i >= 0);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
        setActiveIdx(enabled[0] ?? -1);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const pos = enabled.indexOf(activeIdx);
      const next = enabled[(pos + dir + enabled.length) % enabled.length];
      setActiveIdx(next ?? -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[activeIdx];
      if (item && !item.disabled) {
        setOpen(false);
        item.onSelect?.();
      }
    }
  };

  return (
    <div className="uk-menu" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        className={`uk-menu__btn ${open ? 'uk-menu__btn--open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open && (
        <div
          className={`uk-menu__list ${alignRight ? 'uk-menu__list--right' : ''}`}
          role="menu"
          aria-label={`${label} menu`}
        >
          {items.map((it, i) => (
            <div key={`${it.label}-${i}`}>
              {it.separator && <div className="uk-menu__sep" role="separator" />}
              <button
                className={`uk-menu__item ${i === activeIdx ? 'uk-menu__item--active' : ''}`}
                role="menuitem"
                disabled={it.disabled}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => {
                  if (it.disabled) return;
                  setOpen(false);
                  it.onSelect?.();
                }}
              >
                <span className="uk-menu__item-label">
                  {it.icon && <span className="uk-menu__item-icon">{it.icon}</span>}
                  <span>{it.label}</span>
                </span>
                {it.shortcut && <kbd className="uk-menu__kbd">{it.shortcut}</kbd>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
