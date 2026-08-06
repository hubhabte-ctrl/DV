/**
 * DOM Studio Inspector Panel   " self-contained inspector with chrome (title, tabs, scroll).
 * Renders DOMInspector content from DOMRegistration.
 */
import { useEffect, useState } from 'react';
import { Icons } from '../../../../app/ui/Icons';
import { setUIState, useUIState } from '@bs/engine';
import { DomStudioInspector } from '../../DOMRegistration';

const TABS = [
  { key: 'layout', label: 'Layout' },
  { key: 'design', label: 'Design' },
  { key: 'responsive', label: 'Responsive' },
];

export function DOMInspectorPanel() {
  const query = useUIState((s) => s.inspectorSearch);
  const [subTab, setSubTab] = useState('layout');

  return (
    <aside className="inspector bs-shell__inspector" id="inspectorPanel" role="complementary" aria-label="Inspector">
      <div className="insp-head-bar">
        <span className="section-label">Properties</span>
        <button
          className="icon-btn icon-sm drawer-close" id="inspClose"
          aria-label="Close inspector"
          onClick={() => setUIState({ inspectorCollapsed: true })}
        >
          {Icons.close || <svg className="i" data-size="12" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>}
        </button>
      </div>
      <div className="insp-tabs" id="inspTabs">
        {TABS.map((t) => (
          <button key={t.key} className={subTab === t.key ? 'active' : ''} data-tab={t.key} onClick={() => setSubTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="insp-scroll" id="inspBody">
        <DomStudioInspector subTab={subTab} query={query} />
      </div>
    </aside>
  );
}
