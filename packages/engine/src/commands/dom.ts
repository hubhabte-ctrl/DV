/**
 * DOM-domain commands (WS2-3c — pure move from commands.ts, IL-11 behavior-identical).
 * Covers: style/overrides, DOM node CRUD, sections, scene stage, scene3d embeds,
 * waypoints, component system, design tokens, DOM sibling reorder.
 * Spec refs: FR-120, FR-122, FR-160/161, Doc 05 §3/§4/§6, 01 ComponentSystem,
 * 01 DesignTokens, issues.md (stage + scene3d Inspector).
 */
import type { DeviceProfile } from '../store';
import {
  dispatch,
  dispatchBatch,
  getManifest,
  newNodeId,
  type Command,
} from './bus';
import type {
  ComponentDef,
  ComponentTemplateNode,
  DesignToken,
  DomNode,
  Scene3dSettings,
  SceneStage,
  StyleBlock,
  Waypoint,
} from './types';
import { scene3dSettingsOf } from './types';

/* ---------------- Responsive resolution (FR-122) ---------------- */

/** Base ⊕ sparse patch resolution for the active profile. */
export function resolveStyle(node: DomNode, profile: DeviceProfile): StyleBlock {
  if (profile === 'desktop') return node.style;
  return { ...node.style, ...(node.overrides[profile] ?? {}) };
}

/** True when the property carries an override patch for the profile (override dot, Doc 05 §4). */
export function hasOverride(node: DomNode, profile: DeviceProfile, prop: string): boolean {
  if (profile === 'desktop') return false;
  return node.overrides[profile]?.[prop] !== undefined;
}

/** Write a style value — base write on desktop, sparse patch otherwise (Doc 05 §4 step 2). */
export function setStyleValue(
  nodeId: string,
  profile: DeviceProfile,
  prop: string,
  value: string | number,
  coalesce = false,
): void {
  const path =
    profile === 'desktop'
      ? `domNodes.${nodeId}.style.${prop}`
      : `domNodes.${nodeId}.overrides.${profile}.${prop}`;
  dispatch({ type: 'set', path, value, coalesceKey: coalesce ? path : undefined });
}

/** Clear an override patch — Doc 05 §4 step 3 ("click dot to reset"). */
export function clearOverride(nodeId: string, profile: DeviceProfile, prop: string): void {
  dispatch({ type: 'set', path: `domNodes.${nodeId}.overrides.${profile}.${prop}`, value: undefined });
}

/* ---------------- Structural DOM operations (FR-120, Doc 05 §3) ---------------- */

/** Parent lookup — roots have no parent. */
export function findDomParent(nodeId: string): string | null {
  const m = getManifest();
  for (const [id, n] of Object.entries(m.domNodes)) {
    if (n.children.includes(nodeId)) return id;
  }
  return null;
}

/** Insert a new node under a parent at index — one transaction, one undo step. */
export function addDomNode(parentId: string, node: DomNode, index: number): void {
  const m = getManifest();
  const parent = m.domNodes[parentId];
  const children = [...parent.children];
  children.splice(Math.max(0, Math.min(index, children.length)), 0, node.id);
  dispatchBatch([
    { type: 'set', path: `domNodes.${node.id}`, value: node },
    { type: 'set', path: `domNodes.${parentId}.children`, value: children },
  ]);
}

/** Move/reorder a node within or across parents (drag-and-drop, Doc 05 §3). */
export function moveDomNode(nodeId: string, targetParentId: string, index: number): void {
  const m = getManifest();
  const fromId = findDomParent(nodeId);
  if (!fromId) return; // roots are reordered via reorderSections
  // dropping a node into its own subtree is invalid
  let probe: string | null = targetParentId;
  while (probe) {
    if (probe === nodeId) return;
    probe = findDomParent(probe);
  }
  const from = m.domNodes[fromId];
  const cmds: Command[] = [];
  if (fromId === targetParentId) {
    const children = from.children.filter((c) => c !== nodeId);
    const oldIndex = from.children.indexOf(nodeId);
    const insertAt = index > oldIndex ? index - 1 : index;
    children.splice(Math.max(0, Math.min(insertAt, children.length)), 0, nodeId);
    cmds.push({ type: 'set', path: `domNodes.${fromId}.children`, value: children });
  } else {
    const target = m.domNodes[targetParentId];
    cmds.push({
      type: 'set',
      path: `domNodes.${fromId}.children`,
      value: from.children.filter((c) => c !== nodeId),
    });
    const children = [...target.children];
    children.splice(Math.max(0, Math.min(index, children.length)), 0, nodeId);
    cmds.push({ type: 'set', path: `domNodes.${targetParentId}.children`, value: children });
  }
  dispatchBatch(cmds);
}

