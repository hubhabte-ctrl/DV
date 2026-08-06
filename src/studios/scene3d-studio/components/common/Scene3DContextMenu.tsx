/**
 * Scene3DContextMenu   " Dedicated, context-aware right-click context menu for 3D Studio.
 *
 * Replaces native browser right-click menu with a purpose-built, dark glassmorphic 3D menu
 * containing 3D object actions (Add Primitives/Lights/Camera/Group/Anchor, Duplicate,
 * Copy/Paste, Reset Transform, Set Active Camera, Material Assignment, Focus View,
 * Group/Ungroup, Lock/Unlock, Show/Hide, Delete).
 *
 * All mutations execute via the Command Engine (IL-1) and support full undo/redo.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  addSceneNode,
  duplicateMaterial,
  duplicateSceneNode,
  dispatch,
  dispatchBatch,
  findSceneParent,
  getManifest,
  groupSceneNode,
  newNodeId,
  removeSceneNode,
  setActiveCamera,
  type SceneNode,
} from '@bs/engine';
import { setUIState, useUIState } from '@bs/engine';
import { Icons } from '../../../../app/ui/Icons';
import { toast } from '../../../../app/ui/Toast';
import { getViewport } from '../../../../viewport/handleRegistry';

/* Simple in-memory 3D scene clipboard snapshot buffer */
let sceneClipboard: SceneNode | null = null;

function formatMaterialName(name: string): string {
  if (!name) return 'Material';
  let clean = name.replace(/M_[a-f0-9]{8}[-_][a-f0-9]{4}[-_][a-f0-9]{4}[-_][a-f0-9]{4}[-_][a-f0-9]{12}[-_]?/gi, '');
  clean = clean.replace(/M_[a-f0-9_-]{12,}[-_]?/gi, '');
  clean = clean.replace(/^Material_\d+\s*[- *]?\s*/gi, '');
  clean = clean.replace(/^fallback\s*Material\s*[- *]?\s*/gi, '');
  clean = clean.trim();
  return clean || name;
}


export interface Scene3dContextMenuProps {
  x: number;
  y: number;
  targetId: string | null;
  onClose: () => void;
}

