/**
 * Rail Settings popover   " SSOT `renderSettingsPopover()`
 * (`UI_UX_reference/src/app/App.ts:267-278`), CSS `styles/shell.css:283-315`.
 *
 * Adopted under ruling R3 ("hold AI, Settings popover"): the rail's bottom
 * button becomes the SSOT Settings control instead of the Command Palette
 * launcher. No capability is lost   " the palette keeps both of its other entry
 * points (global Ctrl+K at `app/App.tsx:148-152`, and Edit  -  "Find & Search
 * Commands   " at `TopBar.tsx`).
 *
 * Every row is wired to state production already owns; nothing here invents a
 * feature (CLAUDE.md   5.2):
 *   Theme         ' `toggleTheme()`   (@bs/engine store)
 *   Canvas Grid   ' `toggleGrid()`    (drives DOMViewport.tsx:416)
 *   Ruler         ' `toggleRulers()`  (drives DOMViewport.tsx:527-529)
 *   Export        ' `exportProjectJson()` (shared with the File menu)
 * The SSOT's "Version History" row has no production counterpart   " see the
 * documented deviation at its call site below.
 */
import { useEffect, useRef, useState } from 'react';
import { Icons } from '../../../../app/ui/Icons'
import { toggleGrid, toggleRulers, toggleTheme, useUIState } from '@bs/engine';
import { exportProjectJson } from '../../../../engine/exportProject';

export function AnimateRailSettingsPopover() {
  const theme = useUIState((s) => s.theme);
  const showGrid = useUIState((s) => s.showGrid);
  const showRulers = useUIState((s) => s.showRulers);

  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  /* Dismiss on outside pointer-down and on Escape. The SSOT closes on any
     document click (`App.ts:1411`); Escape is added because a keyboard user who
     opened the popover otherwise has no way to dismiss it (  2.3). Focus returns
     to the trigger so the tab position is not lost. */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      btnRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="rail-btn"
        aria-label="Settings"
        aria-expanded={open}
        aria-controls="bs-rail-settings"
        onClick={() => setOpen((v) => !v)}
      >
        {Icons.settings}
        <span className="rail-tooltip">Settings</span>
      </button>

      {/* Sibling of `.rail-bottom`, matching the SSOT, which appends the
          popover to `nav.rail` after the bottom cluster (`App.ts:262`). */}
      <div
        ref={popRef}
        id="bs-rail-settings"
        className={`settings-pop ${open ? 'show' : ''}`}
        role="group"
        aria-label="Settings"
      >
        <span className="sp-section" id="bs-sp-appearance">
          Appearance
        </span>
        <button
          type="button"
          className="sp-row"
          aria-pressed={theme === 'light'}
          onClick={toggleTheme}
        >
          <span>Theme</span>
          <span className="sp-row-value">{theme === 'light' ? 'Light' : 'Dark'}</span>
        </button>
        <button type="button" className="sp-row" aria-pressed={showGrid} onClick={toggleGrid}>
          <span>Canvas Grid</span>
          <span className="sp-row-value">{showGrid ? 'On' : 'Off'}</span>
        </button>
        <button type="button" className="sp-row" aria-pressed={showRulers} onClick={toggleRulers}>
          <span>Ruler</span>
          <span className="sp-row-value">{showRulers ? 'On' : 'Off'}</span>
        </button>

        <span className="sp-divider" />

        <span className="sp-section">Project</span>
        <button type="button" className="sp-row" onClick={exportProjectJson}>
          <span>Export</span>
        </button>
        {/* DEVIATION from SSOT (`App.ts:276`), per CLAUDE.md   5.3.
            SSOT behaviour: a "Version History" row. It is inert there too   " the
            reference binds no handler to it (`App.ts:1405-1422` wires only
            #settingsBtn/#themeRow/#gridRow/#rulerRow).
            Why not copied: production has no version-history capability to
            open, and   5.2 forbids inventing one. Shipping the row anyway would
            advertise a feature that does not exist, and a control that does
            nothing when activated fails   2.3.
            Authorising clause:   5.2 (do not invent features) over a literal
            structural match.
            What replaces it: nothing   " the row is omitted. Restore it in the
            same position, above no other row, when version history ships. */}
      </div>
    </>
  );
}
