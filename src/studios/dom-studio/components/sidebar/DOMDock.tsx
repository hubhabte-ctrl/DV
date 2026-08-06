/**
 * DOM Studio Dock   " the left sidebar panel with tabs (Pages, Layers, Foundry, Blueprints).
 * Self-contained: owns chrome, tab strip, and search. Content from DOMSidebar.
 */
import { useEffect, useState } from 'react';
import { Icons } from '../../../../app/ui/Icons';
import { SearchInput } from '../common/SearchInput';
import { DOMSidebar } from './DOMSidebar';
import { DOMRailSettingsPopover } from './DOMRailSettingsPopover';
import { setUIState, useUIState } from '@bs/engine';

const TAB_LABELS: Record<string, string> = {
  pages: 'Pages', layers: 'Layers', components: 'Foundry', assets: 'Assets', templates: 'Blueprints',
};
const DOCK_TABS = ['pages', 'layers', 'components', 'templates'];

export function DOMDock() {
  const [tab, setTab] = useState('layers');
  const [search, setSearch] = useState('');
  const scopeKey = tab;
  const [prevScope, setPrevScope] = useState(scopeKey);
  if (scopeKey !== prevScope) { setPrevScope(scopeKey); setSearch(''); }

  return (
    <div className="bs-shell__leftrail bs-leftrail-root">
      {/* Activity Rail   " studio switcher (global nav) */}
      <nav className="rail" role="navigation" aria-label="Studio switcher">
        <ActivityRailButtons />
        <div className="rail-bottom">
          <span className="rail-sep" />
          <DOMRailSettingsPopover />
        </div>
      </nav>
      {/* Dock Panel */}
      <aside className="bs-dock bs-dock-inner" role="complementary" aria-label="Layers">
        <div className="bs-dock__tabs" role="tablist" aria-label="Panel sections">
          {DOCK_TABS.map((t) => (
            <button
              key={t} type="button" role="tab"
              id={`bs-dock-tab-${t}`}
              aria-selected={tab === t}
              aria-controls="bs-dock-panel"
              className={`bs-dock__tab ${tab === t ? 'bs-dock__tab--on' : ''}`}
              onClick={() => setTab(t)}
            >{TAB_LABELS[t] ?? t}</button>
          ))}
        </div>
        <div className="bs-dock__header">
          <span className="bs-dock__title">{TAB_LABELS[tab] ?? tab}</span>
          <div className="bs-dock__actions">
            <button type="button" className="icon-btn uk-iconbtn icon-sm" title="Add layer" aria-label="Add layer" onClick={() => {}}>
              {Icons.plus}
            </button>
          </div>
        </div>
        {tab !== 'components' && (
          <SearchInput value={search} onChange={setSearch} placeholder={`Search ${TAB_LABELS[tab] ?? tab}…`} />
        )}
        <div className="bs-dock__scroll" id="bs-dock-panel" role="tabpanel" aria-labelledby={`bs-dock-tab-${tab}`}>
          <DOMSidebar tab={tab} search={search} />
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
        aria-label="DOM Studio (Canvas & Layers)" aria-current={mode === 'dom' ? 'page' : undefined}
        onClick={() => setUIState({ mode: 'dom' })}>{Icons.layers || Icons.code}<span className="rail-tooltip">DOM</span></button>
      <button type="button" className={`rail-btn ${mode === '3d' ? 'active' : ''}`} data-studio="3d"
        aria-label="3D Studio (Scene)" aria-current={mode === '3d' ? 'page' : undefined}
        onClick={() => setUIState({ mode: '3d' })}>{Icons.cube}<span className="rail-tooltip">3D Scene</span></button>
      <button type="button" className={`rail-btn ${mode === 'animate' ? 'active' : ''}`} data-studio="anim"
        aria-label="Timeline Studio" aria-current={mode === 'animate' ? 'page' : undefined}
        onClick={() => setUIState({ mode: 'animate' })}>{Icons.clock || Icons.track}<span className="rail-tooltip">Animate</span></button>
      <button type="button" className={`rail-btn ${mode === 'material' ? 'active' : ''}`} data-studio="material"
        aria-label="Material Studio" aria-current={mode === 'material' ? 'page' : undefined}
        onClick={() => setUIState({ mode: 'material' })}>{Icons.palette}<span className="rail-tooltip">Material</span></button>
      <span className="rail-sep" />
      <button type="button" className={`rail-btn ${mode === 'assets' ? 'active' : ''}`} data-studio="asset"
        aria-label="Asset Studio" aria-current={mode === 'assets' ? 'page' : undefined}
        onClick={() => setUIState({ mode: 'assets' })}>{Icons.image || Icons.folder}<span className="rail-tooltip">Assets</span></button>
      <button type="button" className={`rail-btn ${mode === 'preview' ? 'active' : ''}`} data-studio="preview"
        aria-label="Preview Studio" aria-current={mode === 'preview' ? 'page' : undefined}
        onClick={() => setUIState({ mode: 'preview' })}>{Icons.play}<span className="rail-tooltip">Preview</span></button>
    </>
  );
}
