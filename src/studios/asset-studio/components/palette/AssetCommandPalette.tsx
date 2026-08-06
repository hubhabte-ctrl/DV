/**
 * Command palette (Doc 05   2): Ctrl/Cmd+K global search across commands,
 * scene nodes, DOM nodes, and timeline tracks.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { getManifest, redo, undo } from '@bs/engine';
import { isPlaying, pause, play, setProgress } from '../../../../engine/progress';
import { setUIState, useUIState, type EditorMode } from '@bs/engine';
import { getViewport } from '../../../../viewport/handleRegistry';

interface PaletteItem {
  id: string;
  label: string;
  hint: string;
  run(): void;
}

function buildItems(): PaletteItem[] {
  const m = getManifest();
  const items: PaletteItem[] = [];
  const go = (mode: EditorMode) => () => setUIState({ mode, paletteOpen: false });
  items.push(
    { id: 'mode-dom', label: 'Go to DOM Canvas', hint: 'mode', run: go('dom') },
    { id: 'mode-3d', label: 'Go to 3D Studio', hint: 'mode', run: go('3d') },
    { id: 'mode-material', label: 'Go to Material Studio', hint: 'mode', run: go('material') },
    { id: 'mode-assets', label: 'Go to Asset Studio', hint: 'mode', run: go('assets') },
    { id: 'mode-animate', label: 'Go to Animate', hint: 'mode', run: go('animate') },
    { id: 'mode-preview', label: 'Go to Preview', hint: 'mode', run: go('preview') },
    {
      id: 'cmd-undo',
      label: 'Undo',
      hint: 'Ctrl+Z',
      run: () => {
        undo();
        setUIState({ paletteOpen: false });
      },
    },
    {
      id: 'cmd-redo',
      label: 'Redo',
      hint: 'Ctrl+Shift+Z',
      run: () => {
        redo();
        setUIState({ paletteOpen: false });
      },
    },
    {
      id: 'cmd-play',
      label: isPlaying() ? 'Pause playback' : 'Play (simulates progress)',
      hint: 'Space',
      run: () => {
        isPlaying() ? pause() : play();
        setUIState({ paletteOpen: false });
      },
    },
    {
      id: 'cmd-frame',
      label: 'Frame selected in viewport',
      hint: 'F',
      run: () => {
        getViewport()?.frameSelected();
        setUIState({ paletteOpen: false });
      },
    },
    {
      id: 'cmd-start',
      label: 'Jump to progress 0',
      hint: 'timeline',
      run: () => {
        setProgress(0);
        setUIState({ paletteOpen: false });
      },
    },
  );
  for (const id of Object.keys(m.domNodes)) {
    const n = m.domNodes[id];
    items.push({
      id: `dom-${id}`,
      label: n.label,
      hint: 'DOM node',
      run: () => setUIState({ mode: 'dom', selectedDomNodeId: id, paletteOpen: false }),
    });
  }
  for (const id of Object.keys(m.sceneNodes)) {
    const n = m.sceneNodes[id];
    items.push({
      id: `scene-${id}`,
      label: n.label,
      hint: 'scene node',
      run: () => setUIState({ mode: '3d', selectedSceneNodeId: id, paletteOpen: false }),
    });
  }
  for (const t of m.tracks) {
    items.push({
      id: `track-${t.id}`,
      label: t.label,
      hint: 'track',
      run: () => setUIState({ mode: 'animate', selectedTrackId: t.id, paletteOpen: false }),
    });
  }
  return items;
}

export function AssetCommandPalette() {
  const open = useUIState((s) => s.paletteOpen);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    if (!open) return [];
    const all = buildItems();
    const q = query.trim().toLowerCase();
    return (
      q ? all.filter((i) => i.label.toLowerCase().includes(q) || i.hint.toLowerCase().includes(q)) : all
    ).slice(0, 12);
  }, [open, query]);

  /* Reset the palette when it (re)opens   " state adjusted during render
     (React-sanctioned pattern) instead of a cascading setState-in-effect
     (WS1-R4 lint fix); only the focus side-effect stays in the effect. */
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery('');
      setCursor(0);
    }
  }
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  if (!open) return null;

  return (
    <div className="uk-palette__backdrop" onClick={() => setUIState({ paletteOpen: false })}>
      <div
        className="uk-palette"
        role="dialog"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="uk-input uk-palette__input"
          placeholder="Type a command or node name…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, items.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === 'Enter') {
              items[cursor]?.run();
            } else if (e.key === 'Escape') {
              setUIState({ paletteOpen: false });
            }
          }}
        />
        <div className="uk-palette__list">
          {items.map((item, i) => (
            <div
              key={item.id}
              className={`uk-palette__item ${i === cursor ? 'uk-palette__item--active' : ''}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => item.run()}
            >
              <span>{item.label}</span>
              <span className="bs-muted" style={{ fontSize: 'var(--bs-typography-size-xs)' }}>
                {item.hint}
              </span>
            </div>
          ))}
          {items.length === 0 && <div className="uk-palette__item bs-muted">No matches</div>}
        </div>
      </div>
    </div>
  );
}