/** Delete a non-root node and its subtree — inverse restores the snapshot (Doc 04 §3.2). */
export function removeDomNode(nodeId: string): boolean {
  const m = getManifest();
  const parentId = findDomParent(nodeId);
  if (!parentId) return false; // sections are removed via removeSection
  const cmds: Command[] = [
    {
      type: 'set',
      path: `domNodes.${parentId}.children`,
      value: m.domNodes[parentId].children.filter((c) => c !== nodeId),
    },
  ];
  const collect = (id: string) => {
    m.domNodes[id].children.forEach(collect);
    cmds.push({ type: 'set', path: `domNodes.${id}`, value: undefined });
  };
  collect(nodeId);
  dispatchBatch(cmds);
  return true;
}

/** Append a new section (root node + section band); ranges redistribute evenly. */
export function addSection(name: string, rootNode: DomNode): void {
  const m = getManifest();
  const sections = [
    ...m.sections,
    {
      id: newNodeId('sec'),
      name,
      range: [0, 1] as [number, number],
      rootDomNodeId: rootNode.id,
    },
  ];
  const n = sections.length;
  const redistributed = sections.map((s, i) => ({
    ...s,
    range: [Number((i / n).toFixed(4)), Number(((i + 1) / n).toFixed(4))] as [number, number],
  }));
  dispatchBatch([
    { type: 'set', path: `domNodes.${rootNode.id}`, value: rootNode },
    { type: 'set', path: 'domRootOrder', value: [...m.domRootOrder, rootNode.id] },
    { type: 'set', path: 'sections', value: redistributed },
  ]);
}

/** Delete a section: its band, root node and the whole subtree go in ONE
 *  transaction; remaining ranges redistribute evenly (Phase 2.7 — audit A-2).
 *  The last section is protected: a page always keeps one scroll panel. */
export function removeSection(sectionId: string): boolean {
  const m = getManifest();
  if (m.sections.length <= 1) return false;
  const section = m.sections.find((s) => s.id === sectionId);
  if (!section) return false;
  const remaining = m.sections.filter((s) => s.id !== sectionId);
  const n = remaining.length;
  const redistributed = remaining.map((s, i) => ({
    ...s,
    range: [Number((i / n).toFixed(4)), Number(((i + 1) / n).toFixed(4))] as [number, number],
  }));
  const cmds: Command[] = [
    { type: 'set', path: 'sections', value: redistributed },
    { type: 'set', path: 'domRootOrder', value: redistributed.map((s) => s.rootDomNodeId) },
  ];
  const collect = (id: string) => {
    m.domNodes[id]?.children.forEach(collect);
    cmds.push({ type: 'set', path: `domNodes.${id}`, value: undefined });
  };
  collect(section.rootDomNodeId);
  dispatchBatch(cmds);
  return true;
}

/** Duplicate a section: deep-clone the root subtree with fresh ids and insert
 *  the new band after the original; ranges redistribute (Phase 2.7). */
export function duplicateSection(sectionId: string): string | null {
  const m = getManifest();
  const at = m.sections.findIndex((s) => s.id === sectionId);
  if (at < 0) return null;
  const src = m.sections[at];
  const cmds: Command[] = [];
  const clone = (id: string): string => {
    const node = m.domNodes[id];
    const copy: DomNode = { ...structuredClone(node), id: newNodeId(node.type) };
    if (id === src.rootDomNodeId) copy.label = `${node.label} copy`;
    copy.children = node.children.map(clone);
    cmds.push({ type: 'set', path: `domNodes.${copy.id}`, value: copy });
    return copy.id;
  };
  const newRootId = clone(src.rootDomNodeId);
  const sections = [...m.sections];
  sections.splice(at + 1, 0, {
    id: newNodeId('sec'),
    name: `${src.name} copy`,
    range: [0, 1],
    rootDomNodeId: newRootId,
  });
  const n = sections.length;
  const redistributed = sections.map((s, i) => ({
    ...s,
    range: [Number((i / n).toFixed(4)), Number(((i + 1) / n).toFixed(4))] as [number, number],
  }));
  cmds.push(
    { type: 'set', path: 'sections', value: redistributed },
    { type: 'set', path: 'domRootOrder', value: redistributed.map((s) => s.rootDomNodeId) },
  );
  dispatchBatch(cmds);
  return newRootId;
}

