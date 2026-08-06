/**
 * Status bar (v4 reference .statusbar): low-frequency editor status readout.
 * Counts and selection come from the manifest/UI store; the progress readout
 * subscribes to the [0,1] clock directly and writes the DOM per-frame,
 * bypassing React (IL-2, Doc 04   5).
 */
import { useEffect, useRef, useState } from 'react';
import { getManifest, subscribeManifest } from '@bs/engine';
import { getProgress, subscribeProgress } from '../../../../engine/progress';
import { useUIState, type EditorMode } from '@bs/engine';

const MODE_LABEL: Record<EditorMode, string> = {
  dom: 'DOM Canvas',
  '3d': '3D Studio',
  material: 'Material Studio',
  assets: 'Asset Studio',
  animate: 'Animate',
  preview: 'Preview',
};

export function AssetStatusBar() {
  const mode = useUIState((s) => s.mode);
  const profile = useUIState((s) => s.profile);
  const quality = useUIState((s) => s.qualityLevel);
  const saveState = useUIState((s) => s.saveState);
  const selDom = useUIState((s) => s.selectedDomNodeId);
  const selScene = useUIState((s) => s.selectedSceneNodeId);
  const [, force] = useState(0);
  const pctRef = useRef<HTMLElement>(null);

  useEffect(() => subscribeManifest(() => force((n) => n + 1)), []);
  useEffect(() => {
    const apply = (p: number) => {
      if (pctRef.current) pctRef.current.textContent = `${Math.round(p * 100)}%`;
    };
    apply(getProgress());
    return subscribeProgress(apply);
  }, []);

  const m = getManifest();
  const selection =
    (selDom && m.domNodes[selDom]?.label) || (selScene && m.sceneNodes[selScene]?.label) || 'No selection';

  return (
    <footer className="bs-statusbar" role="status" aria-label="Editor status">
      <span className="bs-statusbar__item">
        {MODE_LABEL[mode]} <b>{m.breakpoints[profile].label}</b>
      </span>
      <span className="bs-statusbar__item">
        Selection <b>{selection}</b>
      </span>
      <span className="bs-statusbar__item">
        Sections <b>{m.sections.length}</b>
      </span>
      <span className="bs-statusbar__item">
        Nodes{' '}
        <b>
          {Object.keys(m.domNodes).length} DOM  * {Object.keys(m.sceneNodes).length} 3D
        </b>
      </span>
      <span className="bs-statusbar__item">
        Tracks <b>{m.tracks.length}</b>
      </span>
      <span className="bs-statusbar__item bs-statusbar__push">
        Progress <b ref={pctRef}>0%</b>
      </span>
      <span className="bs-statusbar__item">
        GPU <b>{quality}</b>
      </span>
      <span className="bs-statusbar__item">
        <span
          className="bs-statusbar__dot"
          data-save={saveState === 'Saved' ? 'saved' : saveState === 'Saving' ? 'saving' : saveState === 'Save failed' ? 'failed' : 'unsaved'}
        />
        {saveState}
      </span>
    </footer>
  );
}

