/** 3D viewport toolbar (Doc 05   5): Select (Q) / Move (W) / Rotate (E) / Scale (R),
 *  local/world space toggle, frame-selected, and the object-creation menu
 *  (Phase 2.2   " audit S-5): meshes, groups, cameras, anchors and the full
 *  FR-133 light set. Icons come from the shared stroke-SVG registry (U-1). */
import { useEffect, useRef, useState } from 'react';
import { IconButton } from '../common/Button';
import { Icons } from '../../../../app/ui/Icons';
import { toast } from '../../../../app/ui/Toast';
import { addSceneNode, newNodeId, type SceneNode } from '@bs/engine';
import { setUIState, useUIState, type TransformTool } from '@bs/engine';
import { getViewport } from '../../../../viewport/handleRegistry';

const TOOLS: { tool: TransformTool; icon: React.ReactNode; tooltip: string }[] = [
  { tool: 'select', icon: Icons.select, tooltip: 'Select (Q)' },
  { tool: 'translate', icon: Icons.move, tooltip: 'Move (W)' },
  { tool: 'rotate', icon: Icons.rotate, tooltip: 'Rotate (E)' },
  { tool: 'scale', icon: Icons.scale, tooltip: 'Scale (R)' },
];

interface AddSpec {
  label: string;
  icon: React.ReactNode;
  build: () => SceneNode;
  separator?: boolean;
}

const baseNode = (type: SceneNode['type'], label: string): SceneNode => ({
  id: newNodeId(type),
  label,
  type,
  visible: true,
  locked: false,
  children: [],
  transform: { position: [0, type === 'light' ? 2 : 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
});

const light = (kind: string, label: string): SceneNode => {
  const n = baseNode('light', label);
  n.props = { kind, intensity: kind === 'ambient' ? 0.5 : 1.2, color: '#ffffff' };
  return n;
};

const ADD_SPECS: AddSpec[] = [
  {
    label: 'Box mesh',
    icon: Icons.cube,
    build: () => {
      const n = baseNode('mesh', 'Box');
      n.props = { primitive: 'box', castShadow: true, receiveShadow: false, materialId: '' };
      return n;
    },
  },
  {
    label: 'Sphere mesh',
    icon: Icons.sphere,
    build: () => {
      const n = baseNode('mesh', 'Sphere');
      n.props = { primitive: 'sphere', castShadow: true, receiveShadow: false, materialId: '' };
      return n;
    },
  },
  { label: 'Group', icon: Icons.group, build: () => baseNode('group', 'Group') },
  {
    label: 'Camera',
    icon: Icons.camera,
    build: () => {
      const n = baseNode('camera', 'Camera');
      n.props = { fov: 50, near: 0.1, far: 100, active: false };
      return n;
    },
  },
  { label: 'Anchor', icon: Icons.anchor, build: () => baseNode('anchor', 'Anchor') },
  {
    label: 'Directional light',
    icon: Icons.light,
    separator: true,
    build: () => light('directional', 'Directional Light'),
  },
  { label: 'Point light', icon: Icons.light, build: () => light('point', 'Point Light') },
  { label: 'Spot light', icon: Icons.light, build: () => light('spot', 'Spot Light') },
  { label: 'Ambient light', icon: Icons.light, build: () => light('ambient', 'Ambient Light') },
  { label: 'Hemisphere light', icon: Icons.light, build: () => light('hemisphere', 'Hemisphere Light') },
];

/** "+" object-creation dropdown (Phase 2.2   " audit S-5). */
function AddObjectMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDocDown);
    return () => document.removeEventListener('pointerdown', onDocDown);
  }, [open]);

  return (
    <span className="bs-addobj" ref={rootRef}>
      <IconButton
        tooltip="Add object"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {Icons.plus}
      </IconButton>
      {open && (
        <div className="bs-addobj__list" role="menu" aria-label="Add object">
          {ADD_SPECS.map((spec) => (
            <div key={spec.label}>
              {spec.separator && <div className="uk-menu__sep" role="separator" />}
              <button
                className="uk-menu__item"
                role="menuitem"
                onClick={() => {
                  const node = spec.build();
                  addSceneNode(node, null); // command engine only (IL-1)
                  setUIState({ selectedSceneNodeId: node.id });
                  setOpen(false);
                  toast(`${node.label} added   " Ctrl+Z removes it`);
                }}
              >
                <span className="bs-addobj__icon">{spec.icon}</span>
                <span>{spec.label}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

export function Scene3DToolbar() {
  const tool = useUIState((s) => s.tool);
  const space = useUIState((s) => s.space);
  return (
    <div className="bs-row bs-viewport__toolbar" role="toolbar" aria-label="3D tools">
      {TOOLS.map((t) => (
        <IconButton
          key={t.tool}
          tooltip={t.tooltip}
          active={tool === t.tool}
          onClick={() => setUIState({ tool: t.tool })}
        >
          {t.icon}
        </IconButton>
      ))}
      <span className="bs-viewport__toolbar-sep" />
      <IconButton
        tooltip={`Space: ${space} (click to toggle)`}
        onClick={() => setUIState({ space: space === 'world' ? 'local' : 'world' })}
      >
        {space === 'world' ? Icons.world : Icons.local}
      </IconButton>
      <IconButton tooltip="Frame selected (F)" onClick={() => getViewport()?.frameSelected()}>
        {Icons.frame}
      </IconButton>
      <span className="bs-viewport__toolbar-sep" />
      <AddObjectMenu />
    </div>
  );
}