/** Reorder sections (drag in Sections list — defines scroll sequence, Doc 05 §3). */
export function reorderSections(fromIndex: number, toIndex: number): void {
  const m = getManifest();
  const sections = [...m.sections];
  const [moved] = sections.splice(fromIndex, 1);
  sections.splice(toIndex, 0, moved);
  const n = sections.length;
  const redistributed = sections.map((s, i) => ({
    ...s,
    range: [Number((i / n).toFixed(4)), Number(((i + 1) / n).toFixed(4))] as [number, number],
  }));
  dispatchBatch([
    { type: 'set', path: 'sections', value: redistributed },
    { type: 'set', path: 'domRootOrder', value: redistributed.map((s) => s.rootDomNodeId) },
  ]);
}

/* ---------------- Scroll stage + scene3d embeds (issues.md) ---------------- */

/** Write a stage property — the scroll-driven 3D scene is edited through the
 *  command engine like every other component (IL-1). */
export function setStageProp(prop: keyof SceneStage, value: unknown, coalesce = false): void {
  const path = `stage.${prop}`;
  dispatch({ type: 'set', path, value, coalesceKey: coalesce ? path : undefined });
}

/** Write one scene3d embed setting (e.g. group 'camera', key 'fov'). The full
 *  defaults-merged settings object is written so undo restores a complete,
 *  self-consistent snapshot. */
export function setScene3dSetting(
  nodeId: string,
  group: keyof Scene3dSettings,
  key: string,
  value: unknown,
  coalesce = false,
): void {
  const m = getManifest();
  const node = m.domNodes[nodeId];
  if (!node || node.type !== 'scene3d') return;
  const next = scene3dSettingsOf(node) as unknown as Record<string, Record<string, unknown>>;
  if (value === undefined) delete next[group][key];
  else next[group][key] = value;
  const path = `domNodes.${nodeId}.scene`;
  dispatch({ type: 'set', path, value: next, coalesceKey: coalesce ? `${path}.${group}.${key}` : undefined });
}

/* ---------------- Waypoint operations (FR-160/161, Doc 05 §6) ---------------- */

/** Create a waypoint bound to an anchor; active band defaults to the section at `progress`. */
export function addWaypoint(progress: number): Waypoint | null {
  const m = getManifest();
  const anchorIds = Object.values(m.sceneNodes)
    .filter((n) => n.type === 'anchor')
    .map((n) => n.id);
  if (anchorIds.length === 0) return null;
  const section =
    m.sections.find((s) => progress >= s.range[0] && progress <= s.range[1]) ?? m.sections[0];
  const wp: Waypoint = {
    id: newNodeId('wp'),
    label: 'New Waypoint',
    content: 'Describe the highlighted 3D feature…',
    anchorId: anchorIds[0],
    direction: 'right',
    clamp: true,
    range: [...section.range] as [number, number],
  };
  dispatch({ type: 'set', path: 'waypoints', value: [...m.waypoints, wp] });
  return wp;
}

export function removeWaypoint(waypointId: string): void {
  const m = getManifest();
  dispatch({
    type: 'set',
    path: 'waypoints',
    value: m.waypoints.filter((w) => w.id !== waypointId),
  });
}

export function setWaypointProp(
  waypointId: string,
  prop: keyof Waypoint,
  value: unknown,
  coalesce = false,
): void {
  const m = getManifest();
  const idx = m.waypoints.findIndex((w) => w.id === waypointId);
  if (idx < 0) return;
  const path = `waypoints.${idx}.${prop}`;
  dispatch({ type: 'set', path, value, coalesceKey: coalesce ? path : undefined });
}

/* ---------------- DOM subtree duplication (01 LayerSystem: duplicate) ---------------- */

