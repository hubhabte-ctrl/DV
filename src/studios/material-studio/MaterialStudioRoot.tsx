/**
 * Material Studio Root   " fully self-contained UI layout.
 */
import { useEffect, type CSSProperties } from 'react';
import '../../app/ui/styles/ShellLayout.css';
import './styles/LeftRail.css';
import './styles/Inspector.css';
import '../../app/ui/styles/UIKit.css';
import './styles/MaterialStudio.css';
import { MaterialWorkspace } from './components/viewport/MaterialWorkspace';
import { MaterialDock } from './components/sidebar/MaterialDock';
import { MaterialInspectorPanel } from './components/inspector/MaterialInspectorPanel';
import { MaterialStatusBar } from './components/statusbar/MaterialStatusBar';
import { MaterialCommandPalette } from './components/palette/MaterialCommandPalette';
import { ConflictModal } from './components/modals/ConflictModal';
import { MaterialTopBar } from './components/toolbar/MaterialTopBar';
import { PanelSplitter } from '../../app/PanelSplitter';
import { getUIState, setUIState, useUIState, undo, redo } from '@bs/engine';
import { toast } from '../../app/ui/Toast';

export function MaterialStudioRoot() {
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
    <div data-studio="material" className="bs-shell bs-shell--no-timeline"
      style={{ '--bs-size-leftRailW': leftCollapsed ? '0px' : `${leftRailW}px`, '--bs-size-inspectorW': rightCollapsed ? '0px' : `${inspectorW}px` } as CSSProperties}>
      <MaterialTopBar />
      <MaterialDock />
      <main className="bs-shell__workspace">
        <MaterialWorkspace />
        <PanelSplitter side="leftRail" />
        <PanelSplitter side="inspector" />
      </main>
      <MaterialInspectorPanel />
      <MaterialStatusBar />
      <MaterialCommandPalette />
      {conflictVersion !== null && <ConflictModal serverVersion={conflictVersion} onClose={() => setUIState({ conflictVersion: null })} />}
    </div>
  );
}
