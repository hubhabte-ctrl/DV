import { useState } from 'react';
import { IconButton } from '../common/Button';
import { SaveStateChip } from '../common/Chip';
import { Icons } from '../../../../app/ui/Icons';
import { MenuButton, type MenuItem } from '../common/Menu';
import { SegmentedControl } from '../common/SegmentedControl';
import { toast } from '../../../../app/ui/Toast';
import {
  undo,
  redo,
  canUndo,
  canRedo,
  getManifest,
  setUIState,
  useUIState,
  toggleTheme,
  type EditorMode
} from '@bs/engine';
import { clearProject, persistNow } from '../../../../engine/storage';
import { exportProjectJson } from '../../../../engine/exportProject';
import { getCloudStatus } from '../../../../engine/cloudStatus';
import {
  AboutModal,
  KeyboardShortcutsModal,
  PreferencesModal,
  ProjectSettingsModal,
  RenameProjectModal,
} from '../modals/TopBarModals';
import { PublishModal } from '../modals/PublishModal';

const MODES: { value: EditorMode; label: string; icon?: React.ReactNode }[] = [
  { value: 'dom',     label: 'Canvas',  icon: Icons.code },
  { value: '3d',      label: '3D',      icon: Icons.cube },
  { value: 'preview', label: 'Preview', icon: Icons.play },
];

export function AnimateTopBar() {
  const mode = useUIState((s) => s.mode);
  const theme = useUIState((s) => s.theme);
  const saveState = useUIState((s) => s.saveState);
  const manifest = getManifest();
  const cloud = getCloudStatus();
  
  const [activeModal, setActiveModal] = useState<
    'shortcuts' | 'about' | 'prefs' | 'rename' | 'settings' | 'publish' | null
  >(null);

  const fileMenu: MenuItem[] = [
    {
      label: 'Save Now',
      shortcut: 'Ctrl+S',
      icon: Icons.check,
      onSelect: () => {
        void persistNow(() => getManifest()).then((ok) => {
          if (ok) toast('All modifications saved', 'ok', 'Project Saved');
          else    toast('Failed to write to storage', 'err', 'Save Error');
        });
      },
    },
    {
      label: 'Export Project JSON   ',
      shortcut: 'Ctrl+E',
      icon: Icons.publish,
      separator: true,
      onSelect: exportProjectJson,
    },
    {
      label: 'Rename Project   ',
      icon: Icons.rename,
      onSelect: () => setActiveModal('rename'),
    },
    {
      label: 'Project Settings   ',
      icon: Icons.settings,
      onSelect: () => setActiveModal('settings'),
    },
    {
      label: 'Reset Project   ',
      separator: true,
      onSelect: () => {
        void clearProject().then(() => {
          toast('Session reset', 'info', 'Resetting');
          setTimeout(() => window.location.reload(), 500);
        });
      },
    },
  ];

  const editMenu: MenuItem[] = [
    { label: 'Undo', shortcut: 'Ctrl+Z', icon: Icons.undo, disabled: !canUndo(), onSelect: undo },
    { label: 'Redo', shortcut: 'Ctrl+Shift+Z', icon: Icons.redo, disabled: !canRedo(), separator: true, onSelect: redo },
    { label: 'Preferences   ', icon: Icons.settings, onSelect: () => setActiveModal('prefs') },
  ];

  const isOnline = cloud.mode === 'postgresql';
  const cloudTitle = isOnline
    ? 'Live — PostgreSQL at localhost:5432'
    : 'Offline — Saving locally in IndexedDB';

  return (
    <>
      <header className="topbar" role="banner">
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
            <span className="studio-badge" data-studio="anim">
              Animation
            </span>
          </div>
          
          <button type="button" className="crumbs" title="Click to rename project" onClick={() => setActiveModal('rename')}>
            <b>{manifest.projectName || 'Untitled Project'}</b>
          </button>
          
          <span className="divider-v" />
          
          <nav className="tb-menus" aria-label="Application menus">
            <MenuButton label="File" items={fileMenu} />
            <MenuButton label="Edit" items={editMenu} />
          </nav>
          
          <span className="divider-v" />
          
          <div className="tb-history" role="group" aria-label="History">
            <IconButton tooltip="Undo (Ctrl+Z)" disabled={!canUndo()} onClick={undo}>{Icons.undo}</IconButton>
            <IconButton tooltip="Redo (Ctrl+Shift+Z)" disabled={!canRedo()} onClick={redo}>{Icons.redo}</IconButton>
          </div>
        </div>

        <div className="tb-center">
          <SegmentedControl
            aria-label="Editor mode"
            options={MODES}
            value={mode}
            onChange={(m2) => setUIState({ mode: m2 as EditorMode })}
            accent="brand"
          />
        </div>

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
          
          <IconButton tooltip={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`} onClick={toggleTheme} className="theme-toggle">
            {theme === 'dark' ? Icons.sun : Icons.moon}
          </IconButton>

          <IconButton tooltip="Keyboard Shortcuts (Ctrl+/)" onClick={() => setActiveModal('shortcuts')}>
            {Icons.help}
          </IconButton>
          
          <span className="divider-v" />
          
          <button className="tb-publish-btn" onClick={() => setActiveModal('publish')}>
            Publish
          </button>
        </div>
      </header>

      {activeModal === 'shortcuts' && <KeyboardShortcutsModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'about' && <AboutModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'prefs' && <PreferencesModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'rename' && <RenameProjectModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'settings' && <ProjectSettingsModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'publish' && <PublishModal onClose={() => setActiveModal(null)} />}
    </>
  );
}
