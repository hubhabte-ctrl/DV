/**
 * DOMTopBar   " Enterprise SaaS Top Bar (Doc 05   2)
 *
 * Layout (3-zone):
 *   LEFT   "  Brand  * Studio badge  * Project name  * [File Edit View Insert Arrange]  *  "   * Undo/Redo
 *   CENTER  "  Mode switcher (Spatial Canvas / Apex 3D / Preview)
 *   RIGHT   "  Save indicator  * Cloud status  * Theme  * [Shortcuts]  * Avatars  * Publish
 *
 * Removed from old bar:
 *   - Separate "Tools" menu (merged into View & Arrange)
 *   - Redundant "Help" menu (collapsed into a single icon button   ' shortcuts modal)
 *   - "Reset View" button (moved to View menu Ctrl+0)
 *   - "Save Layout" button (moved into File menu)
 *   - "Advanced" button (moved to     settings icon)
 *   - "webgl" chip (noise)
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
  addDomNode,
  addMarker,
  addWaypoint,
  canRedo,
  canUndo,
  dispatch,
  duplicateDomNode,
  duplicateSceneNode,
  getManifest,
  hydrateManifest,
  newNodeId,
  redo,
  removeDomNode,
  removeSceneNode,
  subscribeManifest,
  undo,
  type DomNode,
} from '@bs/engine';
import { getCloudStatus, subscribeCloudStatus } from '../../../../engine/cloudStatus';
import { clearProject, persistNow, schedulePersist } from '../../../../engine/storage';
import { getProgress } from '../../../../engine/progress';
import { exportProjectJson } from '../../../../engine/exportProject';
import {
  getUIState,
  setCanvasZoom,
  setUIState,
  toggleGrid,
  toggleGuides,
  toggleRulers,
  toggleSnapToElements,
  toggleSnapToGrid,
  toggleTheme,
  useUIState,
  type EditorMode,
} from '@bs/engine';
import { importStarterTemplate } from '../../../../templates/starterTemplates';
import { importAssetFiles } from '../panels/DOMAssetPanel';
import { PublishModal } from '../modals/PublishModal';
import {
  AboutModal,
  KeyboardShortcutsModal,
  PreferencesModal,
  ProjectSettingsModal,
  RenameProjectModal,
} from '../modals/TopBarModals';

/** Studio mode switcher options   " only user-facing studios */
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

function insertElement(cmpId: string): void {
  window.dispatchEvent(new CustomEvent('bs:dom:insert', { detail: { cmpId } }));
}

function duplicateDomNodeSafe(nodeId: string): string | null {
  const id = duplicateDomNode(nodeId);
  if (!id) toast('Duplicate sections from the Sections list', 'info', 'Section Duplicate');
  return id;
}

