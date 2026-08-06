import { getManifest } from '@bs/engine';
import { isGltfFile } from '../../../../engine/assetIngest';
import { Scene3DToolbar } from '../toolbar/Scene3DToolbar';
import { MIME_ASSET, MIME_MATERIAL } from '../../utils/dnd';
import {
  assignMaterialToMesh,
  assignTextureToMesh,
  placeGlbAssetInScene,
  placeGlbFileInScene,
} from '../../utils/scene3DPlacement';
import { toast } from '../../../../app/ui/Toast';
import { Scene3DContextMenu } from '../common/Scene3DContextMenu';
import { Platform3DCanvas } from '../../../../app/ui/components/Platform3DCanvas';
import { useState } from 'react';
import type { ViewportHandle } from '../../../../viewport/runtime';
import { setUIState } from '@bs/engine';

export function Scene3DViewport({
  navigation,
  chrome = true,
}: {
  navigation: 'editor' | 'track';
  chrome?: boolean;
}) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; targetId: string | null } | null>(null);

  const onDragOver = (e: React.DragEvent) => {
    if (navigation !== 'editor') return;
    if (
      e.dataTransfer.types.includes(MIME_ASSET) ||
      e.dataTransfer.types.includes(MIME_MATERIAL) ||
      e.dataTransfer.types.includes('Files')
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const onDrop = (e: React.DragEvent, handle: ViewportHandle) => {
    if (navigation !== 'editor') return;
    const pick = handle.pickAt(e.clientX, e.clientY);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) {
      e.preventDefault();
      let placed = 0;
      for (const file of files) {
        if (isGltfFile(file.name)) {
          placeGlbFileInScene(file, [pick.point[0] + placed * 0.4, pick.point[1], pick.point[2]]);
          placed++;
        }
      }
      if (placed === 0)
        toast('Drop GLB/GLTF files here - other types import via the Asset Studio', 'info', 'Invalid Drop');
      return;
    }
    const materialId = e.dataTransfer.getData(MIME_MATERIAL);
    if (materialId) {
      e.preventDefault();
      if (pick.nodeId) assignMaterialToMesh(materialId, pick.nodeId);
      else toast('Drop the material onto a mesh to assign it', 'info', 'Assign Material');
      return;
    }
    const assetId = e.dataTransfer.getData(MIME_ASSET);
    if (assetId) {
      e.preventDefault();
      const asset = getManifest().assets.find((a) => a.id === assetId);
      if (!asset) return;
      if (asset.category === '3D Models') {
        placeGlbAssetInScene(assetId, pick.point);
      } else if (asset.category === 'Images' || asset.category === 'Textures') {
        if (pick.nodeId) assignTextureToMesh(assetId, pick.nodeId);
        else toast('Drop textures onto a mesh to assign its base map', 'info', 'Assign Texture');
      } else {
        toast(
          `${asset.name}: this asset type is used from the DOM canvas or inspector`,
          'info',
          'Asset Note',
        );
      }
    }
  };

  const onContextMenu = (e: React.MouseEvent, handle: ViewportHandle) => {
    e.preventDefault();
    if (navigation !== 'editor' || !chrome) return;
    let hitId: string | null = null;
    const pick = handle.pickAt(e.clientX, e.clientY);
    hitId = pick.nodeId ?? null;
    if (hitId) {
      setUIState({ selectedSceneNodeId: hitId });
    }
    setCtxMenu({ x: e.clientX, y: e.clientY, targetId: hitId });
  };

  return (
    <Platform3DCanvas
      navigation={navigation}
      chrome={chrome}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onContextMenu={onContextMenu}
    >
      {navigation === 'editor' && chrome && <Scene3DToolbar />}
      {ctxMenu && (
        <Scene3DContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          targetId={ctxMenu.targetId}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </Platform3DCanvas>
  );
}
