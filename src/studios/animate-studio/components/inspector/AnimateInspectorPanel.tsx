/**
 * Animate Studio Inspector Panel   " self-contained.
 */
import { useState } from 'react';
import { Icons } from '../../../../app/ui/Icons';
import { setUIState, useUIState } from '@bs/engine';
import { AnimateStudioInspector } from '../../AnimateRegistration';
import { SegmentedControl } from '../common/SegmentedControl';

const TABS = [
  { value: 'timing', label: 'Timing' },
  { value: 'curves', label: 'Curves' },
  { value: 'triggers', label: 'Triggers' },
  { value: 'binding', label: 'Binding' },
];

export function AnimateInspectorPanel() {
  const query = useUIState((s) => s.inspectorSearch);
  const [subTab, setSubTab] = useState<any>('timing');
  return (
    <aside className="inspector bs-shell__inspector" id="inspectorPanel" role="complementary" aria-label="Inspector">
      <div className="insp-head-bar">
        <span className="section-label">Properties</span>
        <button className="icon-btn icon-sm drawer-close" id="inspClose" aria-label="Close inspector" onClick={() => setUIState({ inspectorCollapsed: true })}>
          {Icons.close || <svg className="i" data-size="12" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>}
        </button>
      </div>
      <div className="insp-head-bar" style={{ padding: '0 8px 8px 8px', borderBottom: '1px solid var(--bs-border)' }}>
        <SegmentedControl options={TABS} value={subTab} onChange={setSubTab} accent="blue" aria-label="Animation tabs" />
      </div>
      <div className="insp-scroll" id="inspBody">
        <AnimateStudioInspector subTab={subTab} query={query} />
      </div>
    </aside>
  );
}
