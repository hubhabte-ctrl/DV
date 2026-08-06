/**
 * TopBar Modals (Doc 05   2   " Menu System Contracts):
 * Professional dialogs for Keyboard Shortcuts, Project Settings, Designer Preferences,
 * Project Rename, and About Build Studio.
 */
import { useState } from 'react';
import { Icons } from '../../../../app/ui/Icons';
import { toast } from '../../../../app/ui/Toast';
import { dispatch, getManifest } from '@bs/engine';
import { getCloudStatus } from '../../../../engine/cloudStatus';
import {
  toggleGrid,
  toggleGuides,
  toggleRulers,
  toggleSnapToElements,
  toggleSnapToGrid,
  toggleTheme,
  useUIState,
} from '@bs/engine';

/** 1. Keyboard Shortcuts Reference Dialog (Doc 05   2) */
export function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  const categories = [
    {
      title: 'General & Editing',
      shortcuts: [
        { key: 'Ctrl + Z', desc: 'Undo last action' },
        { key: 'Ctrl + Shift + Z', desc: 'Redo last action' },
        { key: 'Ctrl + S', desc: 'Save project to IndexedDB' },
        { key: 'Ctrl + K', desc: 'Open Command Palette' },
        { key: 'Ctrl + D', desc: 'Duplicate selected node' },
        { key: 'Del / Backspace', desc: 'Delete selected node' },
        { key: 'Ctrl + A', desc: 'Select all nodes' },
        { key: 'Ctrl + G', desc: 'Group selection in Container' },
        { key: 'Ctrl + L', desc: 'Toggle Lock on selection' },
      ],
    },
    {
      title: 'Canvas & Navigation',
      shortcuts: [
        { key: 'Ctrl + Wheel', desc: 'Focal point zoom in / out' },
        { key: 'Ctrl + 0', desc: 'Reset zoom to 100%' },
        { key: 'Shift + 1', desc: 'Fit canvas to screen' },
        { key: 'Alt + Drag', desc: 'Pan canvas workspace' },
        { key: 'Space', desc: 'Toggle timeline playback' },
        { key: 'F', desc: 'Frame selected object in 3D' },
      ],
    },
    {
      title: 'View & Workspace Toggles',
      shortcuts: [
        { key: "Ctrl + '", desc: 'Toggle Dot Grid visibility' },
        { key: 'Ctrl + R', desc: 'Toggle Pixel Rulers' },
        { key: 'F11', desc: 'Toggle Full Screen mode' },
        { key: '1 / 2 / 3', desc: 'Switch DOM / 3D / Preview' },
      ],
    },
  ];

  return (
    <div className="uk-palette__backdrop" role="presentation" onClick={onClose}>
      <div
        className="bs-modal bs-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard Shortcuts"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="bs-modal__head">
          <strong>Keyboard Shortcuts Reference</strong>
          <button className="uk-iconbtn" aria-label="Close" onClick={onClose}>
            {Icons.close}
          </button>
        </header>
        <div className="bs-modal__body bs-flex-col bs-modal-body-gap-lg">
          {categories.map((cat) => (
            <div key={cat.title}>
              <span className="bs-group-label bs-group-label--section bs-modal-cat-label">
                {cat.title}
              </span>
              <div className="bs-shortcut-grid">
                {cat.shortcuts.map((sc) => (
                  <div key={sc.key} className="bs-shortcut-row">
                    <span className="bs-muted">{sc.desc}</span>
                    <kbd className="uk-menu__kbd">{sc.key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <footer className="bs-modal__foot">
          <button className="uk-btn uk-btn--primary uk-btn--sm" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}


/** 2. Project Settings Dialog */
export function ProjectSettingsModal({ onClose }: { onClose: () => void }) {
  const m = getManifest();
  const cloud = getCloudStatus();
  const [name, setName] = useState(m.projectName);
  const [desktopW, setDesktopW] = useState(m.breakpoints.desktop.canvasWidth);
  const [tabletW, setTabletW] = useState(m.breakpoints.tablet.canvasWidth);
  const [mobileW, setMobileW] = useState(m.breakpoints.mobile.canvasWidth);
  const [bgColor, setBgColor] = useState(m.environment?.backgroundColor ?? '#0b0d10');
  const [stagePlacement, setStagePlacement] = useState<'background' | 'overlay'>(m.stage?.placement ?? 'background');

  const save = () => {
    dispatch({ type: 'set', path: 'projectName', value: name });
    dispatch({
      type: 'set',
      path: 'breakpoints',
      value: {
        desktop: { label: 'Desktop (Base)', canvasWidth: desktopW },
        tablet: { label: 'Tablet', canvasWidth: tabletW },
        mobile: { label: 'Mobile', canvasWidth: mobileW },
      },
    });
    dispatch({ type: 'set', path: 'environment.backgroundColor', value: bgColor });
    dispatch({ type: 'set', path: 'stage.placement', value: stagePlacement });
    toast('Project settings saved', 'ok', 'Settings Updated');
    onClose();
  };

  const totalSections = m.sections.length;
  const totalDom = Object.keys(m.domNodes).length;
  const totalScene = Object.keys(m.sceneNodes).length;
  const totalAssets = m.assets.length;

  return (
    <div className="uk-palette__backdrop" role="presentation" onClick={onClose}>
      <div
        className="bs-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Project Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="bs-modal__head">

          <div className="bs-flex-row bs-modal-settings-header">
            <span className="bs-accent-icon">{Icons.settings}</span>
            <strong>Project Settings</strong>
          </div>
          <button className="uk-iconbtn" aria-label="Close" onClick={onClose}>
            {Icons.close}
          </button>
        </header>

        <div className="bs-modal__body bs-flex-col bs-modal-body-gap-md">
          {/* Section 1: Identity */}
          <div>
            <span className="bs-group-label bs-group-label--section">Project Identity</span>
            <input
              type="text"
              value={name}
              placeholder="Project Name"
              onChange={(e) => setName(e.target.value)}
              className="bs-field-input"
            />
          </div>

          {/* Section 2: Breakpoints */}
          <div>
            <span className="bs-group-label bs-group-label--section">Breakpoint Canvas Widths (px)</span>
            <div className="bs-modal-grid-3">
              <div className="bs-modal-card">
                <span className="bs-modal-card__label">{Icons.desktop} Desktop</span>
                <input
                  type="number"
                  value={desktopW}
                  onChange={(e) => setDesktopW(Number(e.target.value))}
                  className="bs-field-input bs-field-input--sm"
                />
              </div>

              <div className="bs-modal-card">
                <span className="bs-modal-card__label">{Icons.tablet} Tablet</span>
                <input
                  type="number"
                  value={tabletW}
                  onChange={(e) => setTabletW(Number(e.target.value))}
                  className="bs-field-input bs-field-input--sm"
                />
              </div>

              <div className="bs-modal-card">
                <span className="bs-modal-card__label">{Icons.mobile} Mobile</span>
                <input
                  type="number"
                  value={mobileW}
                  onChange={(e) => setMobileW(Number(e.target.value))}
                  className="bs-field-input bs-field-input--sm"
                />
              </div>
            </div>
          </div>

          {/* Section 3: 3D Stage & Backdrop */}
          <div>
            <span className="bs-group-label bs-group-label--section">3D Stage Backdrop Settings</span>
            <div className="bs-modal-grid-2">
              <div>
                <span className="bs-field-label">Environment Background</span>
                <div className="bs-color-well-row">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                  />
                  <input
                    type="text"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="bs-field-input bs-field-input--mono"
                  />
                </div>
              </div>

              <div>
                <span className="bs-field-label">3D Stage Layer Placement</span>
                <select
                  value={stagePlacement}
                  onChange={(e) => setStagePlacement(e.target.value as 'background' | 'overlay')}
                  className="bs-field-input"
                >
                  <option value="background">Background Backdrop (behind DOM)</option>
                  <option value="overlay">Foreground Overlay (above DOM)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Architecture & Metrics Card */}
          <div className="bs-modal-card bs-flex-col bs-modal-arch-card">
            <div className="bs-flex-row bs-modal-arch-header">
              <span className="bs-modal-arch-title">Storage &amp; Sync Architecture</span>
              <span
                className="bs-storage-pill"
                data-mode={cloud.mode}
              >
                <span className="bs-storage-pill__dot" />
                {cloud.mode === 'postgresql' ? 'PostgreSQL 5432 Connected' : 'IndexedDB Offline'}
              </span>
            </div>

            <div className="bs-modal-metrics-grid">
              <div className="bs-metric-card">
                <div className="bs-metric-card__val">{totalSections}</div>
                <div className="bs-metric-card__lbl">Sections</div>
              </div>
              <div className="bs-metric-card">
                <div className="bs-metric-card__val">{totalDom}</div>
                <div className="bs-metric-card__lbl">DOM Elements</div>
              </div>
              <div className="bs-metric-card">
                <div className="bs-metric-card__val">{totalScene}</div>
                <div className="bs-metric-card__lbl">3D Nodes</div>
              </div>
              <div className="bs-metric-card">
                <div className="bs-metric-card__val">{totalAssets}</div>
                <div className="bs-metric-card__lbl">Assets</div>
              </div>
            </div>
          </div>
        </div>

        <footer className="bs-modal__foot">
          <button className="uk-btn uk-btn--secondary uk-btn--sm" onClick={onClose}>
            Cancel
          </button>
          <button className="uk-btn uk-btn--primary uk-btn--sm" onClick={save}>
            Save Changes
          </button>
        </footer>
      </div>
    </div>
  );
}

/** 3. Designer Preferences Dialog */
export function PreferencesModal({ onClose }: { onClose: () => void }) {
  const theme = useUIState((s) => s.theme);
  const showGrid = useUIState((s) => s.showGrid);
  const showRulers = useUIState((s) => s.showRulers);
  const showGuides = useUIState((s) => s.showGuides);
  const snapToGrid = useUIState((s) => s.snapToGrid);
  const snapToElements = useUIState((s) => s.snapToElements);

  return (
    <div className="uk-palette__backdrop" role="presentation" onClick={onClose}>
      <div
        className="bs-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Designer Preferences"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="bs-modal__head">
          <strong>Designer Preferences</strong>
          <button className="uk-iconbtn" aria-label="Close" onClick={onClose}>
            {Icons.close}
          </button>
        </header>
        <div className="bs-modal__body bs-flex-col bs-modal-body-gap-sm">
          <label className="bs-modal__check bs-modal-pref-row">
            <span>Dark Workspace Theme</span>
            <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
          </label>
          <label className="bs-modal__check bs-modal-pref-row">
            <span>Show Dot Grid Background</span>
            <input type="checkbox" checked={showGrid} onChange={toggleGrid} />
          </label>
          <label className="bs-modal__check bs-modal-pref-row">
            <span>Show Horizontal &amp; Vertical Pixel Rulers</span>
            <input type="checkbox" checked={showRulers} onChange={toggleRulers} />
          </label>
          <label className="bs-modal__check bs-modal-pref-row">
            <span>Show Interactive Alignment Guides</span>
            <input type="checkbox" checked={showGuides} onChange={toggleGuides} />
          </label>
          <label className="bs-modal__check bs-modal-pref-row">
            <span>Snap to Canvas Dot Grid</span>
            <input type="checkbox" checked={snapToGrid} onChange={toggleSnapToGrid} />
          </label>
          <label className="bs-modal__check bs-modal-pref-row">
            <span>Snap to Neighbouring Elements (6px)</span>
            <input type="checkbox" checked={snapToElements} onChange={toggleSnapToElements} />
          </label>
        </div>
        <footer className="bs-modal__foot">
          <button className="uk-btn uk-btn--primary uk-btn--sm" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}

/** 4. Rename Project Dialog */
export function RenameProjectModal({ onClose }: { onClose: () => void }) {
  const m = getManifest();
  const [val, setVal] = useState(m.projectName);

  const apply = () => {
    if (!val.trim()) return;
    dispatch({ type: 'set', path: 'projectName', value: val.trim() });
    toast(`Project renamed to '${val.trim()}'`, 'ok', 'Project Renamed');
    onClose();
  };

  return (
    <div className="uk-palette__backdrop" role="presentation" onClick={onClose}>
      <div
        className="bs-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Rename Project"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="bs-modal__head">
          <strong>Rename Project</strong>
          <button className="uk-iconbtn" aria-label="Close" onClick={onClose}>
            {Icons.close}
          </button>
        </header>
        <div className="bs-modal__body">
          <label className="bs-group-label bs-group-label--section">
            New Project Name
          </label>
          <input
            type="text"
            value={val}
            autoFocus
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && apply()}
            className="bs-field-input"
          />
        </div>
        <footer className="bs-modal__foot">
          <button className="uk-btn uk-btn--secondary uk-btn--sm" onClick={onClose}>
            Cancel
          </button>
          <button className="uk-btn uk-btn--primary uk-btn--sm" onClick={apply}>
            Rename
          </button>
        </footer>
      </div>
    </div>
  );
}

/** 5. About Build Studio Dialog */
export function AboutModal({ onClose }: { onClose: () => void }) {
  const m = getManifest();
  return (
    <div className="uk-palette__backdrop" role="presentation" onClick={onClose}>
      <div
        className="bs-modal"
        role="dialog"
        aria-modal="true"
        aria-label="About Forge & Canvas"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="bs-modal__head">
          <strong>About Forge &amp; Canvas</strong>
          <button className="uk-iconbtn" aria-label="Close" onClick={onClose}>
            {Icons.close}
          </button>
        </header>
        <div className="bs-modal__body bs-flex-col bs-modal-settings-gap">
          <div className="bs-about-center">
            <h2 className="bs-about-title">Forge &amp; Canvas v4.0.0</h2>
            <span className="bs-about-sub">Advanced Agentic Coding Suite · Google DeepMind</span>
          </div>

          <div className="bs-modal-card">
            <span className="bs-about-card-title">Non-Negotiable Architecture Invariants:</span>
            <ul className="bs-about-list">
              <li>Canonical Progress Clock <code>[0, 1]</code> (PRD-INV-01)</li>
              <li>Imperative Three.js WebGL Runtime (PRD-INV-02)</li>
              <li>Single Source of Truth Command Engine (IL-1)</li>
              <li>Immutable Published Snapshots (IL-4/IL-5)</li>
            </ul>
          </div>

          <div className="bs-mono bs-muted bs-about-manifest">
            Active Manifest: {m.projectName} · {m.sections.length} Sections · {Object.keys(m.domNodes).length} DOM Elements · {Object.keys(m.sceneNodes).length} 3D Nodes
          </div>
        </div>
        <footer className="bs-modal__foot">
          <button className="uk-btn uk-btn--primary uk-btn--sm" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
