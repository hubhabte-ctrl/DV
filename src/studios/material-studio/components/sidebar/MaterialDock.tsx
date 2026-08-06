/**
 * Material Studio Dock   " left sidebar.
 */
import { useState } from 'react';
import { Icons } from '../../../../app/ui/Icons';
import { SearchInput } from '../common/SearchInput';
import { setUIState, useUIState } from '@bs/engine';
import { MaterialSidebar } from './MaterialSidebar';
import { MaterialRailSettingsPopover } from './MaterialRailSettingsPopover';

const TAB_LABELS: Record<string, string> = { materials: 'Materials', layers: 'Layers' };
const DOCK_TABS = ['materials', 'layers'];

export function MaterialDock() {
  const [tab, setTab] = useState('materials');
  const [search, setSearch] = useState('');
  const [prev, setPrev] = useState(tab);
  if (tab !== prev) { setPrev(tab); setSearch(''); }

  return (
    <div className="bs-shell__leftrail bs-leftrail-root">
      <nav className="rail" role="navigation" aria-label="Studio switcher">
        <ActivityRailButtons />
        <div className="rail-bottom"><span className="rail-sep" /><MaterialRailSettingsPopover /></div>
      </nav>
      <aside className="bs-dock bs-dock-inner" role="complementary" aria-label="Materials">
        <div className="bs-dock__tabs" role="tablist">
          {DOCK_TABS.map((t) => (
            <button key={t} type="button" role="tab" id={`bs-dock-tab-${t}`} aria-selected={tab === t} aria-controls="bs-dock-panel"
              className={`bs-dock__tab ${tab === t ? 'bs-dock__tab--on' : ''}`} onClick={() => setTab(t)}>
              {TAB_LABELS[t] ?? t}
            </button>
          ))}
        </div>
        <div className="bs-dock__header">
          <span className="bs-dock__title">{TAB_LABELS[tab]}</span>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder={`Search ${TAB_LABELS[tab]}…`} />
        <div className="bs-dock__scroll" id="bs-dock-panel">
          <MaterialSidebar tab={tab} search={search} />
        </div>
      </aside>
    </div>
  );
}

function ActivityRailButtons() {
  const mode = useUIState((s) => s.mode);
  return (
    <>
      <button type="button" className={`rail-btn ${mode === 'dom' ? 'active' : ''}`} data-studio="dom"
        aria-label="DOM Studio" aria-current={mode === 'dom' ? 'page' : undefined}
        onClick={() => setUIState({ mode: 'dom' })}>{Icons.layers}<span className="rail-tooltip">DOM</span></button>
      <button type="button" className={`rail-btn ${mode === '3d' ? 'active' : ''}`} data-studio="3d"
        aria-label="3D Studio" aria-current={mode === '3d' ? 'page' : undefined}
        onClick={() => setUIState({ mode: '3d' })}>{Icons.cube}<span className="rail-tooltip">3D Scene</span></button>
      <button type="button" className={`rail-btn ${mode === 'animate' ? 'active' : ''}`} data-studio="anim"
        aria-label="Timeline Studio" aria-current={mode === 'animate' ? 'page' : undefined}
        onClick={() => setUIState({ mode: 'animate' })}>{Icons.clock}<span className="rail-tooltip">Animate</span></button>
      <button type="button" className={`rail-btn ${mode === 'material' ? 'active' : ''}`} data-studio="material"
        aria-label="Material Studio" aria-current={mode === 'material' ? 'page' : undefined}
        onClick={() => setUIState({ mode: 'material' })}>{Icons.palette}<span className="rail-tooltip">Material</span></button>
      <span className="rail-sep" />
      <button type="button" className={`rail-btn ${mode === 'assets' ? 'active' : ''}`} data-studio="asset"
        aria-label="Asset Studio" aria-current={mode === 'assets' ? 'page' : undefined}
        onClick={() => setUIState({ mode: 'assets' })}>{Icons.image}<span className="rail-tooltip">Assets</span></button>
      <button type="button" className={`rail-btn ${mode === 'preview' ? 'active' : ''}`} data-studio="preview"
        aria-label="Preview Studio" aria-current={mode === 'preview' ? 'page' : undefined}
        onClick={() => setUIState({ mode: 'preview' })}>{Icons.play}<span className="rail-tooltip">Preview</span></button>
    </>
  );
}
