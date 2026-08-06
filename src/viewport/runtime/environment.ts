/**
 * Viewport HDR environment / IBL module (WS2-3d, Phase 2.3, audit S-4/M-3, 02 EnvironmentSystem).
 * Pure move from runtime.ts (IL-11 behavior-identical).
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { getManifest } from '@bs/engine';
import { loadHdrCached } from './loaders';

export interface EnvPipelineContext {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  appliedEnvKey: string;
  setAppliedEnvKey: (key: string) => void;
  invalidate: () => void;
}

let defaultStudioEnvTexture: THREE.Texture | null = null;

function getDefaultStudioEnv(renderer: THREE.WebGLRenderer): THREE.Texture {
  if (!defaultStudioEnvTexture) {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    defaultStudioEnvTexture = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    pmremGenerator.dispose();
  }
  return defaultStudioEnvTexture;
}

import { parseCssColor } from '../runtime';

export function applyEnvironment(ctx: EnvPipelineContext): void {
  const m = getManifest();
  const env = m.environment;
  const asset = env?.hdrAssetId ? m.assets?.find((a) => a.id === env.hdrAssetId) : undefined;
  const url = asset ? `${asset.url ?? ''}@${asset.version}` : '';
  const key = `${url}|${env?.background ?? 'color'}|${env?.backgroundColor ?? ''}|${env?.envIntensity ?? 1}`;
  if (key === ctx.appliedEnvKey) return;
  const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
  const defaultBg = isLight ? '#e2e8f0' : '#1c202a';
  const bgColor = (!env?.backgroundColor || env.backgroundColor === '#0b0d10' || env.backgroundColor === '#1c202a') ? defaultBg : env.backgroundColor;
  const bgThreeColor = parseCssColor(bgColor, defaultBg);
  ctx.scene.fog = null; // No unrequested fog haze   " 100% template driven
  if (!asset?.url) {
    ctx.scene.environment = getDefaultStudioEnv(ctx.renderer);
    ctx.scene.background = bgThreeColor;
    ctx.invalidate();
    return;
  }

  const wantHdrBg = env?.background === 'hdr';
  loadHdrCached(asset.url)
    .then((tex) => {
      if (ctx.appliedEnvKey !== key) return; // superseded meanwhile
      ctx.scene.environment = tex;
      if (wantHdrBg) {
        ctx.scene.background = tex;
      } else {
        ctx.scene.background = bgThreeColor;
      }
      ctx.invalidate();
    })
    .catch(() => {
      ctx.scene.environment = getDefaultStudioEnv(ctx.renderer);
      ctx.scene.background = bgThreeColor;
      ctx.invalidate();
    });
}
