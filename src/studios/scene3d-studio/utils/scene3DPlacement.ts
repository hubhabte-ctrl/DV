/**
 * Drag-drop placement into the 3D viewport (Phase 2.4   " audit S-7/M-5,
 * 06 AssetPipeline). Routes drops by payload:
 *  - GLB/GLTF asset or OS file   ' full hierarchy extraction (Phase 1.1) with
 *    the imported root positioned at the raycast hit point;
 *  - texture asset onto a mesh   ' assigns the material's base color map;
 *  - material card onto a mesh   ' assigns the shared material record (Part 4).
 * All writes go through the command engine (IL-1).
 */
import {
  addAsset,
  addSceneNode,
  dispatch,
  getManifest,
  newNodeId,
  registerImportedScene,
  setMaterialMap,
  type AssetRecord,
  type SceneNode,
} from '@bs/engine';
import { isGltfFile } from '../../../engine/assetIngest';
import { saveAssetBlob } from '../../../engine/storage';
import { setUIState } from '@bs/engine';
import { extractGlbScene } from '../../../viewport/importGLB';
import { toast } from '../../../app/ui/Toast';

/** Extract a GLB asset into the scene with its root at `point` (S-7).
 *  OBJ/FBX/STL (Phase 3   " audit S-6) place as a single mesh node   " those
 *  formats load whole-object via the runtime's extension-routed loaders. */
export function placeGlbAssetInScene(assetId: string, point: [number, number, number]): void {
  const asset = getManifest().assets.find((a) => a.id === assetId);
  if (!asset) return;
  if (!asset.url) {
    toast(`${asset.name} has no content   " re-import the file (broken-asset law)`);
    return;
  }
  if (!isGltfFile(asset.name)) {
    const node: SceneNode = {
      id: newNodeId('mesh'),
      label: asset.name.replace(/\.(obj|fbx|stl)$/i, ''),
      type: 'mesh',
      visible: true,
      locked: false,
      children: [],
      transform: { position: [point[0], 0, point[2]], rotation: [0, 0, 0], scale: [1, 1, 1] },
      props: { assetId: asset.id, castShadow: true, receiveShadow: true },
    };
    addSceneNode(node, null);
    setUIState({ selectedSceneNodeId: node.id });
    toast(`${asset.name} placed (single-object import   " GLB/GLTF extracts full hierarchies)`);
    return;
  }
  extractGlbScene(asset.url, asset.id, asset.name.replace(/\.(glb|gltf)$/i, ''))
    .then(({ nodes, rootId, materials, stats }) => {
      const root = nodes.find((n) => n.id === rootId);
      if (root) {
        // keep the ground-rest Y from normalization; land X/Z at the hit point
        root.transform.position[0] += point[0];
        root.transform.position[2] += point[2];
      }
      registerImportedScene(nodes, rootId, materials);
      setUIState({ selectedSceneNodeId: rootId });
      toast(`${asset.name} placed   " ${stats.meshes} meshes, ${materials.length} materials extracted`);
    })
    .catch((err) => {
      console.error('[viewport-drop] GLB extraction failed', err);
      toast(`${asset.name}: extraction failed   " see console`);
    });
}

/** OS file dropped straight onto the 3D viewport: register + extract at point. */
export function placeGlbFileInScene(file: File, point: [number, number, number]): void {
  const url = URL.createObjectURL(file);
  const asset: AssetRecord = {
    id: newNodeId('asset'),
    name: file.name,
    category: '3D Models',
    version: 1,
    stats: `${Math.max(1, Math.round(file.size / 1024))} KB`,
    usedBy: 0,
    url,
    mime: file.type || undefined,
    size: file.size,
    createdAt: new Date().toISOString(),
    tags: [],
  };
  saveAssetBlob(asset.id, file); // survives reload (Phase 0.2)
  addAsset(asset);
  placeGlbAssetInScene(asset.id, point);
}

/** Texture asset dropped onto a mesh: assign the base color map (M-5/M-1). */
export function assignTextureToMesh(assetId: string, meshNodeId: string): void {
  const m = getManifest();
  const node = m.sceneNodes[meshNodeId];
  const asset = m.assets.find((a) => a.id === assetId);
  if (!node || node.type !== 'mesh' || !asset) {
    toast('Drop textures onto a mesh to assign its base color map');
    return;
  }
  const materialId = String(node.props?.materialId ?? '');
  if (!materialId || !m.materials[materialId]) {
    toast(`${node.label} has no material record   " assign one in the inspector first`);
    return;
  }
  setMaterialMap(materialId, 'map', asset.id);
  toast(`${asset.name}   ' base map of '${m.materials[materialId].name}' (updates every linked mesh)`);
}

/** Material card dropped onto a mesh: shared-record assignment (Part 4). */
export function assignMaterialToMesh(materialId: string, meshNodeId: string): void {
  const m = getManifest();
  const node = m.sceneNodes[meshNodeId];
  const mat = m.materials[materialId];
  if (!node || node.type !== 'mesh' || !mat) {
    toast('Drop materials onto a mesh in the viewport to assign them');
    return;
  }
  dispatch({ type: 'set', path: `sceneNodes.${meshNodeId}.props.materialId`, value: materialId });
  toast(`'${mat.name}' assigned to ${node.label}   " edits propagate to every linked mesh`);
}
