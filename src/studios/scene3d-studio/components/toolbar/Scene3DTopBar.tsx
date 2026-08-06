/**
 * Scene3DTopBar   " 3D Studio Top Bar (Doc 05   2)
 *
 * Layout (3-zone):
 *   LEFT    "  Brand  * Studio badge  * Project  *  "   * [File Edit View Insert]  *  "   * Undo/Redo
 *   CENTER   "  Mode switcher
 *   RIGHT    "  Save indicator  * Cloud dot  *  "   * Theme  * Shortcuts  * Settings  *  "   * Avatars  * Publish
 *
 * Menus:
 *   File     " New / Open / Save / Export / Settings
 *   Edit     " Undo  * Redo  * Duplicate  * Delete  * Group  * Ungroup  * Find Commands
 *   View     " Camera views  * Frame selected  * Orthographic  * Grid  * Stats
 *   Insert   " Geometry  * Lights  * Camera  * Empty Group
 */
import { useEffect, useRef, useState } from 'react';
import { IconButton } from '../common/Button';
import { SaveStateChip } from '../common/Chip';
import { Icons } from '../../../../app/ui/Icons';
import { MenuButton, type MenuItem } from '../common/Menu';
import { SegmentedControl } from '../common/SegmentedControl';
import { applyTokens } from '../../../../app/ui/tokens/applyTokens';
import { toast } from '../../../../app/ui/Toast';
import {
  canRedo,
  canUndo,
  duplicateSceneNode,
  getManifest,
  groupSceneNode,
  hydrateManifest,
  redo,
  removeSceneNode,
  subscribeManifest,
  undo,
  ungroupSceneNode,
} from '@bs/engine';
import { getCloudStatus, subscribeCloudStatus } from '../../../../engine/cloudStatus';
import { clearProject, persistNow } from '../../../../engine/storage';
import { exportProjectJson } from '../../../../engine/exportProject';
import {
  getUIState,
  setCanvasZoom,
  setUIState,
  toggleTheme,
  useUIState,
  type EditorMode,
} from '@bs/engine';
import { importStarterTemplate } from '../../../../templates/starterTemplates';
import { importAssetFiles } from '../panels/Scene3DAssetPanel';
import { PublishModal } from '../modals/PublishModal';
import {
  AboutModal,
  KeyboardShortcutsModal,
  PreferencesModal,
  ProjectSettingsModal,
  RenameProjectModal,
} from '../modals/TopBarModals';
import { getViewport } from '../../../../viewport/handleRegistry';

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

function insertScene3DElement(type: string) {
  window.dispatchEvent(new CustomEvent('bs:scene3d:insert', { detail: { type } }));
}

