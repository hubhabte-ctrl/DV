/**
 * DOMViewport canvas drop & layout operations helper functions (WS2-3b).
 * Pure move from DOMViewport.tsx (IL-11 behavior-identical).
 */
import {
  addAsset,
  addDomNode,
  defaultScene3dSettings,
  dispatchBatch,
  getManifest,
  newNodeId,
  resolveStyle,
  type AssetRecord,
  type Command,
  type DomNode,
} from '@bs/engine';
import { getUIState, setUIState, type DeviceProfile } from '@bs/engine';
import { saveAssetBlob } from './storage';
import { isGltfFile } from './assetIngest';
import { Icons } from '../app/ui/Icons';
import { toast } from '../app/ui/Toast';
import { domEls, sectionRootAtPoint, sectionRootIdOf, stylePath } from './domTypes';

export function addScene3dNode(
  assetId: string | undefined,
  label: string,
  clientX: number,
  clientY: number,
): void {
  const rootId = sectionRootAtPoint(clientY);
  const sectionEl = rootId ? domEls.get(rootId) : null;
  if (!rootId || !sectionEl) {
    toast('Add a section first   " sections are the scroll panels of the page');
    return;
  }
  const zoom = getUIState().canvasZoom;
  const sr = sectionEl.getBoundingClientRect();
  const w = 420;
  const h = 300;
  const node: DomNode = {
    id: newNodeId('scene3d'),
    type: 'scene3d',
    tag: 'div',
    label: `3D  * ${label}`,
    children: [],
    style: {
      position: 'absolute',
      left: Math.max(0, Math.round((clientX - sr.left) / zoom - w / 2)),
      top: Math.max(0, Math.round((clientY - sr.top) / zoom - h / 2)),
      width: w,
      height: h,
      zIndex: 2,
      borderRadius: 12,
    },
    overrides: {},
    assetId,
    // independent instance settings (issues.md): reusing the same asset never
    // shares transform/camera/lighting/scroll settings between instances
    scene: defaultScene3dSettings(),
  };
  addDomNode(rootId, node, getManifest().domNodes[rootId].children.length);
  setUIState({ selectedDomNodeId: node.id });
}

/** Place an image/video node rendering the asset's ACTUAL content (Phase 1.4). */
export function placeMediaNode(asset: AssetRecord, clientX: number, clientY: number): void {
  const rootId = sectionRootAtPoint(clientY);
  const sectionEl = rootId ? domEls.get(rootId) : null;
  if (!rootId || !sectionEl) {
    toast('Add a section first   " sections are the scroll panels of the page');
    return;
  }
  const zoom = getUIState().canvasZoom;
  const sr = sectionEl.getBoundingClientRect();
  const isVideo = asset.category === 'Videos';
  const w = isVideo ? 480 : 320;
  const h = isVideo ? 270 : 220;
  const node: DomNode = {
    id: newNodeId(isVideo ? 'video' : 'image'),
    type: isVideo ? 'video' : 'image',
    tag: 'div',
    label: `${isVideo ? 'Video' : 'Image'}  * ${asset.name}`,
    children: [],
    style: {
      position: 'absolute',
      left: Math.max(0, Math.round((clientX - sr.left) / zoom - w / 2)),
      top: Math.max(0, Math.round((clientY - sr.top) / zoom - h / 2)),
      width: w,
      height: h,
      zIndex: 2,
      borderRadius: 8,
    },
    overrides: {},
    assetId: asset.id,
  };
  addDomNode(rootId, node, getManifest().domNodes[rootId].children.length);
  setUIState({ selectedDomNodeId: node.id });
}

/** OS file drop: GLB   ' versioned asset record + embedded 3D element in one gesture. */
export function importGlbToCanvas(file: File, clientX: number, clientY: number): void {
  const url = URL.createObjectURL(file);
  const asset: AssetRecord = {
    id: newNodeId('asset'),
    name: file.name,
    category: '3D Models',
    version: 1,
    stats: `${Math.max(1, Math.round(file.size / 1024))} KB  * imported`,
    usedBy: 0,
    url,
  };
  saveAssetBlob(asset.id, file); // survives reload (Phase 0.2)
  addAsset(asset);
  addScene3dNode(asset.id, file.name.replace(/\.(glb|gltf)$/i, ''), clientX, clientY);
  toast(`${file.name}   " 3D scene embedded in the page (gridless, scroll-animated)`);
}

/** Asset-panel drop: models embed as 3D elements; media assets place as nodes
 *  rendering their real content (Phase 1.4   " audit AS-7 fixed). */
