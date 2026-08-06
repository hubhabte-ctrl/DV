/**
 * Embed renderer pool — single WebGL context shared by all scene3d embeds
 * (WS2-1b, audit A-4, 01 DOMCanvasStudio/Elements/Scene3D.md §pooled rendering).
 *
 * Browsers enforce a strict WebGL context cap (~8–16 per tab). Instead of
 * creating a WebGLRenderer per `scene3d` DOM element, the pool maintains ONE
 * offscreen WebGLRenderer and renders embeds on-demand to reusable offscreen
 * WebGLRenderTargets, copying pixels into 2D canvas elements.
 */
import * as THREE from 'three';

let sharedRenderer: THREE.WebGLRenderer | null = null;

function getSharedRenderer(): THREE.WebGLRenderer {
  if (!sharedRenderer) {
    sharedRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    sharedRenderer.setPixelRatio(1); // offscreen render targets use exact px bounds
    sharedRenderer.outputColorSpace = THREE.SRGBColorSpace;
    sharedRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  }
  return sharedRenderer;
}

export interface PooledTarget {
  render(scene: THREE.Scene, camera: THREE.Camera, canvas2d: HTMLCanvasElement, width?: number, height?: number): void;
  release(): void;
  dispose(): void;
}

export function acquirePooledTarget(): PooledTarget {
  let target: THREE.WebGLRenderTarget | null = null;
  let targetWidth = 0;
  let targetHeight = 0;

  return {
    render(scene, camera, canvas2d, width, height) {
      const w = Math.max(1, Math.round(width ?? canvas2d.clientWidth ?? canvas2d.width ?? 1));
      const h = Math.max(1, Math.round(height ?? canvas2d.clientHeight ?? canvas2d.height ?? 1));
      const renderer = getSharedRenderer();

      if (!target || targetWidth !== w || targetHeight !== h) {
        target?.dispose();
        target = new THREE.WebGLRenderTarget(w, h, {
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          format: THREE.RGBAFormat,
          type: THREE.UnsignedByteType,
          colorSpace: THREE.SRGBColorSpace,
        });
        targetWidth = w;
        targetHeight = h;
      }

      renderer.setSize(w, h, false);
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);

      // copy offscreen render target to the embed's 2D canvas
      if (canvas2d.width !== w || canvas2d.height !== h) {
        canvas2d.width = w;
        canvas2d.height = h;
      }
      const ctx2d = canvas2d.getContext('2d');
      if (ctx2d) {
        ctx2d.clearRect(0, 0, w, h);
        ctx2d.drawImage(renderer.domElement, 0, 0);
      }
    },

    dispose() {
      target?.dispose();
      target = null;
    },
    release() {
      target?.dispose();
      target = null;
    },
  };
}
