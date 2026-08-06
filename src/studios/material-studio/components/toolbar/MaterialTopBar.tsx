/**
 * MaterialTopBar   " MaterialTopBar (Doc 05   2)
 *
 * Layout (3-zone):
 *   LEFT    "  Brand  * Studio badge  * Project name
 *   CENTER   "  Mode switcher (Spatial Canvas / Apex 3D / Preview)
 *   RIGHT    "  Save indicator  * Cloud dot  * Theme  * Shortcuts  * Settings  * Avatars  * Publish
 *
 * NOTE: Preview mode is read-only for layout. No Edit menus, no insert commands, no undo/redo.
 */
import { useEffect, useState } from 'react';
import { IconButton } from '../common/Button';
import { SaveStateChip } from '../common/Chip';
import { Icons } from '../../../../app/ui/Icons';
import { SegmentedControl } from '../common/SegmentedControl';
import { applyTokens } from '../../../../app/ui/tokens/applyTokens';
import { toast } from '../../../../app/ui/Toast';
import { getManifest, subscribeManifest } from '@bs/engine';
import { getCloudStatus, subscribeCloudStatus } from '../../../../engine/cloudStatus';
import { getUIState, setUIState, toggleTheme, useUIState, type EditorMode } from '@bs/engine';
import { PublishModal } from '../modals/PublishModal';
import {
  AboutModal,
  KeyboardShortcutsModal,
  PreferencesModal,
  ProjectSettingsModal,
  RenameProjectModal,
} from '../modals/TopBarModals';

const MODES: { value: EditorMode; label: string; icon?: React.ReactNode }[] = [
  { value: 'dom',     label: 'Canvas',  icon: Icons.code },
  { value: '3d',      label: '3D',      icon: Icons.cube },
  { value: 'preview', label: 'Preview', icon: Icons.play },
];

const MODE_TO_STUDIO: Record<EditorMode, { label: string; data: string }> = {
  dom:      { label: 'DOM',       data: 'dom'      },
  '3d':     { label: '3D',        data: '3d'       },
  animate:  { label: 'Animation', data: 'anim'     },
  material: { label: 'Material',  data: 'material' },
  assets:   { label: 'Asset',     data: 'asset'    },
  preview:  { label: 'Preview',   data: 'preview'  },
};

export function MaterialTopBar() {
  const mode      = useUIState((s) => s.mode);
  const theme     = useUIState((s) => s.theme);
  const saveState = useUIState((s) => s.saveState);

  const [activeModal, setActiveModal] = useState<
    'publish' | 'shortcuts' | 'settings' | 'preferences' | 'rename' | 'about' | null
  >(null);

  const [, force] = useState(0);

  useEffect(() => subscribeManifest(() => force((n) => n + 1)), []);
  useEffect(() => subscribeCloudStatus(() => force((n) => n + 1)), []);
  useEffect(() => { applyTokens(theme); }, [theme]);

  const cloud    = getCloudStatus();
  const manifest = getManifest();
  const isOnline = cloud.mode === 'postgresql';
  const cloudTitle = isOnline
    ? 'Live — PostgreSQL at localhost:5432'
    : 'Offline — Saving locally in IndexedDB';

  return (
    <header className="topbar" role="banner">
      {/*  "  "  LEFT: Brand  * Studio  * Project  "  "  */}
      <div className="tb-left">
        <button type="button" className="brand-mark" title="About Forge & Canvas" aria-label="About" onClick={() => setActiveModal('about')}>
          {Icons.layers}
        </button>
        <div className="brand-title">
          <span className="brand-name">
            <span className="bn-main">Forge</span>
            <span className="bn-amp">&amp;</span>
            <span className="bn-sub">Canvas</span>
          </span>
          <span className="brand-sep">/</span>
          <span className="studio-badge" data-studio={MODE_TO_STUDIO[mode].data}>
            {MODE_TO_STUDIO[mode].label}
          </span>
        </div>
        <button type="button" className="crumbs" title="Click to rename project"
          aria-label={`Project: ${manifest.projectName}`}
          onClick={() => setActiveModal('rename')}>
          <b>{manifest.projectName}</b>
        </button>
      </div>

      {/*  "  "  CENTER: Mode switcher  "  "  */}
      <div className="tb-center">
        <SegmentedControl
          aria-label="Editor mode"
          options={MODES}
          value={mode}
          onChange={(m2: EditorMode) => setUIState({ mode: m2 })}
          accent="brand"
        />
      </div>

      {/*  "  "  RIGHT: Status  * Theme  * Settings  * Avatars  * Publish  "  "  */}
      <div className="tb-right">
        <div className="tb-status-cluster" aria-label="Save status">
          <SaveStateChip state={saveState} />
          <span
            className={`tb-cloud-dot ${isOnline ? 'tb-cloud-dot--on' : 'tb-cloud-dot--off'}`}
            title={cloudTitle}
            aria-label={cloudTitle}
            onClick={() => toast(cloudTitle, isOnline ? 'ok' : 'info', 'Cloud Status')}
          />
        </div>

        <span className="divider-v" />

        <IconButton tooltip={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={toggleTheme}>
          {theme === 'dark' ? Icons.sun : Icons.moon}
        </IconButton>
        <IconButton tooltip="Keyboard shortcuts (?)" onClick={() => setActiveModal('shortcuts')}>
          {Icons.help}
        </IconButton>
        <IconButton tooltip="Designer preferences" onClick={() => setActiveModal('preferences')}>
          {Icons.settings}
        </IconButton>

        <span className="divider-v" />

        <div className="bs-avatars" aria-label="Active collaborators">
          <span className="bs-ava bs-ava--a" title="MK">MK</span>
          <span className="bs-ava bs-ava--b" title="DV">DV</span>
        </div>
        <button type="button" className="pub-btn" onClick={() => setActiveModal('publish')}>
          Publish
        </button>
      </div>

      {/* Modals */}
      {activeModal === 'publish'     && <PublishModal           onClose={() => setActiveModal(null)} />}
      {activeModal === 'shortcuts'   && <KeyboardShortcutsModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'settings'    && <ProjectSettingsModal   onClose={() => setActiveModal(null)} />}
      {activeModal === 'preferences' && <PreferencesModal       onClose={() => setActiveModal(null)} />}
      {activeModal === 'rename'      && <RenameProjectModal     onClose={() => setActiveModal(null)} />}
      {activeModal === 'about'       && <AboutModal             onClose={() => setActiveModal(null)} />}
    </header>
  );
}
