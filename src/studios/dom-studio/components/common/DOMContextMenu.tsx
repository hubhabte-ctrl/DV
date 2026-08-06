/**
 * DOMContextMenu   " Dedicated, context-aware right-click context menu for DOM Studio.
 *
 * Replaces generic OS context menu with a purpose-built, dark glassmorphic menu
 * containing context-sensitive DOM builder actions (Add Element, Duplicate, Copy/Paste,
 * Wrap in Container, Group/Ungroup, Lock/Unlock, Hide/Show, Bring Forward/Send Backward,
 * Align, Convert to Component, Delete).
 *
 * All mutations execute via the Command Engine (IL-1) and support full undo/redo.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  addDomNode,
  createComponentFromNode,
  dispatch,
  dispatchBatch,
  duplicateDomNode,
  duplicateSection,
  findDomParent,
  getManifest,
  newNodeId,
  removeDomNode,
  removeSection,
  resolveStyle,
  setStyleValue,
  type DomNode,
} from '@bs/engine';
import { setUIState, useUIState } from '@bs/engine';
import { Icons } from '../../../../app/ui/Icons';
import { toast } from '../../../../app/ui/Toast';
import { addScene3dNode, alignSelection, type AlignOp } from '../../../../engine/domCanvasHelpers';

/* Simple in-memory clipboard snapshot buffer */
let domClipboard: DomNode | null = null;

export interface DomContextMenuProps {
  x: number;
  y: number;
  targetId: string | null;
  onClose: () => void;
}