/** Deep-clone a non-root DOM subtree with fresh ids; insert after the original. */
export function duplicateDomNode(nodeId: string): string | null {
  const m = getManifest();
  const parentId = findDomParent(nodeId);
  if (!parentId) return null; // sections are top-level scroll panels — not duplicated here
  const cmds: Command[] = [];
  const clone = (id: string): string => {
    const src = m.domNodes[id];
    const copy: DomNode = { ...structuredClone(src), id: newNodeId(src.type) };
    copy.label = id === nodeId ? `${src.label} copy` : src.label;
    copy.children = src.children.map(clone);
    cmds.push({ type: 'set', path: `domNodes.${copy.id}`, value: copy });
    return copy.id;
  };
  const newId = clone(nodeId);
  const parent = m.domNodes[parentId];
  const children = [...parent.children];
  children.splice(children.indexOf(nodeId) + 1, 0, newId);
  cmds.push({ type: 'set', path: `domNodes.${parentId}.children`, value: children });
  dispatchBatch(cmds);
  return newId;
}

/* ---------------- Sibling reorder (Phase 3 — 01 LayerSystem §search/order) ---------------- */

export function moveDomNodeBeside(dragId: string, targetId: string, edge: 'before' | 'after'): boolean {
  if (dragId === targetId) return false;
  const targetParent = findDomParent(targetId);
  if (!targetParent) return false; // section roots reorder via reorderSections
  const m = getManifest();
  const siblings = m.domNodes[targetParent].children;
  const index = siblings.indexOf(targetId) + (edge === 'after' ? 1 : 0);
  moveDomNode(dragId, targetParent, index);
  return true;
}

/* ---------------- Component system (Phase 3 — audit D-5, 01 ComponentSystem) ----------------
   Master/instance model with EXPLICIT sync: editing an instance is local until
   "update component" re-snapshots the def and re-stamps every other instance
   (instance roots keep their own placement keys). */

/** Instance-root style keys preserved through re-stamping (placement is per-instance). */
const INSTANCE_LAYOUT_KEYS = ['position', 'left', 'top', 'zIndex'] as const;

function snapshotSubtree(nodeId: string): ComponentTemplateNode {
  const m = getManifest();
  const n = m.domNodes[nodeId];
  const { children, ...rest } = structuredClone(n);
  void children;
  return { ...rest, componentId: undefined, children: n.children.map(snapshotSubtree) };
}

/** Turn the selected subtree into a reusable component; the source node
 *  becomes the first instance. One transaction. */
export function createComponentFromNode(nodeId: string): string | null {
  const m = getManifest();
  const node = m.domNodes[nodeId];
  if (!node || m.domRootOrder.includes(nodeId)) return null; // sections are pages, not components
  const def: ComponentDef = { id: newNodeId('cmpdef'), name: node.label, root: snapshotSubtree(nodeId) };
  dispatchBatch([
    { type: 'set', path: `components.${def.id}`, value: def },
    { type: 'set', path: `domNodes.${nodeId}.componentId`, value: def.id },
  ]);
  return def.id;
}

/** Stamp a fresh instance of a component under `parentId` at `index`;
 *  `placement` overrides the instance root's layout keys. One transaction. */
export function instantiateComponent(
  defId: string,
  parentId: string,
  index: number,
  placement?: StyleBlock,
): string | null {
  const m = getManifest();
  const def = m.components[defId];
  const parent = m.domNodes[parentId];
  if (!def || !parent) return null;
  const cmds: Command[] = [];
  const stamp = (tpl: ComponentTemplateNode, isRoot: boolean): string => {
    const childIds = tpl.children.map((c) => stamp(c, false));
    const node: DomNode = {
      ...structuredClone({ ...tpl, children: undefined }),
      id: newNodeId(tpl.type),
      children: childIds,
      componentId: isRoot ? defId : undefined,
      style: isRoot ? { ...tpl.style, ...(placement ?? {}) } : tpl.style,
    } as DomNode;
    cmds.push({ type: 'set', path: `domNodes.${node.id}`, value: node });
    return node.id;
  };
  const rootId = stamp(def.root, true);
  const children = [...parent.children];
  children.splice(Math.max(0, Math.min(index, children.length)), 0, rootId);
  cmds.push({ type: 'set', path: `domNodes.${parentId}.children`, value: children });
  dispatchBatch(cmds);
  return rootId;
}

