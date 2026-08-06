/**
 * Scene3D Studio Root   " fully self-contained UI layout.
 */
import { useEffect, type CSSProperties } from 'react';
import '../../app/ui/styles/ShellLayout.css';
import './styles/LeftRail.css';
import './styles/Inspector.css';
import './styles/CanvasChrome.css';
import '../../app/ui/styles/UIKit.css';
import './styles/Scene3DStudio.css';
import { Scene3DTopBar } from './components/toolbar/Scene3DTopBar';
import { Scene3DViewport } from './components/viewport/Scene3DViewport';
import { Scene3DShotBar } from './components/toolbar/Scene3DShotBar';
import { Scene3DDock } from './components/sidebar/Scene3DDock';
import { Scene3DInspectorPanel } from './components/inspector/Scene3DInspectorPanel';
import { Scene3DStatusBar } from './components/statusbar/Scene3DStatusBar';
import { Scene3DCommandPalette } from './components/palette/Scene3DCommandPalette';
import { ConflictModal } from './components/modals/ConflictModal';
import { PanelSplitter } from '../../app/PanelSplitter';
import { getUIState, setUIState, useUIState, undo, redo, duplicateSceneNode, removeSceneNode, groupSceneNode, ungroupSceneNode, setPanelDimension } from '@bs/engine';
import { toast } from '../../app/ui/Toast';
import { getViewport } from '../../viewport/handleRegistry';

export function Scene3DStudioRoot() {
  const leftRailW = useUIState((s) => s.leftRailW);
  const inspectorW = useUIState((s) => s.inspectorW);
  const leftCollapsed = useUIState((s) => s.leftRailCollapsed);
  const rightCollapsed = useUIState((s) => s.inspectorCollapsed);
  const conflictVersion = useUIState((s) => s.conflictVersion);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = getUIState();
      const inField = ['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName);
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if ((e.ctrlKey || e.metaKey) && key === 'k') { e.preventDefault(); setUIState({ paletteOpen: !ui.paletteOpen }); return; }
      if (inField || ui.paletteOpen) return;
      if ((e.ctrlKey || e.metaKey) && key === 'd' && ui.selectedSceneNodeId) {
        e.preventDefault();
        const newId = duplicateSceneNode(ui.selectedSceneNodeId);
        if (newId) { setUIState({ selectedSceneNodeId: newId }); toast('Scene node duplicated'); } return;
      }
      if ((e.ctrlKey || e.metaKey) && key === 'g' && ui.selectedSceneNodeId) {
        e.preventDefault();
        if (e.shiftKey) { if (ungroupSceneNode(ui.selectedSceneNodeId)) { setUIState({ selectedSceneNodeId: null }); toast('Group dissolved'); } }
        else { const gid = groupSceneNode(ui.selectedSceneNodeId); if (gid) { setUIState({ selectedSceneNodeId: gid }); toast('Grouped'); } } return;
      }
      if (key === 'q') setUIState({ tool: 'select' });
      else if (key === 'w') setUIState({ tool: 'translate' });
      else if (key === 'e') setUIState({ tool: 'rotate' });
      else if (key === 'r') setUIState({ tool: 'scale' });
      else if (key === 'f') getViewport()?.frameSelected();
      if ((key === 'delete' || key === 'backspace') && ui.selectedSceneNodeId) {
        if (removeSceneNode(ui.selectedSceneNodeId)) { setUIState({ selectedSceneNodeId: null }); toast('Scene node deleted   " Ctrl+Z restores'); }
        else toast('The active camera cannot be deleted');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div data-studio="3d" className="bs-shell"
      style={{ '--bs-size-leftRailW': leftCollapsed ? '0px' : `${leftRailW}px`, '--bs-size-inspectorW': rightCollapsed ? '0px' : `${inspectorW}px`, '--bs-size-timelineH': '44px' } as CSSProperties}>
      <Scene3DTopBar />
      <Scene3DDock />
      <main className="bs-shell__workspace">
        <Scene3DViewport navigation="editor" />
        <PanelSplitter side="leftRail" />
        <PanelSplitter side="inspector" />
      </main>
      <Scene3DInspectorPanel />
      <div style={{ gridArea: 'timeline', minHeight: 0 }}><Scene3DShotBar /></div>
      <Scene3DStatusBar />
      <Scene3DCommandPalette />
      {conflictVersion !== null && <ConflictModal serverVersion={conflictVersion} onClose={() => setUIState({ conflictVersion: null })} />}
    </div>
  );
}