export function DOMTopBar() {
  const mode         = useUIState((s) => s.mode);
  const theme        = useUIState((s) => s.theme);
  const saveState    = useUIState((s) => s.saveState);
  const zoom         = useUIState((s) => s.canvasZoom);
  const showGrid     = useUIState((s) => s.showGrid);
  const showRulers   = useUIState((s) => s.showRulers);
  const showGuides   = useUIState((s) => s.showGuides);
  const snapToGrid   = useUIState((s) => s.snapToGrid);
  const snapToEl     = useUIState((s) => s.snapToElements);

  const [activeModal, setActiveModal] = useState<
    'publish' | 'shortcuts' | 'settings' | 'preferences' | 'rename' | 'about' | null
  >(null);
  const [clipboardNode, setClipboardNode] = useState<DomNode | null>(null);

  const jsonFileInputRef  = useRef<HTMLInputElement>(null);
  const assetFileInputRef = useRef<HTMLInputElement>(null);

  const [, force] = useState(0);
  useEffect(() => subscribeManifest(() => force((n) => n + 1)), []);
  useEffect(() => subscribeCloudStatus(() => force((n) => n + 1)), []);
  useEffect(() => { applyTokens(theme); }, [theme]);

  const cloud    = getCloudStatus();
  const manifest = getManifest();

  /*  "  "  FILE  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */
  const fileItems: MenuItem[] = [
    {
      label: 'New Project',
      shortcut: 'Ctrl+Alt+N',
      icon: Icons.plus,
      onSelect: () => { const r = importStarterTemplate('blank-canvas'); toast(r.message, 'ok', 'New Project'); },
    },
    {
      label: 'New Section',
      shortcut: 'Ctrl+N',
      icon: Icons.section,
      onSelect: () => insertElement('cmp-section'),
    },
    {
      label: 'Open Project JSON   ',
      shortcut: 'Ctrl+O',
      icon: Icons.folder,
      separator: true,
      onSelect: () => jsonFileInputRef.current?.click(),
    },
    {
      label: 'Import 3D Template',
      icon: Icons.cube,
      onSelect: () => { const r = importStarterTemplate('3d-product-showcase'); toast(r.message, 'ok', 'Template Imported'); },
    },
    {
      label: 'Import Assets / GLB   ',
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
          if (ok) toast('All modifications saved', 'ok', 'Project Saved');
          else     toast('Failed to write to storage', 'err', 'Save Error');
        });
      },
    },
    {
      label: 'Save Snapshot   ',
      shortcut: 'Ctrl+Shift+S',
      icon: Icons.duplicate,
      onSelect: exportProjectJson,
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
      label: 'Cut',
      shortcut: 'Ctrl+X',
      separator: true,
      onSelect: () => {
        const ui = getUIState();
        if (ui.selectedDomNodeId && manifest.domNodes[ui.selectedDomNodeId]) {
          setClipboardNode(structuredClone(manifest.domNodes[ui.selectedDomNodeId]));
          removeDomNode(ui.selectedDomNodeId);
          toast('Node cut to clipboard', 'ok', 'Cut');
        } else { toast('Select a DOM node to cut', 'info', 'No Selection'); }
      },
    },
    {
      label: 'Copy',
      shortcut: 'Ctrl+C',
      icon: Icons.duplicate,
      onSelect: () => {
        const ui = getUIState();
        if (ui.selectedDomNodeId && manifest.domNodes[ui.selectedDomNodeId]) {
          setClipboardNode(structuredClone(manifest.domNodes[ui.selectedDomNodeId]));
          toast('Node copied', 'ok', 'Copied');
        } else { toast('Select a DOM node to copy', 'info', 'No Selection'); }
      },
    },
    {
      label: 'Paste',
      shortcut: 'Ctrl+V',
      disabled: !clipboardNode,
      onSelect: () => {
        if (!clipboardNode) return;
        const p   = getProgress();
        const sec = manifest.sections.find((s) => p >= s.range[0] && p <= s.range[1]) ?? manifest.sections[0];
        if (!sec) return;
        const clone   = structuredClone(clipboardNode);
        clone.id      = newNodeId(clone.type);
        clone.label   = `${clone.label} (Copy)`;
        addDomNode(sec.rootDomNodeId, clone, manifest.domNodes[sec.rootDomNodeId].children.length);
        setUIState({ selectedDomNodeId: clone.id });
        toast(`${clone.label} pasted`, 'ok', 'Pasted');
      },
    },
    {
      label: 'Duplicate',
      shortcut: 'Ctrl+D',
      separator: true,
      onSelect: () => {
        const ui = getUIState();
        if (ui.mode === 'dom' && ui.selectedDomNodeId) {
          const id = duplicateDomNodeSafe(ui.selectedDomNodeId);
          if (id) setUIState({ selectedDomNodeId: id });
        } else if (ui.mode === '3d' && ui.selectedSceneNodeId) {
          const id = duplicateSceneNode(ui.selectedSceneNodeId);
          if (id) setUIState({ selectedSceneNodeId: id });
        } else { toast('Select an element to duplicate', 'info', 'No Selection'); }
      },
    },
    {
      label: 'Delete Selection',
      shortcut: 'Del',
      icon: Icons.trash,
      onSelect: () => {
        const ui = getUIState();
        if (ui.mode === 'dom' && ui.selectedDomNodeId) {
          if (!removeDomNode(ui.selectedDomNodeId))
            toast('Sections are protected — delete from the layers list', 'info', 'Protected');
        } else if (ui.mode === '3d' && ui.selectedSceneNodeId) {
          if (!removeSceneNode(ui.selectedSceneNodeId))
            toast('The active camera cannot be deleted', 'err', 'Protected Node');
        } else { toast('Select an element to delete', 'info', 'No Selection'); }
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
    { label: 'Zoom In',          shortcut: 'Ctrl++',  icon: Icons.plus,     onSelect: () => setCanvasZoom(zoom * 1.25) },
    { label: 'Zoom Out',         shortcut: 'Ctrl+-',  icon: Icons.minus,    onSelect: () => setCanvasZoom(zoom / 1.25) },
    { label: 'Reset Zoom (100%)',shortcut: 'Ctrl+0',                         onSelect: () => { setCanvasZoom(1); toast('Zoom reset to 100%', 'ok', 'Reset View'); } },
    { label: 'Fit to Screen',    shortcut: 'Shift+1', icon: Icons.maximize, onSelect: () => setCanvasZoom(0.85) },
    {
      label: `Show Grid ${showGrid ? '  "' : ''}`,
      shortcut: "Ctrl+'",
      icon: Icons.grid,
      separator: true,
      onSelect: toggleGrid,
    },
    { label: `Show Rulers ${showRulers ? '  "' : ''}`, shortcut: 'Ctrl+R', icon: Icons.layoutGrid, onSelect: toggleRulers },
    { label: `Show Guides ${showGuides ? '  "' : ''}`,                                              onSelect: toggleGuides },
    { label: `Snap to Grid ${snapToGrid ? '  "' : ''}`,   separator: true, onSelect: toggleSnapToGrid },
    { label: `Snap to Elements ${snapToEl ? '  "' : ''}`,                   onSelect: toggleSnapToElements },
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
        toast('Workspace reset to defaults', 'ok', 'Reset Layout');
      },
    },
  ];

  /*  "  "  INSERT  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */
  const insertItems: MenuItem[] = [
    { label: 'Section',           icon: Icons.section,   onSelect: () => insertElement('cmp-section') },
    { label: 'Container',         icon: Icons.container, onSelect: () => insertElement('cmp-container') },
    { label: 'Flex Layout',       icon: Icons.flex,      onSelect: () => insertElement('cmp-flex') },
    { label: 'Grid Layout',       icon: Icons.grid,      onSelect: () => insertElement('cmp-grid') },
    { label: 'Heading',           icon: Icons.heading,   separator: true, onSelect: () => insertElement('cmp-heading') },
    { label: 'Paragraph',         icon: Icons.text,      onSelect: () => insertElement('cmp-text') },
    { label: 'Link',              icon: Icons.link,      onSelect: () => insertElement('cmp-link') },
    { label: 'Button',            icon: Icons.buttonEl,  separator: true, onSelect: () => insertElement('cmp-button') },
    { label: 'Image',             icon: Icons.image,     onSelect: () => insertElement('cmp-image') },
    { label: 'Video',             icon: Icons.video,     onSelect: () => insertElement('cmp-video') },
    { label: '3D Render Stage',   icon: Icons.cube,      separator: true, onSelect: () => insertElement('cmp-scene3d') },
    {
      label: 'Camera Waypoint',
      icon: Icons.anchor,
      onSelect: () => {
        const wp = addWaypoint(getProgress());
        if (wp) {
          setUIState({ mode: 'dom', selectedWaypointId: wp.id, selectedDomNodeId: null });
          toast(`Waypoint bound to '${wp.anchorId}'`, 'ok', 'Waypoint Active');
        } else { toast('No 3D anchors found', 'err', 'Anchor Error'); }
      },
    },
    {
      label: 'Timeline Marker',
      icon: Icons.play,
      onSelect: () => {
        const mk = addMarker(getProgress());
        toast(`${mk.label} at ${(mk.t * 100).toFixed(0)}%`, 'ok', 'Marker Set');
      },
    },
  ];

  /*  "  "  ARRANGE  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */
  const arrangeItems: MenuItem[] = [
    { label: 'Align Left',                icon: Icons.alignLeft,    onSelect: () => window.dispatchEvent(new CustomEvent('bs:dom:align', { detail: { op: 'left',    profile: 'desktop' } })) },
    { label: 'Align Center',              icon: Icons.alignCenterH, onSelect: () => window.dispatchEvent(new CustomEvent('bs:dom:align', { detail: { op: 'centerH', profile: 'desktop' } })) },
    { label: 'Align Right',               icon: Icons.alignRight,   onSelect: () => window.dispatchEvent(new CustomEvent('bs:dom:align', { detail: { op: 'right',   profile: 'desktop' } })) },
    { label: 'Align Top',                 icon: Icons.alignTop,     separator: true, onSelect: () => window.dispatchEvent(new CustomEvent('bs:dom:align', { detail: { op: 'top',     profile: 'desktop' } })) },
    { label: 'Align Middle',              icon: Icons.alignCenterV, onSelect: () => window.dispatchEvent(new CustomEvent('bs:dom:align', { detail: { op: 'centerV', profile: 'desktop' } })) },
    { label: 'Align Bottom',              icon: Icons.alignBottom,  onSelect: () => window.dispatchEvent(new CustomEvent('bs:dom:align', { detail: { op: 'bottom',  profile: 'desktop' } })) },
    { label: 'Distribute Horizontally',   icon: Icons.distributeH,  separator: true, onSelect: () => window.dispatchEvent(new CustomEvent('bs:dom:align', { detail: { op: 'distH',   profile: 'desktop' } })) },
    { label: 'Distribute Vertically',     icon: Icons.distributeV,  onSelect: () => window.dispatchEvent(new CustomEvent('bs:dom:align', { detail: { op: 'distV',   profile: 'desktop' } })) },
    {
      label: 'Group in Container',
      shortcut: 'Ctrl+G',
      separator: true,
      onSelect: () => {
        const ui = getUIState();
        if (ui.selectedDomNodeId && manifest.domNodes[ui.selectedDomNodeId]) {
          const target = manifest.domNodes[ui.selectedDomNodeId];
          const parent = Object.values(manifest.domNodes).find((p) => p.children?.includes(target.id));
          if (parent) {
            const container: DomNode = { id: newNodeId('container'), type: 'container', tag: 'div', label: 'Container · Group', children: [target.id], style: { padding: 16, gap: 12 }, overrides: {} };
            const idx = parent.children.indexOf(target.id);
            parent.children[idx] = container.id;
            manifest.domNodes[container.id] = container;
            setUIState({ selectedDomNodeId: container.id });
            toast('Grouped in Container', 'ok', 'Grouped');
          }
        } else { toast('Select a node to group', 'info', 'No Selection'); }
      },
    },
    {
      label: 'Lock / Unlock Selection',
      shortcut: 'Ctrl+L',
      onSelect: () => {
        const ui = getUIState();
        if (ui.selectedDomNodeId && manifest.domNodes[ui.selectedDomNodeId]) {
          const n = manifest.domNodes[ui.selectedDomNodeId];
          dispatch({ type: 'set', path: `domNodes.${n.id}.locked`, value: !n.locked });
          toast(`${n.label} ${!n.locked ? 'locked' : 'unlocked'}`, 'ok', 'Lock');
        } else { toast('Select a node to lock/unlock', 'info', 'No Selection'); }
      },
    },
  ];

  /*  "  "  Cloud status label  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */
  const isOnline   = cloud.mode === 'postgresql';
  const cloudTitle = isOnline
    ? 'Live — PostgreSQL at localhost:5432'
    : 'Offline — Saving locally in IndexedDB';

  return (
    <header className="topbar" role="banner">
      {/* Hidden file inputs */}
      <input type="file" ref={jsonFileInputRef}  accept=".json" className="u-hidden"
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
        {/* Brand mark */}
        <button type="button" className="brand-mark" title="About Forge & Canvas" aria-label="About" onClick={() => setActiveModal('about')}>
          {Icons.layers}
        </button>

        {/* Wordmark + studio badge */}
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

        {/* Project name breadcrumb */}
        <button type="button" className="crumbs" title="Click to rename project"
          aria-label={`Project: ${manifest.projectName}`}
          onClick={() => setActiveModal('rename')}>
          <b>{manifest.projectName}</b>
        </button>

        {/*  "  "  Divider  "  "  */}
        <span className="divider-v" />

        {/* Menus   " File  * Edit  * View  * Insert  * Arrange */}
        <nav className="tb-menus" aria-label="Application menus">
          <MenuButton label="File"    items={fileItems}    />
          <MenuButton label="Edit"    items={editItems}    />
          <MenuButton label="View"    items={viewItems}    />
          <MenuButton label="Insert"  items={insertItems}  />
          <MenuButton label="Arrange" items={arrangeItems} />
        </nav>

        {/*  "  "  Divider  "  "  */}
        <span className="divider-v" />

        {/* Undo / Redo */}
        <div className="tb-history" role="group" aria-label="History">
          <IconButton tooltip="Undo (Ctrl+Z)"       disabled={!canUndo()} onClick={undo}>{Icons.undo}</IconButton>
          <IconButton tooltip="Redo (Ctrl+Shift+Z)" disabled={!canRedo()} onClick={redo}>{Icons.redo}</IconButton>
        </div>
      </div>

      {/*  "  "  CENTER: Studio mode switcher  "  "  */}
      <div className="tb-center">
        <SegmentedControl
          aria-label="Editor mode"
          options={MODES}
          value={mode}
          onChange={(m2) => setUIState({ mode: m2 })}
          accent="brand"
        />
      </div>

      {/*  "  "  RIGHT: Status  * Theme  * Settings  * Avatars  * Publish  "  "  */}
      <div className="tb-right">
        {/* Save status */}
        <div className="tb-status-cluster" aria-label="Save status">
          <SaveStateChip state={saveState} />
          <span
            className={`tb-cloud-dot ${isOnline ? 'tb-cloud-dot--on' : 'tb-cloud-dot--off'}`}
            title={cloudTitle}
            aria-label={cloudTitle}
            onClick={() => toast(cloudTitle, isOnline ? 'ok' : 'info', 'Cloud Status')}
          />
        </div>

        {/* Divider */}
        <span className="divider-v" />

        {/* Theme toggle */}
        <IconButton tooltip={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={toggleTheme}>
          {theme === 'dark' ? Icons.sun : Icons.moon}
        </IconButton>

        {/* Keyboard shortcuts */}
        <IconButton tooltip="Keyboard shortcuts (?)" onClick={() => setActiveModal('shortcuts')}>
          {Icons.help}
        </IconButton>

        {/* Settings / Preferences */}
        <IconButton tooltip="Designer preferences" onClick={() => setActiveModal('preferences')}>
          {Icons.settings}
        </IconButton>

        {/* Divider */}
        <span className="divider-v" />

        {/* Avatar stack */}
        <div className="bs-avatars" aria-label="Active collaborators">
          <span className="bs-ava bs-ava--a" title="MK">MK</span>
          <span className="bs-ava bs-ava--b" title="DV">DV</span>
        </div>

        {/* Primary CTA */}
        <button type="button" className="pub-btn" onClick={() => setActiveModal('publish')}>
          Publish
        </button>
      </div>

      {/* Modals */}
      {activeModal === 'publish'   && <PublishModal            onClose={() => setActiveModal(null)} />}
      {activeModal === 'shortcuts' && <KeyboardShortcutsModal  onClose={() => setActiveModal(null)} />}
      {activeModal === 'settings'  && <ProjectSettingsModal    onClose={() => setActiveModal(null)} />}
      {activeModal === 'preferences' && <PreferencesModal      onClose={() => setActiveModal(null)} />}
      {activeModal === 'rename'    && <RenameProjectModal      onClose={() => setActiveModal(null)} />}
      {activeModal === 'about'     && <AboutModal              onClose={() => setActiveModal(null)} />}
    </header>
  );
}
