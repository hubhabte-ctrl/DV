/**
 * Material Studio Inspector Panel   " self-contained.
 */
import { useState } from 'react';
import { Icons } from '../../../../app/ui/Icons';
import { setUIState, useUIState } from '@bs/engine';
import { MaterialStudioInspector } from '../../MaterialRegistration';
import { SegmentedControl } from '../common/SegmentedControl';

const TABS = [
  { value: 'channels', label: 'PBR' },
  { value: 'maps', label: 'Maps' },
  { value: 'shader', label: 'Presets' },
  { value: 'preview', label: 'Summary' },
];

export function MaterialInspectorPanel() {
  const query = useUIState((s) => s.inspectorSearch);
  const [subTab, setSubTab] = useState('channels');
  return (
    <aside className="inspector bs-shell__inspector" id="inspectorPanel" role="complementary" aria-label="Inspector">
      <div className="insp-head-bar">
        <SegmentedControl options={TABS} value={subTab} onChange={setSubTab} accent="blue" aria-label="Material tabs" />
        <button className="icon-btn icon-sm drawer-close" id="inspClose" aria-label="Close inspector" onClick={() => setUIState({ inspectorCollapsed: true })}>
          {Icons.close || <svg className="i" data-size="12" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>}
        </button>
      </div>
      <div className="insp-scroll" id="inspBody">
        <MaterialStudioInspector subTab={subTab} query={query} />
      </div>
    </aside>
  );
}
