import { useState, type ReactNode } from 'react';

/** Collapsible Inspector group   " matches .insp-group / .ig-head pattern (Doc 05   2). */
export function CollapsibleSection({
  title,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  /**
   * Optional glyph rendered before the title. Decorative: the title already
   * names the group, so the icon is `aria-hidden` and adds nothing for a screen
   * reader. Pass it to help sighted users find a group by shape when scanning a
   * long panel; omit it rather than inventing one per group.
   */
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="grp">
      <div
        className="grp-header"
        role="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="grp-heading">
          {icon && (
            <span className="grp-icon" aria-hidden="true">
              {icon}
            </span>
          )}
          <span className="grp-title">{title}</span>
        </span>
        <svg
          className={`grp-toggle ${open ? '' : 'collapsed'}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: 12, height: 12 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {open && <div className="grp-body">{children}</div>}
    </div>
  );
}