export function DOMContextMenu({ x, y, targetId, onClose }: DomContextMenuProps) {
  const m = getManifest();
  const profile = useUIState((s) => s.profile);
  const selectedDomIds = useUIState((s) => s.selectedDomNodeIds);
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

  // Active target node
  const activeId = targetId ?? (selectedDomIds[0] || null);
  const node = activeId ? m.domNodes[activeId] : null;
  const isSectionRoot = activeId ? m.domRootOrder.includes(activeId) : false;
  const sectionObj = activeId ? m.sections.find((s) => s.rootDomNodeId === activeId) : null;
  const parentId = activeId ? findDomParent(activeId) : null;

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

  /*  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  Action Implementations  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */

  const handleCopy = () => {
    if (!node) return;
    domClipboard = structuredClone(node);
    toast(`Copied '${node.label}' to clipboard`);
    onClose();
  };

  const handlePaste = () => {
    if (!domClipboard) {
      toast('Clipboard is empty');
      onClose();
      return;
    }
    const targetParentId = activeId && isContainer(node) ? activeId : (parentId ?? m.domRootOrder[0]);
    if (!targetParentId) return;

    const cloneSubtree = (src: DomNode): DomNode => {
      const copy: DomNode = {
        ...structuredClone(src),
        id: newNodeId(src.type),
        label: `${src.label} copy`,
      };
      copy.children = src.children.map((childId) => {
        const childNode = m.domNodes[childId];
        return childNode ? cloneSubtree(childNode).id : childId;
      });
      dispatch({ type: 'set', path: `domNodes.${copy.id}`, value: copy });
      return copy;
    };

    const newRoot = cloneSubtree(domClipboard);
    addDomNode(targetParentId, newRoot, m.domNodes[targetParentId]?.children?.length ?? 0);
    setUIState({ selectedDomNodeId: newRoot.id });
    toast(`Pasted '${newRoot.label}'`);
    onClose();
  };

  const handleDuplicate = () => {
    if (isSectionRoot && sectionObj) {
      const rootId = duplicateSection(sectionObj.id);
      if (rootId) {
        setUIState({ selectedDomNodeId: rootId });
        toast('Section duplicated');
      }
    } else if (activeId) {
      const newId = duplicateDomNode(activeId);
      if (newId) {
        setUIState({ selectedDomNodeId: newId });
        toast('Element duplicated');
      }
    }
    onClose();
  };

  const handleDelete = () => {
    if (isSectionRoot && sectionObj) {
      if (removeSection(sectionObj.id)) {
        toast('Section deleted');
      } else {
        toast('The page keeps at least one section');
      }
    } else if (activeId) {
      if (removeDomNode(activeId)) {
        setUIState({ selectedDomNodeId: null });
        toast('Element deleted');
      }
    }
    onClose();
  };

  const handleToggleLock = () => {
    if (!node) return;
    dispatch({ type: 'set', path: `domNodes.${node.id}.locked`, value: !node.locked });
    toast(node.locked ? `'${node.label}' unlocked` : `'${node.label}' locked`);
    onClose();
  };

  const handleToggleHide = () => {
    if (!node) return;
    dispatch({ type: 'set', path: `domNodes.${node.id}.hidden`, value: !node.hidden });
    toast(node.hidden ? `'${node.label}' visible` : `'${node.label}' hidden`);
    onClose();
  };

  const handleWrapInContainer = () => {
    if (!node || !parentId) return;
    const parentNode = m.domNodes[parentId];
    if (!parentNode) return;

    const containerId = newNodeId('container');
    const indexInParent = parentNode.children.indexOf(node.id);

    const containerNode: DomNode = {
      id: containerId,
      type: 'container',
      tag: 'div',
      label: `Container · ${node.label}`,
      children: [node.id],
      style: {
        position: 'relative',
        width: '100%',
        padding: 16,
      },
      overrides: {},
    };

    const newChildren = [...parentNode.children];
    newChildren[indexInParent] = containerId;

    dispatchBatch([
      { type: 'set', path: `domNodes.${containerId}`, value: containerNode },
      { type: 'set', path: `domNodes.${parentId}.children`, value: newChildren },
    ]);

    setUIState({ selectedDomNodeId: containerId });
    toast(`Wrapped in container`);
    onClose();
  };

  const handleDissolveContainer = () => {
    if (!node || node.type !== 'container' || !parentId) return;
    const parentNode = m.domNodes[parentId];
    if (!parentNode) return;

    const indexInParent = parentNode.children.indexOf(node.id);
    const newChildren = [...parentNode.children];
    newChildren.splice(indexInParent, 1, ...node.children);

    dispatchBatch([
      { type: 'set', path: `domNodes.${parentId}.children`, value: newChildren },
      { type: 'set', path: `domNodes.${node.id}`, value: undefined },
    ]);

    toast(`Container dissolved`);
    onClose();
  };

  const handleCreateComponent = () => {
    if (!activeId) return;
    const defId = createComponentFromNode(activeId);
    if (defId) {
      toast(`'${node?.label}' converted to component`);
    }
    onClose();
  };

  const handleBringForward = () => {
    if (!node) return;
    const style = resolveStyle(node, profile);
    const currentZ = Number(style.zIndex ?? 1);
    setStyleValue(node.id, profile, 'zIndex', currentZ + 1);
    toast(`Z-Index raised to ${currentZ + 1}`);
    onClose();
  };

  const handleSendBackward = () => {
    if (!node) return;
    const style = resolveStyle(node, profile);
    const currentZ = Number(style.zIndex ?? 1);
    setStyleValue(node.id, profile, 'zIndex', Math.max(0, currentZ - 1));
    toast(`Z-Index lowered to ${Math.max(0, currentZ - 1)}`);
    onClose();
  };

  const handleAddElement = (type: string, label: string) => {
    const targetParentId = activeId && isContainer(node) ? activeId : (parentId ?? m.domRootOrder[0]);
    if (!targetParentId) return;

    if (type === 'scene3d') {
      addScene3dNode(undefined, label, x, y);
      toast('3D Model element added');
      onClose();
      return;
    }

    const elemId = newNodeId(type);
    const elemNode: DomNode = {
      id: elemId,
      type,
      tag: type === 'heading' ? 'h2' : 'div',
      label: `${label} · New`,
      children: [],
      content: type === 'heading' ? 'Heading Text' : type === 'text' ? 'Paragraph text content...' : type === 'button' ? 'Click Me' : undefined,
      style: {
        position: 'relative',
        fontSize: type === 'heading' ? 24 : 14,
        color: '#ffffff',
      },
      overrides: {},
    };

    const parentNode = m.domNodes[targetParentId];
    addDomNode(targetParentId, elemNode, parentNode?.children?.length ?? 0);
    setUIState({ selectedDomNodeId: elemId });
    toast(`${label} added`);
    onClose();
  };

  const handleAlign = (op: AlignOp) => {
    alignSelection(op, profile);
    toast(`Selection aligned (${op})`);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="bs-contextmenu"
      style={{ left: coords.left, top: coords.top }}
      role="menu"
      aria-label="DOM Context Menu"
    >
      {/*  "  "  Context Header Label  "  "  */}
      <div className="bs-contextmenu__header">
        <span className="bs-contextmenu__header-ic">{node ? (DOM_ICON[node.type] ?? Icons.container) : Icons.section}</span>
        <span className="bs-contextmenu__header-title">{node ? node.label : 'Canvas Background'}</span>
      </div>

      <div className="bs-contextmenu__sep" role="separator" />

      {/*  "  "  Add Element Submenu  "  "  */}
      <div
        className="bs-contextmenu__item bs-contextmenu__item--has-sub"
        onMouseEnter={() => setActiveSubmenu('add')}
        onMouseLeave={() => setActiveSubmenu(null)}
      >
        <span className="bs-contextmenu__ic">{Icons.plus}</span>
        <span className="bs-contextmenu__lbl">Add Element</span>
        <span className="bs-contextmenu__arrow">›</span>

        {activeSubmenu === 'add' && (
          <div className="bs-contextmenu__sub">
            <button className="bs-contextmenu__item" onClick={() => handleAddElement('heading', 'Heading')}>
              <span className="bs-contextmenu__ic">{Icons.heading}</span>
              <span>Heading</span>
            </button>
            <button className="bs-contextmenu__item" onClick={() => handleAddElement('text', 'Text')}>
              <span className="bs-contextmenu__ic">{Icons.text}</span>
              <span>Text Paragraph</span>
            </button>
            <button className="bs-contextmenu__item" onClick={() => handleAddElement('button', 'Button')}>
              <span className="bs-contextmenu__ic">{Icons.buttonEl}</span>
              <span>Button</span>
            </button>
            <button className="bs-contextmenu__item" onClick={() => handleAddElement('container', 'Container')}>
              <span className="bs-contextmenu__ic">{Icons.container}</span>
              <span>Container</span>
            </button>
            <button className="bs-contextmenu__item" onClick={() => handleAddElement('image', 'Image')}>
              <span className="bs-contextmenu__ic">{Icons.image}</span>
              <span>Image</span>
            </button>
            <button className="bs-contextmenu__item" onClick={() => handleAddElement('scene3d', '3D Scene Embed')}>
              <span className="bs-contextmenu__ic">{Icons.cube}</span>
              <span>3D Model Embed</span>
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

      <button
        className="bs-contextmenu__item"
        onClick={handlePaste}
        disabled={!domClipboard}
      >
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

      {/*  "  "  Hierarchy & Grouping  "  "  */}
      {node && !isSectionRoot && (
        <>
          <button className="bs-contextmenu__item" onClick={handleWrapInContainer}>
            <span className="bs-contextmenu__ic">{Icons.container}</span>
            <span className="bs-contextmenu__lbl">Wrap in Container</span>
            <kbd className="bs-contextmenu__kbd">Ctrl+G</kbd>
          </button>

          {node.type === 'container' && (
            <button className="bs-contextmenu__item" onClick={handleDissolveContainer}>
              <span className="bs-contextmenu__ic">{Icons.layers}</span>
              <span className="bs-contextmenu__lbl">Dissolve Container</span>
            </button>
          )}

          <button className="bs-contextmenu__item" onClick={handleCreateComponent}>
            <span className="bs-contextmenu__ic">{Icons.cube}</span>
            <span className="bs-contextmenu__lbl">Create Component</span>
          </button>
        </>
      )}

      {node && (
        <>
          <div className="bs-contextmenu__sep" role="separator" />
          {/*  "  "  Stacking Order  "  "  */}
          <button className="bs-contextmenu__item" onClick={handleBringForward}>
            <span className="bs-contextmenu__ic">  '</span>
            <span className="bs-contextmenu__lbl">Bring Forward</span>
          </button>
          <button className="bs-contextmenu__item" onClick={handleSendBackward}>
            <span className="bs-contextmenu__ic">  "</span>
            <span className="bs-contextmenu__lbl">Send Backward</span>
          </button>

          {/*  "  "  Align Submenu  "  "  */}
          {selectedDomIds.length > 1 && (
            <div
              className="bs-contextmenu__item bs-contextmenu__item--has-sub"
              onMouseEnter={() => setActiveSubmenu('align')}
              onMouseLeave={() => setActiveSubmenu(null)}
            >
              <span className="bs-contextmenu__ic">·</span>
              <span className="bs-contextmenu__lbl">Align Selection</span>
              <span className="bs-contextmenu__arrow">›</span>

              {activeSubmenu === 'align' && (
                <div className="bs-contextmenu__sub">
                  <button className="bs-contextmenu__item" onClick={() => handleAlign('left')}>Align Left</button>
                  <button className="bs-contextmenu__item" onClick={() => handleAlign('centerH')}>Align Center H</button>
                  <button className="bs-contextmenu__item" onClick={() => handleAlign('right')}>Align Right</button>
                  <button className="bs-contextmenu__item" onClick={() => handleAlign('top')}>Align Top</button>
                  <button className="bs-contextmenu__item" onClick={() => handleAlign('centerV')}>Align Center V</button>
                  <button className="bs-contextmenu__item" onClick={() => handleAlign('bottom')}>Align Bottom</button>
                </div>
              )}
            </div>
          )}

          <div className="bs-contextmenu__sep" role="separator" />

          {/*  "  "  Lock / Hide  "  "  */}
          <button className="bs-contextmenu__item" onClick={handleToggleLock}>
            <span className="bs-contextmenu__ic">{node.locked ? Icons.unlock : Icons.lock}</span>
            <span className="bs-contextmenu__lbl">{node.locked ? 'Unlock Layer' : 'Lock Layer'}</span>
          </button>

          <button className="bs-contextmenu__item" onClick={handleToggleHide}>
            <span className="bs-contextmenu__ic">{node.hidden ? Icons.eye : Icons.eyeOff}</span>
            <span className="bs-contextmenu__lbl">{node.hidden ? 'Show Layer' : 'Hide Layer'}</span>
          </button>
        </>
      )}

      {/*  "  "  Delete  "  "  */}
      {node && (
        <>
          <div className="bs-contextmenu__sep" role="separator" />
          <button className="bs-contextmenu__item bs-contextmenu__item--danger" onClick={handleDelete}>
            <span className="bs-contextmenu__ic">{Icons.trash}</span>
            <span className="bs-contextmenu__lbl">Delete</span>
            <kbd className="bs-contextmenu__kbd">Del</kbd>
          </button>
        </>
      )}
    </div>
  );
}

function isContainer(node: DomNode | null): boolean {
  if (!node) return false;
  return node.type === 'container' || node.type === 'section';
}

const DOM_ICON: Record<string, React.ReactNode> = {
  section: Icons.section,
  container: Icons.container,
  heading: Icons.heading,
  text: Icons.text,
  button: Icons.buttonEl,
  image: Icons.image,
  scene3d: Icons.cube,
};
