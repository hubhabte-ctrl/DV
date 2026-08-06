/**
 * Preview Studio Root   " fully self-contained UI layout.
 * Preview is full-screen   " no inspector, no sidebar dock, minimal chrome.
 */
import { useEffect } from 'react';
import '../../app/ui/styles/ShellLayout.css';
import '../../app/ui/styles/UIKit.css';
import './styles/PreviewStudio.css';
import { PreviewTopBar } from './components/toolbar/PreviewTopBar';
import { PreviewMode } from './PreviewMode';
import { PreviewCommandPalette } from './components/palette/PreviewCommandPalette';
import { ConflictModal } from './components/modals/ConflictModal';
import { getUIState, setUIState, useUIState, undo, redo } from '@bs/engine';
import { isPlaying, pause, play } from '../../engine/progress';

export function PreviewStudioRoot() {
  const conflictVersion = useUIState((s) => s.conflictVersion);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = getUIState();
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if ((e.ctrlKey || e.metaKey) && key === 'k') { e.preventDefault(); setUIState({ paletteOpen: !ui.paletteOpen }); return; }
      if (e.code === 'Space') { e.preventDefault(); isPlaying() ? pause() : play(); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div data-studio="preview" className="bs-shell bs-shell--preview">
      <PreviewTopBar />
      <main className="bs-shell__workspace">
        <PreviewMode />
      </main>
      <PreviewCommandPalette />
      {conflictVersion !== null && <ConflictModal serverVersion={conflictVersion} onClose={() => setUIState({ conflictVersion: null })} />}
    </div>
  );
}