export function Scene3DContextMenu({ x, y, targetId, onClose }: Scene3dContextMenuProps) {
  const m = getManifest();
  const selectedSceneIds = useUIState((s) => s.selectedSceneNodeIds);
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

  // Active target 3D node
  const activeId = targetId ?? (selectedSceneIds[0] || null);
  const node = activeId ? m.sceneNodes[activeId] : null;
  const parentId = activeId ? findSceneParent(activeId) : null;
  const isCamera = node?.type === 'camera';
  const isMesh = node?.type === 'mesh';
  const isGroup = node?.type === 'group';
  const currentMatId = typeof node?.props?.materialId === 'string' ? node.props.materialId : null;

  // Viewport clamping
  const [coords, setCoords] = useState<{ left: number; top: number }>({ left: x, top: y });

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const left = x + rect.width > winW - 12 ? Math.max(12, winW - rect.width - 12) : x;
      const top = y + rect.height > winH - 12 ? Math.max(12, winH - rect.height - 12) : y;
      setCoords({ left, top });
    }
  }, [x, y]);

  // Close on outside pointerdown or Escape
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  /*  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  3D Action Handlers  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */

  const handleCopy = () => {
    if (!node) return;
    sceneClipboard = structuredClone(node);
    toast(`Copied 3D object '${node.label}'`);
    onClose();
  };

  const handlePaste = () => {
    if (!sceneClipboard) {
      toast('3D Clipboard is empty');
      onClose();
      return;
    }
    const targetParentId = activeId && isGroup ? activeId : parentId;

    const cloneSubtree = (src: SceneNode): SceneNode => {
      const copy: SceneNode = {
        ...structuredClone(src),
        id: newNodeId(src.type),
        label: `${src.label} copy`,
      };
      if (copy.type === 'camera' && copy.props) {
        copy.props = { ...copy.props, active: false };
      }
      copy.children = src.children.map((childId) => {
        const childNode = m.sceneNodes[childId];
        return childNode ? cloneSubtree(childNode).id : childId;
      });
      dispatch({ type: 'set', path: `sceneNodes.${copy.id}`, value: copy });
      return copy;
    };

    const newRoot = cloneSubtree(sceneClipboard);
    addSceneNode(newRoot, targetParentId);
    setUIState({ selectedSceneNodeId: newRoot.id });
    toast(`Pasted '${newRoot.label}'`);
    onClose();
  };

  const handleDuplicate = () => {
    if (!activeId) return;
    const newId = duplicateSceneNode(activeId);
    if (newId) {
      setUIState({ selectedSceneNodeId: newId });
      toast('3D Object duplicated');
    }
    onClose();
  };

  const handleDelete = () => {
    if (!activeId) return;
    if (removeSceneNode(activeId)) {
      setUIState({ selectedSceneNodeId: null });
      toast('3D Object deleted');
    } else {
      toast('The active camera cannot be deleted');
    }
    onClose();
  };

  const handleToggleLock = () => {
    if (!node) return;
    dispatch({ type: 'set', path: `sceneNodes.${node.id}.locked`, value: !node.locked });
    toast(node.locked ? `'${node.label}' unlocked` : `'${node.label}' locked`);
    onClose();
  };

  const handleToggleHide = () => {
    if (!node) return;
    dispatch({ type: 'set', path: `sceneNodes.${node.id}.visible`, value: !node.visible });
    toast(node.visible ? `'${node.label}' hidden` : `'${node.label}' visible`);
    onClose();
  };

  const handleResetTransform = () => {
    if (!node) return;
    dispatchBatch([
      { type: 'set', path: `sceneNodes.${node.id}.transform.position`, value: [0, 0, 0] },
      { type: 'set', path: `sceneNodes.${node.id}.transform.rotation`, value: [0, 0, 0] },
      { type: 'set', path: `sceneNodes.${node.id}.transform.scale`, value: [1, 1, 1] },
    ]);
    toast(`Transform reset to defaults`);
    onClose();
  };

  const handleFocus = () => {
    if (!activeId) return;
    const handle = getViewport();
    handle?.frameSelected();
    toast(`Focused on '${node?.label}'`);
    onClose();
  };


  const handleSetActiveCamera = () => {
    if (!activeId || !isCamera) return;
    if (setActiveCamera(activeId)) {
      toast(`'${node?.label}' is now the active camera`);
    }
    onClose();
  };

  const handleGroupSelection = () => {
    if (!activeId) return;
    const groupId = groupSceneNode(activeId);
    if (groupId) {
      setUIState({ selectedSceneNodeId: groupId });
      toast(`Group created`);
    }
    onClose();
  };

  const handleForkMaterial = () => {
    if (!node || !currentMatId) return;
    const newMatId = duplicateMaterial(currentMatId);
    if (newMatId) {
      dispatch({ type: 'set', path: `sceneNodes.${node.id}.props.materialId`, value: newMatId });
      setUIState({ selectedMaterialId: newMatId });
      toast(`Forked standalone material '${m.materials[newMatId]?.name}'`);
    }
    onClose();
  };

  const handleAssignMaterial = (matId: string) => {
    if (!node) return;
    dispatch({ type: 'set', path: `sceneNodes.${node.id}.props.materialId`, value: matId });
    toast(`Assigned material '${m.materials[matId]?.name}'`);
    onClose();
  };

  const handleAdd3DObject = (objectKind: string, label: string) => {
    const parent = activeId && isGroup ? activeId : parentId;
    let newNode: SceneNode;

    switch (objectKind) {
      case 'box':
      case 'sphere':
      case 'cylinder':
      case 'plane':
        newNode = {
          id: newNodeId('mesh'),
          label: `${label} Mesh`,
          type: 'mesh',
          visible: true,
          locked: false,
          children: [],
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          props: { primitive: objectKind },
        };
        break;
      case 'directional':
        newNode = {
          id: newNodeId('light'),
          label: 'Directional Light',
          type: 'light',
          visible: true,
          locked: false,
          children: [],
          transform: { position: [3, 5, 4], rotation: [0, 0, 0], scale: [1, 1, 1] },
          props: { lightType: 'directional', color: '#ffffff', intensity: 2 },
        };
        break;
      case 'point':
        newNode = {
          id: newNodeId('light'),
          label: 'Point Light',
          type: 'light',
          visible: true,
          locked: false,
          children: [],
          transform: { position: [0, 2, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          props: { lightType: 'point', color: '#ffffff', intensity: 1.5 },
        };
        break;
      case 'spot':
        newNode = {
          id: newNodeId('light'),
          label: 'Spot Light',
          type: 'light',
          visible: true,
          locked: false,
          children: [],
          transform: { position: [0, 5, 0], rotation: [-Math.PI / 2, 0, 0], scale: [1, 1, 1] },
          props: { lightType: 'spot', color: '#ffffff', intensity: 3 },
        };
        break;
      case 'camera':
        newNode = {
          id: newNodeId('camera'),
          label: 'Perspective Camera',
          type: 'camera',
          visible: true,
          locked: false,
          children: [],
          transform: { position: [0, 2, 5], rotation: [0, 0, 0], scale: [1, 1, 1] },
          props: { fov: 50, near: 0.1, far: 100, active: false },
        };
        break;
      case 'group':
        newNode = {
          id: newNodeId('group'),
          label: '3D Group',
          type: 'group',
          visible: true,
          locked: false,
          children: [],
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        };
        break;
      case 'anchor':
        newNode = {
          id: newNodeId('anchor'),
          label: '3D Anchor',
          type: 'anchor',
          visible: true,
          locked: false,
          children: [],
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        };
        break;
      default:
        return;
    }

    addSceneNode(newNode, parent);
    setUIState({ selectedSceneNodeId: newNode.id });
    toast(`Added 3D ${label}`);
    onClose();
  };

  const materials = Object.values(m.materials);

  return (
    <div
      ref={menuRef}
      className="bs-contextmenu"
      style={{ left: coords.left, top: coords.top }}
      role="menu"
      aria-label="3D Studio Context Menu"
    >
      {/*  "  "  Context Header Label  "  "  */}
      <div className="bs-contextmenu__header">
        <span className="bs-contextmenu__header-ic">
          {node ? (SCENE_ICON[node.type] ?? Icons.cube) : Icons.cube}
        </span>
        <span className="bs-contextmenu__header-title">{node ? node.label : '3D Scene Background'}</span>
      </div>

      <div className="bs-contextmenu__sep" role="separator" />

      {/*  "  "  Add 3D Object Submenu  "  "  */}
      <div
        className="bs-contextmenu__item bs-contextmenu__item--has-sub"
        onMouseEnter={() => setActiveSubmenu('add3d')}
        onMouseLeave={() => setActiveSubmenu(null)}
      >
        <span className="bs-contextmenu__ic">{Icons.plus}</span>
        <span className="bs-contextmenu__lbl">Add 3D Object</span>
        <span className="bs-contextmenu__arrow"> - </span>

        {activeSubmenu === 'add3d' && (
          <div className="bs-contextmenu__sub">
            <button className="bs-contextmenu__item" onClick={() => handleAdd3DObject('box', 'Cube')}>
              <span className="bs-contextmenu__ic">{Icons.cube}</span>
              <span>Cube / Box</span>
            </button>
            <button className="bs-contextmenu__item" onClick={() => handleAdd3DObject('sphere', 'Sphere')}>
              <span className="bs-contextmenu__ic">{Icons.sphere}</span>
              <span>Sphere</span>
            </button>
            <button className="bs-contextmenu__item" onClick={() => handleAdd3DObject('cylinder', 'Cylinder')}>
              <span className="bs-contextmenu__ic">{Icons.cube}</span>
              <span>Cylinder</span>
            </button>
            <button className="bs-contextmenu__item" onClick={() => handleAdd3DObject('plane', 'Plane')}>
              <span className="bs-contextmenu__ic">{Icons.frame}</span>
              <span>Plane</span>
            </button>
            <div className="bs-contextmenu__sep" role="separator" />
            <button className="bs-contextmenu__item" onClick={() => handleAdd3DObject('camera', 'Camera')}>
              <span className="bs-contextmenu__ic">{Icons.camera}</span>
              <span>Camera</span>
            </button>
            <button className="bs-contextmenu__item" onClick={() => handleAdd3DObject('directional', 'Directional Light')}>
              <span className="bs-contextmenu__ic">{Icons.light}</span>
              <span>Directional Light</span>
            </button>
            <button className="bs-contextmenu__item" onClick={() => handleAdd3DObject('point', 'Point Light')}>
              <span className="bs-contextmenu__ic">{Icons.light}</span>
              <span>Point Light</span>
            </button>
            <div className="bs-contextmenu__sep" role="separator" />
            <button className="bs-contextmenu__item" onClick={() => handleAdd3DObject('group', 'Group')}>
              <span className="bs-contextmenu__ic">{Icons.group}</span>
              <span>3D Group</span>
            </button>
            <button className="bs-contextmenu__item" onClick={() => handleAdd3DObject('anchor', 'Anchor')}>
              <span className="bs-contextmenu__ic">{Icons.anchor}</span>
              <span>3D Anchor</span>
            </button>
          </div>
        )}
      </div>

      <div className="bs-contextmenu__sep" role="separator" />

      {/*  "  "  Copy / Paste / Duplicate  "  "  */}
      {node && (
        <button className="bs-contextmenu__item" onClick={handleCopy}>
          <span className="bs-contextmenu__ic">{Icons.duplicate}</span>
          <span className="bs-contextmenu__lbl">Copy</span>
          <kbd className="bs-contextmenu__kbd">Ctrl+C</kbd>
        </button>
      )}

      <button className="bs-contextmenu__item" onClick={handlePaste} disabled={!sceneClipboard}>
        <span className="bs-contextmenu__ic">{Icons.replace}</span>
        <span className="bs-contextmenu__lbl">Paste</span>
        <kbd className="bs-contextmenu__kbd">Ctrl+V</kbd>
      </button>

      {node && (
        <button className="bs-contextmenu__item" onClick={handleDuplicate}>
          <span className="bs-contextmenu__ic">{Icons.duplicate}</span>
          <span className="bs-contextmenu__lbl">Duplicate</span>
          <kbd className="bs-contextmenu__kbd">Ctrl+D</kbd>
        </button>
      )}

      <div className="bs-contextmenu__sep" role="separator" />

      {/*  "  "  Camera & Material Actions  "  "  */}
      {isCamera && (
        <button className="bs-contextmenu__item" onClick={handleSetActiveCamera}>
          <span className="bs-contextmenu__ic">{Icons.camera}</span>
          <span className="bs-contextmenu__lbl">
            {node.props?.active ? 'Active Camera' : 'Set as Active Camera'}
          </span>
        </button>
      )}

      {isMesh && (
        <>
          <div
            className="bs-contextmenu__item bs-contextmenu__item--has-sub"
            onMouseEnter={() => setActiveSubmenu('mats')}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <span className="bs-contextmenu__ic">{Icons.palette}</span>
            <span className="bs-contextmenu__lbl">Assign Material</span>
            <span className="bs-contextmenu__arrow"> - </span>

            {activeSubmenu === 'mats' && (
              <div className="bs-contextmenu__sub">
                {materials.map((mat) => (
                  <button
                    key={mat.id}
                    className="bs-contextmenu__item"
                    onClick={() => handleAssignMaterial(mat.id)}
                  >
                    <span className="bs-contextmenu__ic">{Icons.palette}</span>
                    <span>
                      {formatMaterialName(mat.name)} {mat.id === currentMatId ? '  "' : ''}
                    </span>

                  </button>
                ))}
              </div>
            )}
          </div>

          {currentMatId && (
            <button className="bs-contextmenu__item" onClick={handleForkMaterial}>
              <span className="bs-contextmenu__ic">{Icons.duplicate}</span>
              <span className="bs-contextmenu__lbl">Fork Standalone Material</span>
            </button>
          )}
        </>
      )}

      {node && (
        <>
          <button className="bs-contextmenu__item" onClick={handleFocus}>
            <span className="bs-contextmenu__ic">{Icons.search}</span>
            <span className="bs-contextmenu__lbl">Focus Selection</span>
            <kbd className="bs-contextmenu__kbd">F</kbd>
          </button>

          <button className="bs-contextmenu__item" onClick={handleResetTransform}>
            <span className="bs-contextmenu__ic">{Icons.undo}</span>
            <span className="bs-contextmenu__lbl">Reset Transform</span>
          </button>

          <button className="bs-contextmenu__item" onClick={handleGroupSelection}>
            <span className="bs-contextmenu__ic">{Icons.group}</span>
            <span className="bs-contextmenu__lbl">Group Selection</span>
            <kbd className="bs-contextmenu__kbd">Ctrl+G</kbd>
          </button>

          <div className="bs-contextmenu__sep" role="separator" />

          {/*  "  "  Lock / Hide  "  "  */}
          <button className="bs-contextmenu__item" onClick={handleToggleLock}>
            <span className="bs-contextmenu__ic">{node.locked ? Icons.unlock : Icons.lock}</span>
            <span className="bs-contextmenu__lbl">{node.locked ? 'Unlock Object' : 'Lock Object'}</span>
          </button>

          <button className="bs-contextmenu__item" onClick={handleToggleHide}>
            <span className="bs-contextmenu__ic">{!node.visible ? Icons.eye : Icons.eyeOff}</span>
            <span className="bs-contextmenu__lbl">{!node.visible ? 'Show Object' : 'Hide Object'}</span>
          </button>
        </>
      )}

      {/*  "  "  Delete  "  "  */}
      {node && (
        <>
          <div className="bs-contextmenu__sep" role="separator" />
          <button className="bs-contextmenu__item bs-contextmenu__item--danger" onClick={handleDelete}>
            <span className="bs-contextmenu__ic">{Icons.trash}</span>
            <span className="bs-contextmenu__lbl">Delete Object</span>
            <kbd className="bs-contextmenu__kbd">Del</kbd>
          </button>
        </>
      )}
    </div>
  );
}

const SCENE_ICON: Record<string, React.ReactNode> = {
  mesh: Icons.cube,
  group: Icons.group,
  camera: Icons.camera,
  light: Icons.sun,
  anchor: Icons.anchor,
};
