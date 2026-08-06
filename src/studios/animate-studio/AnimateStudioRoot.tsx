/**
 * Animate Studio Root   " fully self-contained UI layout.
 */
import { useEffect, type CSSProperties } from 'react';
import '../../app/ui/styles/ShellLayout.css';
import './styles/LeftRail.css';
import './styles/Inspector.css';
import './styles/CanvasChrome.css';
import '../../app/ui/styles/UIKit.css';
import './styles/AnimateStudio.css';
import { AnimateTopBar } from './components/toolbar/AnimateTopBar';
import { AnimateViewport } from './components/viewport/AnimateViewport';
import { AnimateTimelinePanel } from './components/panels/AnimateTimelinePanel';
import { AnimateDock } from './components/sidebar/AnimateDock';
import { AnimateInspectorPanel } from './components/inspector/AnimateInspectorPanel';
import { AnimateStatusBar } from './components/statusbar/AnimateStatusBar';
import { AnimateCommandPalette } from './components/palette/AnimateCommandPalette';
import { ConflictModal } from './components/modals/ConflictModal';
import { PanelSplitter } from '../../app/PanelSplitter';
import { deleteKeyframe } from '@bs/engine';
import { addKeyframeAtPlayhead, copySelectedKeyframes, deleteSelectedKeyframes, pasteKeyframesAtPlayhead } from '.';
import { getUIState, setUIState, useUIState, undo, redo, setPanelDimension } from '@bs/engine';
import { isPlaying, pause, play } from '../../engine/progress';
import { toast } from '../../app/ui/Toast';

export function AnimateStudioRoot() {
  const leftRailW = useUIState((s) => s.leftRailW);
  const inspectorW = useUIState((s) => s.inspectorW);
  const timelineH = useUIState((s) => s.timelineH);
  const leftCollapsed = useUIState((s) => s.leftRailCollapsed);
  const rightCollapsed = useUIState((s) => s.inspectorCollapsed);
  const timelineCollapsed = useUIState((s) => s.timelineCollapsed);
  const conflictVersion = useUIState((s) => s.conflictVersion);

  useEffect(() => { setPanelDimension('timeline', Math.round(window.innerHeight * 0.4)); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = getUIState();
      const inField = ['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName);
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if ((e.ctrlKey || e.metaKey) && key === 'k') { e.preventDefault(); setUIState({ paletteOpen: !ui.paletteOpen }); return; }
      if (inField || ui.paletteOpen) return;
      if ((e.ctrlKey || e.metaKey) && key === 'c') { if (copySelectedKeyframes()) e.preventDefault(); return; }
      if ((e.ctrlKey || e.metaKey) && key === 'v') { if (pasteKeyframesAtPlayhead()) e.preventDefault(); return; }
      if (e.code === 'Space') { e.preventDefault(); isPlaying() ? pause() : play(); return; }
      if (key === 'k') addKeyframeAtPlayhead(ui.selectedTrackId);
      if (key === 'g' && !e.ctrlKey && !e.metaKey) setUIState({ timelineGraphMode: !ui.timelineGraphMode });
      if ((key === 'delete' || key === 'backspace') && ui.mode === 'animate') {
        if (!deleteSelectedKeyframes() && ui.selectedTrackId && ui.selectedKeyframeT !== null) {
          deleteKeyframe(ui.selectedTrackId, ui.selectedKeyframeT);
          setUIState({ selectedKeyframeT: null });
          toast('Keyframe deleted');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div data-studio="timeline" className="bs-shell"
      style={{ '--bs-size-leftRailW': leftCollapsed ? '0px' : `${leftRailW}px`, '--bs-size-inspectorW': rightCollapsed ? '0px' : `${inspectorW}px`, '--bs-size-timelineH': timelineCollapsed ? '34px' : `${timelineH}px` } as CSSProperties}>
      <AnimateTopBar />
      <AnimateDock />
      <main className="bs-shell__workspace">
        <AnimateViewport />
        <PanelSplitter side="leftRail" />
        <PanelSplitter side="inspector" />
      </main>
      <AnimateInspectorPanel />
      <div style={{ position: 'relative', gridArea: 'timeline', minHeight: 0 }}>
        <PanelSplitter side="timeline" />
        <AnimateTimelinePanel />
      </div>
      <AnimateStatusBar />
      <AnimateCommandPalette />
      {conflictVersion !== null && <ConflictModal serverVersion={conflictVersion} onClose={() => setUIState({ conflictVersion: null })} />}
    </div>
  );
}
