/**
 * Viewport camera path visualization module (WS2-3d, Phase 3, audit T-8, 04 CameraAnimation).
 * Pure move from runtime.ts (IL-11 behavior-identical).
 */
import * as THREE from 'three';
import { getManifest } from '@bs/engine';
import { sampleKeyframes } from '@bs/engine';

export interface CameraPathContext {
  scene: THREE.Scene;
  activeCameraId: string;
  camPathLine: THREE.Line | null;
  camPathKey: string;
  chromeVisible: boolean;
  setCamPathLine: (line: THREE.Line | null) => void;
  setCamPathKey: (key: string) => void;
  invalidate: () => void;
}

export function rebuildCameraPath(ctx: CameraPathContext): void {
  const m = getManifest();
  const track = m.tracks.find((t) => t.target === ctx.activeCameraId && t.channel === 'position');
  const key = track && track.keyframes.length > 1 ? JSON.stringify(track.keyframes) : '';
  if (key === ctx.camPathKey) return;
  ctx.setCamPathKey(key);
  if (ctx.camPathLine) {
    ctx.scene.remove(ctx.camPathLine);
    ctx.camPathLine.geometry.dispose();
    (ctx.camPathLine.material as THREE.Material).dispose();
    ctx.setCamPathLine(null);
  }
  if (!key || !track || !ctx.chromeVisible) {
    ctx.invalidate();
    return;
  }
  const pts: number[] = [];
  for (let i = 0; i <= 64; i++) {
    const v = sampleKeyframes(track.keyframes, i / 64);
    pts.push(v[0], v[1], v[2]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const line = new THREE.Line(
    geo,
    new THREE.LineBasicMaterial({ color: 0x2e3d54, transparent: true, opacity: 0.25 }),
  );

  line.visible = ctx.chromeVisible;
  ctx.scene.add(line);
  ctx.setCamPathLine(line);
  ctx.invalidate();
}
