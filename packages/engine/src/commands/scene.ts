/**
 * 3D Scene-domain commands (WS2-3c — pure move from commands.ts, IL-11 behavior-identical).
 * Covers: scene node CRUD, TRS math, grouping/ungrouping, camera, sibling
 * reorder, environment, imported scene registration.
 * Spec refs: FR-130..133, 02 ObjectHierarchy, 02 TransformSystem, 02 CameraSystem,
 * 02 EnvironmentSystem, Doc 05 §5, Doc 13 Part 4.
 */
import {
  dispatch,
  dispatchBatch,
  getManifest,
  newNodeId,
  type Command,
} from './bus';
import type { EnvironmentSettings, Material, SceneNode } from './types';

/* ---------------- Environment (Phase 2.3 — 02 EnvironmentSystem, S-4/M-3) ---------------- */

export function setEnvironmentProp(
  prop: keyof EnvironmentSettings,
  value: string | number | undefined,
  coalesce = false,
): void {
  const path = `environment.${prop}`;
  dispatch({ type: 'set', path, value, coalesceKey: coalesce ? path : undefined });
}

/* ---------------- Structural 3D scene operations (FR-130..133, 02 ObjectHierarchy) ---------------- */

/** Parent lookup in the scene graph — roots have no parent. */
export function findSceneParent(nodeId: string): string | null {
  const m = getManifest();
  for (const [id, n] of Object.entries(m.sceneNodes)) {
    if (n && n.children && n.children.includes(nodeId)) return id;
  }
  return null;
}

/** Insert a scene node (root when parentId is null) — one transaction. */
export function addSceneNode(node: SceneNode, parentId: string | null, index?: number): void {
  const m = getManifest();
  const cmds: Command[] = [{ type: 'set', path: `sceneNodes.${node.id}`, value: node }];
  if (parentId && m.sceneNodes[parentId]) {
    const children = [...(m.sceneNodes[parentId].children ?? [])];
    children.splice(index ?? children.length, 0, node.id);
    cmds.push({ type: 'set', path: `sceneNodes.${parentId}.children`, value: children });
  } else {
    const order = [...(m.sceneRootOrder ?? [])];
    order.splice(index ?? order.length, 0, node.id);
    cmds.push({ type: 'set', path: 'sceneRootOrder', value: order });
  }
  dispatchBatch(cmds);
}

/** Delete a scene subtree. The active camera is protected — every scene keeps
 *  exactly one active camera (Doc 13 Part 4 3D law). */
export function removeSceneNode(nodeId: string): boolean {
  const m = getManifest();
  const containsActiveCamera = (id: string): boolean => {
    const n = m.sceneNodes[id];
    if (!n) return false;
    if (n.type === 'camera' && n.props?.active) return true;
    return (n.children ?? []).some(containsActiveCamera);
  };
  if (containsActiveCamera(nodeId)) return false;
  const parentId = findSceneParent(nodeId);
  const cmds: Command[] = [];
  if (parentId && m.sceneNodes[parentId]) {
    cmds.push({
      type: 'set',
      path: `sceneNodes.${parentId}.children`,
      value: (m.sceneNodes[parentId].children ?? []).filter((c) => c !== nodeId),
    });
  } else {
    cmds.push({
      type: 'set',
      path: 'sceneRootOrder',
      value: (m.sceneRootOrder ?? []).filter((c) => c !== nodeId),
    });
  }
  const collect = (id: string) => {
    const node = m.sceneNodes[id];
    if (node) (node.children ?? []).forEach(collect);
    cmds.push({ type: 'set', path: `sceneNodes.${id}`, value: undefined });
  };
  collect(nodeId);
  dispatchBatch(cmds);
  return true;
}

/** Deep-clone a scene subtree with fresh ids; a duplicated camera is never active. */
export function duplicateSceneNode(nodeId: string): string | null {
  const m = getManifest();
  const cmds: Command[] = [];
  const clone = (id: string): string => {
    const src = m.sceneNodes[id];
    const copy: SceneNode = { ...structuredClone(src), id: newNodeId(src.type) };
    copy.label = id === nodeId ? `${src.label} copy` : src.label;
    if (copy.type === 'camera' && copy.props) copy.props = { ...copy.props, active: false };
    copy.children = src.children.map(clone);
    cmds.push({ type: 'set', path: `sceneNodes.${copy.id}`, value: copy });
    return copy.id;
  };
  const newId = clone(nodeId);
  const parentId = findSceneParent(nodeId);
  if (parentId) {
    const children = [...m.sceneNodes[parentId].children];
    children.splice(children.indexOf(nodeId) + 1, 0, newId);
    cmds.push({ type: 'set', path: `sceneNodes.${parentId}.children`, value: children });
  } else {
    const order = [...m.sceneRootOrder];
    order.splice(order.indexOf(nodeId) + 1, 0, newId);
    cmds.push({ type: 'set', path: 'sceneRootOrder', value: order });
  }
  dispatchBatch(cmds);
  return newId;
}

