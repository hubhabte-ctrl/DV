/**
 * Asset Studio Inspector Panel   " self-contained.
 */
import { useState } from 'react';
import { Icons } from '../../../../app/ui/Icons';
import { setUIState, useUIState } from '@bs/engine';
import { AssetStudioInspector } from '../../AssetRegistration';
import { SegmentedControl } from '../common/SegmentedControl';

const TABS = [
  { value: 'identity', label: 'Identity' },
  { value: 'optimization', label: 'Optimization' },
  { value: 'usage', label: 'Usage' },
  { value: 'versions', label: 'Versions' },
];

export function AssetInspectorPanel() {
  const query = useUIState((s) => s.inspectorSearch);
  const [subTab, setSubTab] = useState<any>('identity');
  return (
    <aside className="inspector bs-shell__inspector" id="inspectorPanel" role="complementary" aria-label="Inspector">
      <div className="insp-head-bar">
        <SegmentedControl options={TABS} value={subTab} onChange={setSubTab} accent="blue" aria-label="Asset tabs" />
        <button className="icon-btn icon-sm drawer-close" id="inspClose" aria-label="Close inspector" onClick={() => setUIState({ inspectorCollapsed: true })}>
          {Icons.close || <svg className="i" data-size="12" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>}
        </button>
      </div>
      <div className="insp-scroll" id="inspBody">
        <AssetStudioInspector subTab={subTab} query={query} />
      </div>
    </aside>
  );
}