/** All instance-root node ids of a component. */
export function componentInstances(defId: string): string[] {
  const m = getManifest();
  return Object.values(m.domNodes)
    .filter((n) => n.componentId === defId)
    .map((n) => n.id);
}

/** Push THIS instance's current state into the def and re-stamp every OTHER
 *  instance (their placement keys survive). Returns the count of synced
 *  instances. ONE transaction = one undo reverts def + all instances. */
export function updateComponentFromInstance(instanceRootId: string): number {
  const m = getManifest();
  const source = m.domNodes[instanceRootId];
  const defId = source?.componentId;
  if (!defId || !m.components[defId]) return 0;
  const def = m.components[defId];
  const nextRoot = snapshotSubtree(instanceRootId);
  const cmds: Command[] = [{ type: 'set', path: `components.${defId}`, value: { ...def, root: nextRoot } }];
  const others = componentInstances(defId).filter((id) => id !== instanceRootId);
  for (const id of others) {
    const inst = m.domNodes[id];
    // drop the old child subtrees…
    const collect = (cid: string) => {
      m.domNodes[cid].children.forEach(collect);
      cmds.push({ type: 'set', path: `domNodes.${cid}`, value: undefined });
    };
    inst.children.forEach(collect);
    // …stamp the new ones and refresh the root in place (id + placement survive)
    const stamp = (tpl: ComponentTemplateNode): string => {
      const childIds = tpl.children.map(stamp);
      const node: DomNode = {
        ...structuredClone({ ...tpl, children: undefined }),
        id: newNodeId(tpl.type),
        children: childIds,
        componentId: undefined,
      } as DomNode;
      cmds.push({ type: 'set', path: `domNodes.${node.id}`, value: node });
      return node.id;
    };
    const preserved: StyleBlock = {};
    for (const k of INSTANCE_LAYOUT_KEYS) {
      if (inst.style[k] !== undefined) preserved[k] = inst.style[k];
    }
    cmds.push({
      type: 'set',
      path: `domNodes.${id}`,
      value: {
        ...structuredClone({ ...nextRoot, children: undefined }),
        id,
        label: inst.label,
        componentId: defId,
        children: nextRoot.children.map(stamp),
        style: { ...nextRoot.style, ...preserved },
        overrides: inst.overrides,
      } as DomNode,
    });
  }
  dispatchBatch(cmds);
  return others.length;
}

/** Break the instance link — the subtree becomes plain nodes. */
export function detachComponentInstance(nodeId: string): void {
  dispatch({ type: 'set', path: `domNodes.${nodeId}.componentId`, value: undefined });
}

export function removeComponentDef(defId: string): boolean {
  const m = getManifest();
  if (!m.components[defId] || componentInstances(defId).length > 0) return false; // instances first (soft-delete law)
  dispatch({ type: 'set', path: `components.${defId}`, value: undefined });
  return true;
}

/* ---------------- Design tokens (Phase 3 — audit D-6, 01 DesignTokens) ---------------- */

export function addDesignToken(name: string, value: string | number): DesignToken {
  const m = getManifest();
  const token: DesignToken = { id: newNodeId('tok'), name: name.replace(/^\$/, ''), value };
  dispatch({ type: 'set', path: 'designTokens', value: [...m.designTokens, token] });
  return token;
}

export function setDesignTokenProp(
  tokenId: string,
  prop: 'name' | 'value',
  value: string | number,
  coalesce = false,
): void {
  const m = getManifest();
  dispatch({
    type: 'set',
    path: 'designTokens',
    value: m.designTokens.map((t) =>
      t.id === tokenId ? { ...t, [prop]: prop === 'name' ? String(value).replace(/^\$/, '') : value } : t,
    ),
    coalesceKey: coalesce ? `designTokens.${tokenId}` : undefined,
  });
}

export function removeDesignToken(tokenId: string): void {
  const m = getManifest();
  dispatch({
    type: 'set',
    path: 'designTokens',
    value: m.designTokens.filter((t) => t.id !== tokenId),
  });
}

/** Style values written as `$name` resolve to the token's value; unknown
 *  references pass through verbatim (visible, honest — never silently blank). */
export function resolveTokenValue(v: string | number): string | number {
  const m = getManifest();
  if (typeof v === 'string' && v.startsWith('$')) {
    const token = m.designTokens.find((t) => t.name === v.slice(1));
    if (token) return token.value;
  }
  return v;
}