/** Reparent a scene node (tree drag-and-drop). Cycle-safe; node identity
 *  survives reparent (Doc 13 Part 4 3D law). */
export function moveSceneNode(nodeId: string, targetParentId: string): void {
  const m = getManifest();
  if (nodeId === targetParentId) return;
  let probe: string | null = targetParentId;
  while (probe) {
    if (probe === nodeId) return; // dropping into own subtree is invalid
    probe = findSceneParent(probe);
  }
  const fromId = findSceneParent(nodeId);
  if (fromId === targetParentId) return;
  const cmds: Command[] = [];
  if (fromId) {
    cmds.push({
      type: 'set',
      path: `sceneNodes.${fromId}.children`,
      value: m.sceneNodes[fromId].children.filter((c) => c !== nodeId),
    });
  } else {
    cmds.push({
      type: 'set',
      path: 'sceneRootOrder',
      value: m.sceneRootOrder.filter((c) => c !== nodeId),
    });
  }
  cmds.push({
    type: 'set',
    path: `sceneNodes.${targetParentId}.children`,
    value: [...m.sceneNodes[targetParentId].children, nodeId],
  });
  dispatchBatch(cmds);
}

/** Wrap a node in a new group occupying its slot (Ctrl+G). Node identity
 *  survives reparent (Doc 13 Part 4 3D law); the child keeps its local transform. */
export function groupSceneNode(nodeId: string): string | null {
  const m = getManifest();
  const node = m.sceneNodes[nodeId];
  if (!node) return null;
  const group: SceneNode = {
    id: newNodeId('group'),
    label: `${node.label} Group`,
    type: 'group',
    visible: true,
    locked: false,
    children: [nodeId],
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  };
  const parentId = findSceneParent(nodeId);
  const cmds: Command[] = [{ type: 'set', path: `sceneNodes.${group.id}`, value: group }];
  if (parentId) {
    cmds.push({
      type: 'set',
      path: `sceneNodes.${parentId}.children`,
      value: m.sceneNodes[parentId].children.map((c) => (c === nodeId ? group.id : c)),
    });
  } else {
    cmds.push({
      type: 'set',
      path: 'sceneRootOrder',
      value: m.sceneRootOrder.map((c) => (c === nodeId ? group.id : c)),
    });
  }
  dispatchBatch(cmds);
  return group.id;
}

/* ── minimal TRS math (Phase 3 — audit S-9). Pure, dependency-free: the engine
   layer must not import three.js (Doc 04 §8 layering). XYZ Euler order matches
   the THREE.js default used by the runtime. ── */
type Quat = [number, number, number, number]; // x, y, z, w

export function quatFromEuler(e: number[]): Quat {
  const cx = Math.cos(e[0] / 2),
    sx = Math.sin(e[0] / 2);
  const cy = Math.cos(e[1] / 2),
    sy = Math.sin(e[1] / 2);
  const cz = Math.cos(e[2] / 2),
    sz = Math.sin(e[2] / 2);
  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz,
  ];
}

export function quatMultiply(a: Quat, b: Quat): Quat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

export function eulerFromQuat(q: Quat): number[] {
  const [x, y, z, w] = q;
  const m11 = 1 - 2 * (y * y + z * z),
    m12 = 2 * (x * y - z * w),
    m13 = 2 * (x * z + y * w);
  const m22 = 1 - 2 * (x * x + z * z),
    m23 = 2 * (y * z - x * w);
  const m32 = 2 * (y * z + x * w),
    m33 = 1 - 2 * (x * x + y * y);
  const ey = Math.asin(Math.max(-1, Math.min(1, m13)));
  if (Math.abs(m13) < 0.9999999) {
    return [Math.atan2(-m23, m33), ey, Math.atan2(-m12, m11)];
  }
  return [Math.atan2(m32, m22), ey, 0];
}

export function rotateVecByQuat(q: Quat, v: number[]): number[] {
  const [qx, qy, qz, qw] = q;
  const tx = 2 * (qy * v[2] - qz * v[1]);
  const ty = 2 * (qz * v[0] - qx * v[2]);
  const tz = 2 * (qx * v[1] - qy * v[0]);
  return [
    v[0] + qw * tx + (qy * tz - qz * ty),
    v[1] + qw * ty + (qz * tx - qx * tz),
    v[2] + qw * tz + (qx * ty - qy * tx),
  ];
}

/** Dissolve a group: children hoist into its slot with FULL transform
 *  re-composition (Phase 3 — audit S-9, 02 TransformSystem): position rotates
 *  and scales through the group's frame; rotations compose as quaternions;
 *  scales multiply component-wise (exact for uniform group scales — shear from
 *  non-uniform-scale-under-rotation is not representable in TRS and is dropped,
 *  matching every TRS-based DCC). Nothing jumps on ungroup. */
