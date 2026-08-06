import { useState } from 'react';
import { Tree, type TreeItem } from '../common/Tree';
import { Icons } from '../../../../app/ui/Icons';
import { toast } from '../../../../app/ui/Toast';
import { MaterialContextMenu as Scene3DContextMenu } from '../common/MaterialContextMenu';
import {
  addSceneNode,
  dispatch,
  duplicateSceneNode,
  getManifest,
  moveSceneNode,
  moveSceneNodeBeside,
  newNodeId,
  removeSceneNode,
  setUIState,
  toggleSceneSelection,
  useUIState,
} from '@bs/engine';

const SCENE_ICON: Record<string, React.ReactNode> = {
  mesh: Icons.cube,
  group: Icons.group,
  camera: Icons.camera,
  light: Icons.light,
  anchor: Icons.anchor,
};

function flattenScene(): TreeItem[] {
  const m = getManifest();
  const out: TreeItem[] = [];
  const walk = (id: string, depth: number, parentId: string | null) => {
    const n = m.sceneNodes[id];
    if (!n) return;
    const matId = typeof n.props?.materialId === 'string' ? n.props.materialId : undefined;
    out.push({
      id,
      label: n.label,
      icon: SCENE_ICON[n.type] ?? Icons.container,
      depth,
      hidden: !n.visible,
      locked: n.locked,
      droppable: n.type === 'group',
      hasChildren: n.children && n.children.length > 0,
      parentId,
      materialId: matId,
      nodeKind: 'scene',
    });
    n.children?.forEach((c) => walk(c, depth + 1, id));
  };
  m.sceneRootOrder.forEach((id) => walk(id, 0, null));
  return out;
}

export interface SceneTreePanelProps {
  search: string;
}

export function MaterialSceneTree({ search }: SceneTreePanelProps) {
  const selScene = useUIState((s) => s.selectedSceneNodeId);
  const selSceneIds = useUIState((s) => s.selectedSceneNodeIds);
  const m = getManifest();
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; targetId: string | null } | null>(null);

  return (
    <>
      <Tree
        items={flattenScene()}
        selectedId={selScene}
        selectedIds={selSceneIds}
        onSelect={(id, e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey)
            toggleSceneSelection(id);
          else {
            setUIState({ selectedSceneNodeId: id });
            const node = m.sceneNodes[id];
            if (node?.props?.materialId) {
              setUIState({ selectedMaterialId: String(node.props.materialId) });
            }
          }
        }}
        onToggleHidden={(id) =>
          dispatch({
            type: 'set',
            path: `sceneNodes.${id}.visible`,
            value: !m.sceneNodes[id].visible,
          })
        }
        onToggleLocked={(id) =>
          dispatch({
            type: 'set',
            path: `sceneNodes.${id}.locked`,
            value: !m.sceneNodes[id].locked,
          })
        }
        onRename={(id, label) =>
          dispatch({ type: 'set', path: `sceneNodes.${id}.label`, value: label })
        }
        onDuplicate={(id) => {
          const newId = duplicateSceneNode(id);
          if (newId) setUIState({ selectedSceneNodeId: newId });
        }}
        onDelete={(id) => {
          if (removeSceneNode(id)) {
            if (selScene === id) setUIState({ selectedSceneNodeId: null });
            toast('Scene node deleted — Ctrl+Z restores the subtree');
          } else {
            toast('The active camera cannot be deleted — every scene keeps one');
          }
        }}
        onDropInto={(dragId, targetId) => {
          moveSceneNode(dragId, targetId);
          setUIState({ selectedSceneNodeId: dragId });
        }}
        onReorder={(dragId, targetId, edge) => {
          if (moveSceneNodeBeside(dragId, targetId, edge)) {
            setUIState({ selectedSceneNodeId: dragId });
          }
        }}
        filter={search}
        onContextMenu={(id, x, y) => {
          setCtxMenu({ x, y, targetId: id });
        }}
      />
      {ctxMenu && (
        <Scene3DContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          targetId={ctxMenu.targetId}
          onClose={() => setCtxMenu(null)}
        />
      )}
      <button
        type="button"
        className="lp-add-group-row"
        onClick={() => {
          const id = newNodeId('grp');
          addSceneNode(
            { id, label: 'New Group', type: 'group', visible: true, locked: false,
              children: [], props: {}, transform: {
                position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
              } },
            null,
          );
          setUIState({ selectedSceneNodeId: id });
          toast('Group added — drag meshes into it');
        }}
      >
        {Icons.plus ?? <span>+</span>}
        New Group
      </button>
    </>
  );
}
