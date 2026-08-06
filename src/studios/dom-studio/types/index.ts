/**
 * Canvas engine types & helper functions (WS2-3b, Doc 05 §3, 01 CanvasEngine).
 * Pure move from DOMViewport.tsx (IL-11 behavior-identical).
 */
import type { CSSProperties } from 'react';
import {
  findDomParent,
  getManifest,
  newNodeId,
  resolveStyle,
  resolveTokenValue,
  type DomNode,
} from '@bs/engine';
import { getComponentTemplates } from '@bs/services/appData';
import { getUIState, type DeviceProfile } from '@bs/engine';

const PX_PROPS = new Set([
  'fontSize',
  'padding',
  'gap',
  'maxWidth',
  'borderRadius',
  'width',
  'height',
  'letterSpacing',
  'left',
  'top',
]);

/** live element registry for the DOM studio's timeline bridge — per-frame
 *  writes go straight to the DOM, never through React (IL-2, Doc 04 §5) */
export const domEls = new Map<string, HTMLElement>();

/** canvas chrome refs (transient viewport state — never persisted, FR-123) */
export let canvasRootEl: HTMLElement | null = null;
let guideV: HTMLElement | null = null;
let guideH: HTMLElement | null = null;

export function setCanvasRootEl(el: HTMLElement | null): void {
  canvasRootEl = el;
}

export function setGuideV(el: HTMLElement | null): void {
  guideV = el;
}

export function setGuideH(el: HTMLElement | null): void {
  guideH = el;
}

export const SNAP = 6;

export function hideGuides(): void {
  if (guideV) guideV.style.display = 'none';
  if (guideH) guideH.style.display = 'none';
}

export function showGuideV(clientX: number): void {
  if (!guideV || !canvasRootEl || !getUIState().showGuides) return;
  const cr = canvasRootEl.getBoundingClientRect();
  guideV.style.display = 'block';
  guideV.style.left = `${clientX - cr.left}px`;
}

export function showGuideH(clientY: number): void {
  if (!guideH || !canvasRootEl || !getUIState().showGuides) return;
  const cr = canvasRootEl.getBoundingClientRect();
  guideH.style.display = 'block';
  guideH.style.top = `${clientY - cr.top}px`;
}

/** Section root ancestor of a node (free-move coordinates anchor here). */
export function sectionRootIdOf(nodeId: string): string {
  let rootId = nodeId;
  let p = findDomParent(rootId);
  while (p) {
    rootId = p;
    p = findDomParent(rootId);
  }
  return rootId;
}

/** Section root under a client point — free drops land in the hovered section. */
export function sectionRootAtPoint(clientY: number): string | null {
  const m = getManifest();
  let best: string | null = null;
  for (const id of m.domRootOrder) {
    const el = domEls.get(id);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (clientY >= r.top && clientY <= r.bottom) return id;
    best = best ?? id;
  }
  return best;
}

/** profile-aware style path — base write on desktop, sparse patch otherwise (FR-122) */
export function stylePath(nodeId: string, profile: DeviceProfile, prop: string): string {
  return profile === 'desktop'
    ? `domNodes.${nodeId}.style.${prop}`
    : `domNodes.${nodeId}.overrides.${profile}.${prop}`;
}

export function toCss(node: DomNode, profile: DeviceProfile): CSSProperties {
  const style = resolveStyle(node, profile);
  const css: Record<string, string | number> = {};
  for (const [k, rawV] of Object.entries(style)) {
    // `$name` design-token references resolve here (Phase 3 — audit D-6)
    const v = resolveTokenValue(rawV);
    css[k] = typeof v === 'number' && PX_PROPS.has(k) ? `${v}px` : v;
  }
  if (CONTAINER_TYPES.has(node.type)) {
    /* layout engine (Phase 2.1 — audit D-4, 01 LayoutEngine): display / flex /
       grid values are REAL style keys, editable in the Layout inspector group;
       legacy nodes without them keep the original flex-column behavior */
    css.display = (style.display as string) ?? 'flex';
    if (css.display === 'grid') {
      css.gridTemplateColumns = (style.gridTemplateColumns as string) ?? '1fr 1fr';
    } else if (css.display === 'flex') {
      css.flexDirection = (style.flexDirection as CSSProperties['flexDirection']) ?? 'column';
      if (style.flexWrap) css.flexWrap = style.flexWrap as string;
      if (style.justifyContent) css.justifyContent = style.justifyContent as string;
      css.alignItems =
        (style.alignItems as string) ??
        (style.textAlign === 'center' ? 'center' : style.textAlign === 'right' ? 'flex-end' : 'flex-start');
    }
    if (node.type === 'section') {
      css.minHeight = '78vh'; // scroll panels — each section is a beat of the narrative
      css.justifyContent = (style.justifyContent as string) ?? 'center';
      css.position = 'relative'; // anchor for free-form (absolute) children — FR-121
    }
  }
  if (node.type === 'link') {
    css.textDecoration = (style.textDecoration as string) ?? 'underline';
    css.cursor = 'default'; // editor: links select, never navigate
  }
  if (node.type === 'scene3d') {
    // embedded 3D element: transparent, gridless, layered like any DOM node
    css.overflow = 'hidden';
    css.background = css.background ?? 'transparent';
  }
  if (node.type === 'button') {
    css.border = 'none';
    css.cursor = 'default';
    css.font = 'inherit';
    css.fontSize = css.fontSize ?? '14px';
  }
  if (css.maxWidth) css.width = css.width ?? '100%';
  return css as CSSProperties;
}

/** Compute the child insertion index for a drop at clientY inside a container element. */
export function dropIndexFor(containerEl: HTMLElement, clientY: number): number {
  const children = Array.from(containerEl.children).filter((el) => el.classList.contains('bs-domnode'));
  for (let i = 0; i < children.length; i++) {
    const r = children[i].getBoundingClientRect();
    if (clientY < r.top + r.height / 2) return i;
  }
  return children.length;
}

/** Instantiate a toolbox template as a fresh DomNode. */
export function nodeFromTemplate(componentId: string): DomNode | null {
  const tpl = getComponentTemplates()[componentId] as
    Omit<DomNode, 'id' | 'children' | 'overrides'> | undefined;
  if (!tpl) return null;
  return {
    ...structuredClone(tpl),
    id: newNodeId(tpl.type),
    children: [],
    overrides: {},
  } as DomNode;
}

/** FR-120 container node set (Phase 2.1 — audit D-3): these accept child drops
 *  and are laid out by the layout engine (D-4). */
const CONTAINER_TYPES = new Set(['section', 'container', 'flex', 'grid', 'navigation', 'footer', 'custom']);

export function isContainerType(node: DomNode): boolean {
  return CONTAINER_TYPES.has(node.type);
}

interface FreeMovePeer {
  id: string;
  baseLeft: number;
  baseTop: number;
}

export interface FreeMoveGesture {
  pid: number;
  sx: number;
  sy: number;
  active: boolean;
  sectionEl: HTMLElement | null;
  baseLeft: number;
  baseTop: number;
  w: number;
  h: number;
  /** zoom captured at gesture start — screen deltas divide by it (Phase 1.5) */
  zoom: number;
  /** other selected nodes moving with the anchor (Phase 1.6 multi-move) */
  peers: FreeMovePeer[];
}

/** FR-120 node types with editable text content (Phase 3 — audit D-11). */
export const TEXT_TYPES = new Set(['heading', 'text', 'button', 'link']);