export function ungroupSceneNode(groupId: string): boolean {
  const m = getManifest();
  const group = m.sceneNodes[groupId];
  if (!group || group.type !== 'group') return false;
  const parentId = findSceneParent(groupId);
  const cmds: Command[] = [];
  const gq = quatFromEuler(group.transform.rotation);
  const gs = group.transform.scale;
  const gp = group.transform.position;
  for (const childId of group.children) {
    const child = m.sceneNodes[childId];
    const scaled = child.transform.position.map((v, i) => v * gs[i]);
    const rotated = rotateVecByQuat(gq, scaled);
    cmds.push(
      {
        type: 'set',
        path: `sceneNodes.${childId}.transform.position`,
        value: rotated.map((v, i) => Number((v + gp[i]).toFixed(6))),
      },
      {
        type: 'set',
        path: `sceneNodes.${childId}.transform.rotation`,
        value: eulerFromQuat(quatMultiply(gq, quatFromEuler(child.transform.rotation))).map((v) =>
          Number(v.toFixed(6)),
        ),
      },
      {
        type: 'set',
        path: `sceneNodes.${childId}.transform.scale`,
        value: child.transform.scale.map((v, i) => Number((v * gs[i]).toFixed(6))),
      },
    );
  }
  if (parentId) {
    const children = [...m.sceneNodes[parentId].children];
    children.splice(children.indexOf(groupId), 1, ...group.children);
    cmds.push({ type: 'set', path: `sceneNodes.${parentId}.children`, value: children });
  } else {
    const order = [...m.sceneRootOrder];
    order.splice(order.indexOf(groupId), 1, ...group.children);
    cmds.push({ type: 'set', path: 'sceneRootOrder', value: order });
  }
  cmds.push({ type: 'set', path: `sceneNodes.${groupId}`, value: undefined });
  dispatchBatch(cmds);
  return true;
}

/* ---------------- Active camera switch (Phase 3 — audit S-10, 02 CameraSystem) ---------------- */

/** Flip the active camera: exactly one camera is active at all times (Part 4
 *  3D law) — clearing the others and setting the target is ONE transaction. */
export function setActiveCamera(nodeId: string): boolean {
  const m = getManifest();
  const target = m.sceneNodes[nodeId];
  if (!target || target.type !== 'camera') return false;
  const cmds: Command[] = [];
  for (const n of Object.values(m.sceneNodes)) {
    if (n.type !== 'camera') continue;
    const shouldBeActive = n.id === nodeId;
    if (Boolean(n.props?.active) !== shouldBeActive) {
      cmds.push({ type: 'set', path: `sceneNodes.${n.id}.props.active`, value: shouldBeActive });
    }
  }
  if (cmds.length) dispatchBatch(cmds);
  return true;
}

/* ---------------- Sibling reorder (Phase 3 — 01 LayerSystem §search/order) ---------------- */

export function moveSceneNodeBeside(dragId: string, targetId: string, edge: 'before' | 'after'): boolean {
  if (dragId === targetId) return false;
  const m = getManifest();
  // cycle-safety: never drop a node beside its own descendant
  let probe: string | null = targetId;
  while (probe) {
    if (probe === dragId) return false;
    probe = findSceneParent(probe);
  }
  const targetParent = findSceneParent(targetId);
  const fromParent = findSceneParent(dragId);
  const cmds: Command[] = [];
  // detach
  if (fromParent) {
    cmds.push({
      type: 'set',
      path: `sceneNodes.${fromParent}.children`,
      value: m.sceneNodes[fromParent].children.filter((c) => c !== dragId),
    });
  } else {
    cmds.push({
      type: 'set',
      path: 'sceneRootOrder',
      value: m.sceneRootOrder.filter((c) => c !== dragId),
    });
  }
  // insert beside the target (list computed AFTER the detach for same-parent moves)
  const base = targetParent ? m.sceneNodes[targetParent].children : m.sceneRootOrder;
  const list = base.filter((c) => c !== dragId);
  const at = list.indexOf(targetId) + (edge === 'after' ? 1 : 0);
  list.splice(Math.max(0, at), 0, dragId);
  cmds.push(
    targetParent
      ? { type: 'set', path: `sceneNodes.${targetParent}.children`, value: list }
      : { type: 'set', path: 'sceneRootOrder', value: list },
  );
  dispatchBatch(cmds);
  return true;
}

/* ---------------- Imported scene registration (FR-130..133, audit S-1/S-2) ---------------- */

/** Register a full extracted GLB hierarchy — nodes, materials, and the root —
 *  as ONE transaction (one undo step removes the entire import). */
export function registerImportedScene(nodes: SceneNode[], rootId: string, materials: Material[]): void {
  const m = getManifest();
  const cmds: Command[] = [];
  for (const mat of materials) cmds.push({ type: 'set', path: `materials.${mat.id}`, value: mat });
  for (const n of nodes) cmds.push({ type: 'set', path: `sceneNodes.${n.id}`, value: n });
  cmds.push({ type: 'set', path: 'sceneRootOrder', value: [...m.sceneRootOrder, rootId] });
  dispatchBatch(cmds);
}