export function Scene3DTopBar() {
  const mode      = useUIState((s) => s.mode);
  const theme     = useUIState((s) => s.theme);
  const saveState = useUIState((s) => s.saveState);
  const zoom      = useUIState((s) => s.canvasZoom);

  const [activeModal, setActiveModal] = useState<
    'publish' | 'shortcuts' | 'settings' | 'preferences' | 'rename' | 'about' | null
  >(null);

  const jsonFileInputRef  = useRef<HTMLInputElement>(null);
  const assetFileInputRef = useRef<HTMLInputElement>(null);
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

  /*  "  "  FILE  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */
  const fileItems: MenuItem[] = [
    {
      label: 'New Project',
      shortcut: 'Ctrl+Alt+N',
      icon: Icons.plus,
      onSelect: () => { const r = importStarterTemplate('blank-canvas'); toast(r.message, 'ok', 'New Project'); },
    },
    {
      label: 'Import 3D Template',
      icon: Icons.cube,
      onSelect: () => { const r = importStarterTemplate('3d-product-showcase'); toast(r.message, 'ok', 'Template Imported'); },
    },
    {
      label: 'Open Project JSON   ',
      shortcut: 'Ctrl+O',
      icon: Icons.folder,
      separator: true,
      onSelect: () => jsonFileInputRef.current?.click(),
    },
    {
      label: 'Import GLB / Assets   ',
      shortcut: 'Ctrl+I',
      icon: Icons.folder,
      onSelect: () => assetFileInputRef.current?.click(),
    },
    {
      label: 'Save Now',
      shortcut: 'Ctrl+S',
      icon: Icons.check,
      separator: true,
      onSelect: () => {
        void persistNow(() => getManifest()).then((ok) => {
          if (ok) toast('Project saved', 'ok', 'Saved');
          else     toast('Failed to save', 'err', 'Save Error');
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

  /*  "  "  EDIT  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */
  const editItems: MenuItem[] = [
    { label: 'Undo', shortcut: 'Ctrl+Z',       icon: Icons.undo, disabled: !canUndo(), onSelect: undo },
    { label: 'Redo', shortcut: 'Ctrl+Shift+Z', icon: Icons.redo, disabled: !canRedo(), onSelect: redo },
    {
      label: 'Duplicate Selection',
      shortcut: 'Ctrl+D',
      separator: true,
      icon: Icons.duplicate,
      onSelect: () => {
        const ui = getUIState();
        if (ui.selectedSceneNodeId) {
          const id = duplicateSceneNode(ui.selectedSceneNodeId);
          if (id) { setUIState({ selectedSceneNodeId: id }); toast('Node duplicated', 'ok', 'Duplicate'); }
        } else { toast('Select a scene node to duplicate', 'info', 'No Selection'); }
      },
    },
    {
      label: 'Delete Selection',
      shortcut: 'Del',
      icon: Icons.trash,
      onSelect: () => {
        const ui = getUIState();
        if (ui.selectedSceneNodeId) {
          if (!removeSceneNode(ui.selectedSceneNodeId)) toast('The active camera cannot be deleted', 'err', 'Protected');
          else setUIState({ selectedSceneNodeId: null });
        } else { toast('Select a scene node to delete', 'info', 'No Selection'); }
      },
    },
    {
      label: 'Group Selection',
      shortcut: 'Ctrl+G',
      separator: true,
      onSelect: () => {
        const ui = getUIState();
        if (ui.selectedSceneNodeId) {
          const id = groupSceneNode(ui.selectedSceneNodeId);
          if (id) { setUIState({ selectedSceneNodeId: id }); toast('Grouped', 'ok', 'Group'); }
        } else { toast('Select a node to group', 'info', 'No Selection'); }
      },
    },
    {
      label: 'Ungroup Selection',
      shortcut: 'Ctrl+Shift+G',
      onSelect: () => {
        const ui = getUIState();
        if (ui.selectedSceneNodeId) {
          if (ungroupSceneNode(ui.selectedSceneNodeId)) { setUIState({ selectedSceneNodeId: null }); toast('Ungrouped', 'ok', 'Ungroup'); }
          else { toast('Select a group to ungroup', 'info', 'Not a Group'); }
        } else { toast('Select a group to ungroup', 'info', 'No Selection'); }
      },
    },
    {
      label: 'Find Commands   ',
      shortcut: 'Ctrl+K',
      separator: true,
      onSelect: () => setUIState({ paletteOpen: true }),
    },
  ];

  /*  "  "  VIEW  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */
  const viewItems: MenuItem[] = [
    {
      label: 'Frame Selected',
      shortcut: 'F',
      icon: Icons.maximize,
      onSelect: () => getViewport()?.frameSelected(),
    },
    {
      label: 'Zoom In',
      shortcut: 'Ctrl++',
      icon: Icons.plus,
      separator: true,
      onSelect: () => setCanvasZoom(zoom * 1.25),
    },
    { label: 'Zoom Out',          shortcut: 'Ctrl+-', icon: Icons.minus, onSelect: () => setCanvasZoom(zoom / 1.25) },
    { label: 'Reset Zoom (100%)', shortcut: 'Ctrl+0',                    onSelect: () => setCanvasZoom(1) },
    {
      label: 'Full Screen',
      shortcut: 'F11',
      separator: true,
      onSelect: () => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      },
    },
    {
      label: 'Reset Workspace Layout',
      onSelect: () => {
        setUIState({ leftRailW: 340, inspectorW: 340, timelineH: 160, leftRailCollapsed: false, inspectorCollapsed: false, timelineCollapsed: false, canvasZoom: 1 });
        toast('Workspace reset', 'ok', 'Reset Layout');
      },
    },
  ];

  /*  "  "  INSERT  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */
  const insertItems: MenuItem[] = [
    { label: 'Mesh   " Box',      icon: Icons.cube,   onSelect: () => insertScene3DElement('box')      },
    { label: 'Mesh   " Sphere',   icon: Icons.sphere, onSelect: () => insertScene3DElement('sphere')   },
    { label: 'Mesh   " Cylinder',                     onSelect: () => insertScene3DElement('cylinder') },
    { label: 'Mesh   " Plane',                        onSelect: () => insertScene3DElement('plane')    },
    { label: 'Point Light',     icon: Icons.light,  separator: true, onSelect: () => insertScene3DElement('point-light')  },
    { label: 'Directional Light',                   onSelect: () => insertScene3DElement('dir-light')  },
    { label: 'Spot Light',                          onSelect: () => insertScene3DElement('spot-light') },
    { label: 'Ambient Light',                       onSelect: () => insertScene3DElement('ambient')    },
    { label: 'Camera',          icon: Icons.camera, separator: true, onSelect: () => insertScene3DElement('camera')      },
    { label: 'Empty Group',     icon: Icons.group,  onSelect: () => insertScene3DElement('group')       },
  ];

  return (
    <header className="topbar" role="banner">
      {/* Hidden file inputs */}
      <input type="file" ref={jsonFileInputRef} accept=".json" className="u-hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            try { hydrateManifest(JSON.parse(evt.target?.result as string)); toast(`${file.name} imported`, 'ok', 'Project Loaded'); }
            catch { toast('Invalid JSON file', 'err', 'Import Error'); }
          };
          reader.readAsText(file);
          e.target.value = '';
        }}
      />
      <input type="file" ref={assetFileInputRef} multiple className="u-hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) importAssetFiles(files);
          e.target.value = '';
        }}
      />

      {/*  "  "  LEFT: Brand  * Studio  * Project  * Menus  * Undo/Redo  "  "  */}
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

        <span className="divider-v" />

        <nav className="tb-menus" aria-label="Application menus">
          <MenuButton label="File"   items={fileItems}   />
          <MenuButton label="Edit"   items={editItems}   />
          <MenuButton label="View"   items={viewItems}   />
          <MenuButton label="Insert" items={insertItems} />
        </nav>

        <span className="divider-v" />

        <div className="tb-history" role="group" aria-label="History">
          <IconButton tooltip="Undo (Ctrl+Z)"       disabled={!canUndo()} onClick={undo}>{Icons.undo}</IconButton>
          <IconButton tooltip="Redo (Ctrl+Shift+Z)" disabled={!canRedo()} onClick={redo}>{Icons.redo}</IconButton>
        </div>
      </div>

      {/*  "  "  CENTER: Mode switcher  "  "  */}
      <div className="tb-center">
        <SegmentedControl
          aria-label="Editor mode"
          options={MODES}
          value={mode}
          onChange={(m2: any) => setUIState({ mode: m2 })}
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