export function dropAssetOnCanvas(assetId: string, clientX: number, clientY: number): void {
  const asset = getManifest().assets.find((a) => a.id === assetId);
  if (!asset) return;
  if (asset.category === '3D Models') {
    if (!isGltfFile(asset.name)) {
      toast(`${asset.name}: drop it into the 3D studio viewport   " page embeds support GLB/GLTF`);
      return;
    }
    addScene3dNode(asset.id, asset.name.replace(/\.(glb|gltf)$/i, ''), clientX, clientY);
    toast(`${asset.name} embedded as a 3D element`);
    return;
  }
  if (asset.category === 'Images' || asset.category === 'SVG' || asset.category === 'Videos') {
    placeMediaNode(asset, clientX, clientY);
    toast(`${asset.name} placed on the canvas`);
    return;
  }
  toast(`${asset.name}: use it from the inspector (e.g. material texture slots)`);
}

export type AlignOp = 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom' | 'distH' | 'distV';

export function alignSelection(op: AlignOp, profile: DeviceProfile): void {
  const zoom = getUIState().canvasZoom;
  const m = getManifest();
  const items = getUIState()
    .selectedDomNodeIds.filter((id) => {
      const n = m.domNodes[id];
      return n && !n.locked && !n.hidden && !m.domRootOrder.includes(id) && domEls.has(id);
    })
    .map((id) => {
      const el = domEls.get(id)!;
      const sec = domEls.get(sectionRootIdOf(id))!;
      return { id, node: m.domNodes[id], r: el.getBoundingClientRect(), sr: sec.getBoundingClientRect() };
    });
  if (items.length < 2) return;
  const union = {
    left: Math.min(...items.map((i) => i.r.left)),
    right: Math.max(...items.map((i) => i.r.right)),
    top: Math.min(...items.map((i) => i.r.top)),
    bottom: Math.max(...items.map((i) => i.r.bottom)),
  };
  const cmds: Command[] = [];
  for (const it of items) {
    if (resolveStyle(it.node, profile).position !== 'absolute') {
      cmds.push(
        { type: 'set', path: stylePath(it.id, profile, 'position'), value: 'absolute' },
        {
          type: 'set',
          path: stylePath(it.id, profile, 'left'),
          value: Math.round((it.r.left - it.sr.left) / zoom),
        },
        {
          type: 'set',
          path: stylePath(it.id, profile, 'top'),
          value: Math.round((it.r.top - it.sr.top) / zoom),
        },
        { type: 'set', path: stylePath(it.id, profile, 'width'), value: Math.round(it.r.width / zoom) },
      );
    }
  }
  type Item = (typeof items)[number];
  const setLeft = (it: Item, screenX: number) =>
    cmds.push({
      type: 'set',
      path: stylePath(it.id, profile, 'left'),
      value: Math.round((screenX - it.sr.left) / zoom),
    });
  const setTop = (it: Item, screenY: number) =>
    cmds.push({
      type: 'set',
      path: stylePath(it.id, profile, 'top'),
      value: Math.round((screenY - it.sr.top) / zoom),
    });

  if (op === 'left') items.forEach((it) => setLeft(it, union.left));
  else if (op === 'right') items.forEach((it) => setLeft(it, union.right - it.r.width));
  else if (op === 'centerH') {
    const cx = (union.left + union.right) / 2;
    items.forEach((it) => setLeft(it, cx - it.r.width / 2));
  } else if (op === 'top') items.forEach((it) => setTop(it, union.top));
  else if (op === 'bottom') items.forEach((it) => setTop(it, union.bottom - it.r.height));
  else if (op === 'centerV') {
    const cy = (union.top + union.bottom) / 2;
    items.forEach((it) => setTop(it, cy - it.r.height / 2));
  } else if (op === 'distH') {
    const sorted = [...items].sort((a, b) => a.r.left - b.r.left);
    const totalW = sorted.reduce((s, i) => s + i.r.width, 0);
    const gap = (union.right - union.left - totalW) / (sorted.length - 1);
    let cursor = union.left;
    for (const it of sorted) {
      setLeft(it, cursor);
      cursor += it.r.width + gap;
    }
  } else if (op === 'distV') {
    const sorted = [...items].sort((a, b) => a.r.top - b.r.top);
    const totalH = sorted.reduce((s, i) => s + i.r.height, 0);
    const gap = (union.bottom - union.top - totalH) / (sorted.length - 1);
    let cursor = union.top;
    for (const it of sorted) {
      setTop(it, cursor);
      cursor += it.r.height + gap;
    }
  }
  dispatchBatch(cmds);
  toast('Selection aligned   " Ctrl+Z reverts in one step');
}

export const ALIGN_BUTTONS: { op: AlignOp; title: string; icon: React.ReactNode }[] = [
  { op: 'left', title: 'Align left', icon: Icons.alignLeft },
  { op: 'centerH', title: 'Align horizontal centers', icon: Icons.alignCenterH },
  { op: 'right', title: 'Align right', icon: Icons.alignRight },
  { op: 'top', title: 'Align top', icon: Icons.alignTop },
  { op: 'centerV', title: 'Align vertical centers', icon: Icons.alignCenterV },
  { op: 'bottom', title: 'Align bottom', icon: Icons.alignBottom },
  { op: 'distH', title: 'Distribute horizontally', icon: Icons.distributeH },
  { op: 'distV', title: 'Distribute vertically', icon: Icons.distributeV },
];
