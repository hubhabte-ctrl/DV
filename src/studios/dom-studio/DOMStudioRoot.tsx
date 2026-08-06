/**
 * DOM Studio Root   " fully self-contained UI layout.
 * Owns: TopBar, Sidebar/Dock, Viewport, Inspector, StatusBar, CommandPalette,
 * keyboard shortcuts, and all modals. No shared shell components.
 *
 * Architecture: Studio separation exists ONLY at the UI layer.
 * Platform infrastructure (@bs/engine, @bs/services) remains shared.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import '../../app/ui/styles/ShellLayout.css';
import './styles/LeftRail.css';
import './styles/Inspector.css';
import './styles/CanvasChrome.css';
import '../../app/ui/styles/UIKit.css';
import './styles/DOMStudio.css';

// Studio-owned TopBar
import { DOMTopBar } from './components/toolbar/DOMTopBar';
// Studio-owned Viewport + bottom
import { DOMViewport } from './components/viewport/DOMViewport';
import { DOMProfileBar } from './components/toolbar/DOMProfileBar';
import { DOMFlowStrip } from './components/panels/DOMFlowStrip';
// Studio-owned Inspector
import { DOMInspectorPanel } from './components/inspector/DOMInspectorPanel';
// Studio-owned Sidebar (Dock)
import { DOMDock } from './components/sidebar/DOMDock';
// Studio-owned StatusBar
import { DOMStatusBar } from './components/statusbar/DOMStatusBar';
// Studio-owned CommandPalette
import { DOMCommandPalette } from './components/palette/DOMCommandPalette';
// Studio-owned modals
import { ConflictModal } from './components/modals/ConflictModal';

import {
  getUIState,
  setPanelDimension,
  setUIState,
  togglePanelCollapsed,
  useUIState,
  undo,
  redo,
  duplicateDomNode,
  removeDomNode,
  removeWaypoint,
} from '@bs/engine';
import { toast } from '../../app/ui/Toast';
import { PanelSplitter } from '../../app/PanelSplitter';

export function DOMStudioRoot() {
  const leftRailW = useUIState((s) => s.leftRailW);
  const inspectorW = useUIState((s) => s.inspectorW);
  const leftCollapsed = useUIState((s) => s.leftRailCollapsed);
  const rightCollapsed = useUIState((s) => s.inspectorCollapsed);
  const conflictVersion = useUIState((s) => s.conflictVersion);

  // DOM Studio keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = getUIState();
      const inField = ['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName);
      const key = e.key.toLowerCase();

      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === 'k') {
        e.preventDefault();
        setUIState({ paletteOpen: !ui.paletteOpen });
        return;
      }
      if (inField || ui.paletteOpen) return;

      if ((e.ctrlKey || e.metaKey) && key === 'd' && ui.selectedDomNodeId) {
        e.preventDefault();
        const newId = duplicateDomNode(ui.selectedDomNodeId);
        if (newId) { setUIState({ selectedDomNodeId: newId }); toast('Node duplicated'); }
        return;
      }
      if (key === 'delete' || key === 'backspace') {
        if (ui.selectedWaypointId) {
          removeWaypoint(ui.selectedWaypointId);
          setUIState({ selectedWaypointId: null });
          toast('Waypoint deleted');
        } else if (ui.selectedDomNodeId) {
          if (removeDomNode(ui.selectedDomNodeId)) {
            setUIState({ selectedDomNodeId: null });
            toast('Node deleted — Ctrl+Z restores the subtree');
          } else {
            toast('Sections are top-level scroll panels — reorder them in the left rail');
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      data-studio="dom"
      className="bs-shell"
      style={{
        '--bs-size-leftRailW': leftCollapsed ? '0px' : `${leftRailW}px`,
        '--bs-size-inspectorW': rightCollapsed ? '0px' : `${inspectorW}px`,
        '--bs-size-timelineH': '88px',
      } as CSSProperties}
    >
      <DOMTopBar />
      <DOMDock />
      <main className="bs-shell__workspace">
        <DOMProfileBar />
        <DOMViewport />
        <PanelSplitter side="leftRail" />
        <PanelSplitter side="inspector" />
      </main>
      <DOMInspectorPanel />
      <div style={{ gridArea: 'timeline', minHeight: 0 }}>
        <DOMFlowStrip />
      </div>
      <DOMStatusBar />
      <DOMCommandPalette />
      {conflictVersion !== null && (
        <ConflictModal
          serverVersion={conflictVersion}
          onClose={() => setUIState({ conflictVersion: null })}
        />
      )}
    </div>
  );
}
