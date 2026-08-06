/**
 * Asset Studio Root   " fully self-contained UI layout.
 */
import { useEffect, type CSSProperties } from 'react';
import '../../app/ui/styles/ShellLayout.css';
import './styles/LeftRail.css';
import './styles/Inspector.css';
import '../../app/ui/styles/UIKit.css';
import './styles/AssetStudio.css';
import { AssetWorkspace } from './components/viewport/AssetWorkspace';
import { AssetIngestTray } from './components/panels/AssetIngestTray';
import { AssetDock } from './components/sidebar/AssetDock';
import { AssetInspectorPanel } from './components/inspector/AssetInspectorPanel';
import { AssetStatusBar } from './components/statusbar/AssetStatusBar';
import { AssetCommandPalette } from './components/palette/AssetCommandPalette';
import { ConflictModal } from './components/modals/ConflictModal';
import { AssetTopBar } from './components/toolbar/AssetTopBar';
import { PanelSplitter } from '../../app/PanelSplitter';
import { importFilesWithTray } from '.';
import { getUIState, setUIState, useUIState, undo, redo } from '@bs/engine';

export function AssetStudioRoot() {
  const leftRailW = useUIState((s) => s.leftRailW);
  const inspectorW = useUIState((s) => s.inspectorW);
  const leftCollapsed = useUIState((s) => s.leftRailCollapsed);
  const rightCollapsed = useUIState((s) => s.inspectorCollapsed);
  const conflictVersion = useUIState((s) => s.conflictVersion);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = getUIState();
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if ((e.ctrlKey || e.metaKey) && key === 'k') { e.preventDefault(); setUIState({ paletteOpen: !ui.paletteOpen }); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div data-studio="asset" className="bs-shell bs-shell--no-timeline"
      style={{ '--bs-size-leftRailW': leftCollapsed ? '0px' : `${leftRailW}px`, '--bs-size-inspectorW': rightCollapsed ? '0px' : `${inspectorW}px` } as CSSProperties}>
      <AssetTopBar />
      <AssetDock />
      <main className="bs-shell__workspace">
        <AssetWorkspace onImport={importFilesWithTray} />
        <AssetIngestTray />
        <PanelSplitter side="leftRail" />
        <PanelSplitter side="inspector" />
      </main>
      <AssetInspectorPanel />
      <AssetStatusBar />
      <AssetCommandPalette />
      {conflictVersion !== null && <ConflictModal serverVersion={conflictVersion} onClose={() => setUIState({ conflictVersion: null })} />}
    </div>
  );
}
