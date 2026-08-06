/**
 * Viewport waypoint bridge module (WS2-3d, FR-161, Doc 04   5).
 * Pure move from runtime.ts (IL-11 behavior-identical).
 * Handles anchor screen projection, clamping, and card DOM updates.
 */
import * as THREE from 'three';
import { getManifest } from '@bs/engine';

export interface WaypointBridgeContext {
  container: HTMLElement;
  overlay: HTMLElement | null;
  objects: Map<string, THREE.Object3D>;
  activeCamera: () => THREE.PerspectiveCamera;
  invalidate: () => void;
}

interface WpEls {
  root: HTMLDivElement;
  card: HTMLDivElement;
}

let wpEls = new Map<string, WpEls>();
const wpVec = new THREE.Vector3();

export function rebuildWaypoints(ctx: WaypointBridgeContext): void {
  if (!ctx.overlay) return;
  ctx.overlay.textContent = '';
  wpEls = new Map();
  for (const wp of getManifest().waypoints ?? []) {
    const root = document.createElement('div');
    root.className = 'bs-waypoint';
    const dot = document.createElement('div');
    dot.className = 'bs-waypoint__dot';
    const line = document.createElement('div');
    line.className = 'bs-waypoint__line';
    const card = document.createElement('div');
    card.className = 'bs-waypoint__card';
    const title = document.createElement('strong');
    const body = document.createElement('div');
    body.className = 'bs-waypoint__body';
    card.append(title, body);
    root.append(line, dot, card);
    ctx.overlay.appendChild(root);
    wpEls.set(wp.id, { root, card });
  }
  ctx.invalidate();
}

export function updateWaypoints(progress: number, ctx: WaypointBridgeContext): void {
  if (!ctx.overlay) return;
  const w = ctx.container.clientWidth || 1;
  const h = ctx.container.clientHeight || 1;
  const cam = ctx.activeCamera();
  for (const wp of getManifest().waypoints ?? []) {
    const els = wpEls.get(wp.id);
    if (!els) continue;
    const anchor = ctx.objects.get(wp.anchorId);
    if (!anchor) {
      els.root.style.display = 'none';
      continue;
    }
    anchor.getWorldPosition(wpVec).project(cam);
    const behind = wpVec.z > 1;
    let x = (wpVec.x * 0.5 + 0.5) * w;
    let y = (-wpVec.y * 0.5 + 0.5) * h;
    if (wp.clamp) {
      // screen-edge clamping (FR-161)
      x = Math.min(Math.max(x, 20), w - 20);
      y = Math.min(Math.max(y, 20), h - 20);
    }
    const inRange = progress >= wp.range[0] && progress <= wp.range[1];
    els.root.style.display = behind && !wp.clamp ? 'none' : '';
    els.root.style.opacity = inRange ? '1' : '0.15';
    els.root.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    els.root.dataset.dir = wp.direction;
    const [title, body] = [els.card.children[0], els.card.children[1]] as [HTMLElement, HTMLElement];
    if (title.textContent !== wp.label) title.textContent = wp.label;
    if (body.textContent !== wp.content) body.textContent = wp.content;
  }
}
