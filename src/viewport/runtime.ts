/**
 * Imperative Three.js viewport runtime   " prototype mirror of `scene-engine` + `runtime-bridge`.
 * IRON LAWS honored here:
 *  - IL-3 / PRD-INV-02: no React in this module; the shell mounts it into a plain <div>.
 *  - IL-2 / PRD-INV-01: driven exclusively by the [0,1] progress clock.
 *  - Doc 04   5: cached object references (Map<NodeId, Object3D>), no traverse() per frame.
 *  - Doc 04   6: demand-based rendering   " renders only when progress/manifest changed.
 *
 * Sub-modules (WS2-3d split, IL-11 behavior-identical):
 *  - ./runtime/loaders.ts        " asset & model loading (GLTF/OBJ/FBX/STL/HDR)
 *  - ./runtime/materials.ts      " PBR material pipeline & texture cache
 *  - ./runtime/environment.ts    " HDR environment / IBL setup
 *  - ./runtime/waypoints.ts      " waypoints DOM projection bridge
 *  - ./runtime/cameraPath.ts     " camera spline visualization
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import {
  dispatch,
  dispatchBatch,
  getManifest,
  subscribeManifest,
  type Command,
  type SceneNode,
} from '@bs/engine';
import { channelSpans, createEvaluator, trackSignature } from '@bs/engine';
import { audibleTracks } from '../engine/audibleTracks';
import { getProgress, subscribeProgress } from '../engine/progress';
import { subscribeUIState, type TransformTool } from '@bs/engine';

import {
  assetGenFor,
  loadExtractedMesh,
  loadMesh,
  type ModelLoadContext,
} from './runtime/loaders';
import {
  applyMaterials,
  libMaterialFor,
  type MaterialPipelineContext,
} from './runtime/materials';
import { applyEnvironment } from './runtime/environment';
import { rebuildWaypoints, updateWaypoints } from './runtime/waypoints';
import { rebuildCameraPath } from './runtime/cameraPath';

type NavigationMode = 'editor' | 'track';

export interface ViewportHandle {
  dispose(): void;
  invalidate(): void;
  /** last measured frame time in ms (stats readout, Doc 05   5) */
  getStats(): { frameMs: number; drawCalls: number; triangles: number };
  /** anchor + full multi-selection (Phase 1.6): translate gizmo drags move
   *  every selected node by the anchor's delta */
  setSelected(nodeId: string | null, selectedIds?: string[]): void;
  /** 'editor': free orbit navigation (editor-local, never persisted   " Part 5);
   *  'track': camera comes only from evaluated tracks. */
  setNavigation(mode: NavigationMode): void;
  /** W/E/R transform tools + select (Doc 05   5 toolbar). */
  setTool(tool: TransformTool): void;
  setSpace(space: 'world' | 'local'): void;
  /** Frame-selected (F). */
  frameSelected(): void;
  getCameraState(): { position: number[]; target: number[] };
  setPresetView(view: 'perspective' | 'top' | 'left' | 'right' | 'front' | 'camera'): void;
  setChrome(visible: boolean): void;
  pickAt(clientX: number, clientY: number): { nodeId: string | null; point: [number, number, number] };
  dispose(): void;
}

export interface ViewportCallbacks {
  /** raycast click-selection   ' editor shell (low-frequency event only);
   *  `additive` = Ctrl/Shift-click (Phase 1.6 multi-select) */
  onSelect?(nodeId: string | null, additive?: boolean): void;
  /** overlay layer for waypoint cards   " managed imperatively by the bridge (Doc 04   5) */
  overlayEl?: HTMLElement;
}

export function parseCssColor(cssStr: string, fallback: string): THREE.Color {
  let trimmed = cssStr ? cssStr.trim() : '';
  if (!trimmed) return new THREE.Color(fallback);
  
  // Resolve CSS variables since canvas fillStyle won't resolve them when detached
  if (typeof document !== 'undefined') {
    while (trimmed.startsWith('var(')) {
      const varNameMatch = trimmed.match(/var\(([^,)]+)/);
      if (varNameMatch && varNameMatch[1]) {
        const nextVal = getComputedStyle(document.documentElement).getPropertyValue(varNameMatch[1].trim()).trim();
        if (!nextVal) break;
        trimmed = nextVal;
      } else {
        break;
      }
    }
  }

  if (trimmed.startsWith('#') || trimmed.startsWith('rgb') || trimmed.startsWith('hsl')) {
    try { return new THREE.Color(trimmed); } catch { /* fallback */ }
  }
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.fillStyle = trimmed;
        ctx.fillRect(0, 0, 1, 1);
        const data = ctx.getImageData(0, 0, 1, 1).data;
        return new THREE.Color(data[0] / 255, data[1] / 255, data[2] / 255);
      }
    } catch {
      /* fallback */
    }
  }
  return new THREE.Color(fallback);
}

export function createViewport(container: HTMLElement, callbacks: ViewportCallbacks = {}): ViewportHandle {
  const manifest = getManifest();

  function getBgColor(): THREE.Color {
    const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
    const fallback = isLight ? '#f8fafc' : '#171924';
    if (typeof document !== 'undefined') {
      const val = getComputedStyle(document.documentElement).getPropertyValue('--shell').trim() ||
                  getComputedStyle(document.documentElement).getPropertyValue('--bs-color-viewport-canvasBg').trim();
      return parseCssColor(val, fallback);
    }
    return new THREE.Color(fallback);
  }

  /** Opaque background colour used in editor mode; null = transparent in DOM backdrop mode. */
  const SCENE_BG_COLOR = getBgColor();

  /* alpha:true is required so the canvas is transparent in DOM backdrop mode (chrome=false).
     In editor mode setChrome(true) restores the opaque background. */
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  /* Start opaque (editor default); setChrome(false) will make it transparent. */
  renderer.setClearColor(SCENE_BG_COLOR, 1);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = SCENE_BG_COLOR; // overridden to null by setChrome(false)
  scene.fog = null; // 100% template driven   " no unrequested fog haze

  /*  "  "  Editor System Fallback Lighting  "  " 
     Internal Three.js lights to guarantee viewport visibility even when user lights
     are hidden or deleted in the Layers Panel. Not part of manifest.sceneNodes. */
  const defaultSystemHemiLight = new THREE.HemisphereLight(0xffffff, 0x3d4659, 1.1);
  scene.add(defaultSystemHemiLight);

  const defaultSystemDirLight = new THREE.DirectionalLight(0xffffff, 1.35);
  defaultSystemDirLight.position.set(5, 10, 7);
  scene.add(defaultSystemDirLight);

  /** Track camera   " state comes only from evaluated tracks (Part 5). */
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  const cameraTarget = new THREE.Vector3(0, 0.5, 0);

  /** Editor navigation camera   " editor-local, never persisted (Part 5). */
  const navCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  navCamera.position.set(4.5, 2.6, 5.2);
  let navMode: NavigationMode = 'track';
  const activeCamera = () => (navMode === 'editor' ? navCamera : camera);

  /* ---------- demand-based scheduler state (Doc 04   6)   " hoisted above first invalidate() call ---------- */
  let needsFrame = true;
  let running = true;
  let frameMs = 0;

  function invalidate(): void {
    needsFrame = true;
  }

  /* ---------- build scene graph once from manifest (Part 5 law) ---------- */
  const objects = new Map<string, THREE.Object3D>(); // cached refs   " never traverse per frame

  const grid = new THREE.GridHelper(16, 32, 0x64748b, 0x334155);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.15;
  scene.add(grid);

  function syncViewportTheme(): void {
    if (chromeVisible) {
      const bg = getBgColor();
      scene.background = bg;
      renderer.setClearColor(bg, 1);
    }
    invalidate();
  }

  const themeObserver = typeof MutationObserver !== 'undefined'
    ? new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.attributeName === 'data-theme') {
            syncViewportTheme();
          }
        }
      })
    : null;
  if (themeObserver && typeof document !== 'undefined') {
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }



  /** loaded GLB root per mesh-node id   " material application never re-traverses the scene */
  const meshRoots = new Map<string, THREE.Object3D>();
  /** asset generation applied per mesh node (`assetId@version`)   " reload on replace (FR-183) */
  const meshGen = new Map<string, string>();

  /*  "  "  editor light & object helpers (Phase 2.2   " audit S-5): part of editor chrome  "  "  */
  const lightHelpers = new Map<string, THREE.Object3D>();
  const cameraGizmos = new Map<string, THREE.Object3D>();
  const anchorGizmos = new Map<string, THREE.Object3D>();
  let chromeVisible = true;

  function attachLightHelper(nodeId: string, light: THREE.Light, kind: string): void {
    let helper: THREE.Object3D | null = null;
    if (kind === 'directional') {
      helper = new THREE.DirectionalLightHelper(light as THREE.DirectionalLight, 0.5, 0x8aa2ff);
    } else if (kind === 'point') {
      helper = new THREE.PointLightHelper(light as THREE.PointLight, 0.18, 0x8aa2ff);
    } else if (kind === 'spot') {
      helper = new THREE.SpotLightHelper(light as THREE.SpotLight, 0x8aa2ff);
    }
    if (!helper) return; // ambient/hemisphere have no positional gizmo
    helper.visible = chromeVisible;
    scene.add(helper);
    lightHelpers.set(nodeId, helper);
  }

  function removeLightHelper(nodeId: string): void {
    const helper = lightHelpers.get(nodeId);
    if (!helper) return;
    scene.remove(helper);
    (helper as unknown as { dispose?: () => void }).dispose?.();
    lightHelpers.delete(nodeId);
  }

  /* ---------- material pipeline context ---------- */
  const libMaterials = new Map<string, THREE.MeshPhysicalMaterial>();
  const importedMaterials = new Map<string, THREE.Material>();
  const originalMats = new Map<string, Map<THREE.Mesh, THREE.Material | THREE.Material[]>>();

  const matCtx: MaterialPipelineContext = {
    libMaterials,
    importedMaterials,
    originalMats,
    meshRoots,
    invalidate,
  };

  /** Dispose an object's subtree resources (Part 5: dispose is mandatory). */
  function disposeSubtree(root: THREE.Object3D): void {
    const shared = new Set<THREE.Material>([...libMaterials.values(), ...importedMaterials.values()]);
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && !mesh.userData?.sharedContent) {
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) if (mat && !shared.has(mat)) mat.dispose();
      }
    });
  }

  const modelLoadCtx: ModelLoadContext = {
    meshRoots,
    meshGen,
    importedMaterials,
    applyMaterials: () => applyMaterials(matCtx),
    invalidate,
    disposeSubtree,
  };

  for (const id of manifest.sceneRootOrder) {
    if (manifest.sceneNodes[id]) {
      buildNode(manifest.sceneNodes[id], scene);
    }
  }

  function buildNode(node: SceneNode | undefined, parent: THREE.Object3D): void {
    if (!node) return;
    let obj: THREE.Object3D;
    switch (node.type) {
      case 'group':
        obj = new THREE.Group();
        break;
      case 'camera': {
        const camGroup = new THREE.Group();
        const bodyGeo = new THREE.BoxGeometry(0.18, 0.12, 0.22);
        const bodyMat = new THREE.MeshStandardMaterial({ color: '#1a202c', roughness: 0.5, metalness: 0.8 });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.set(0, 0, 0.11);

        const frustumGeo = new THREE.ConeGeometry(0.22, 0.35, 4);
        frustumGeo.rotateX(-Math.PI / 2);
        const frustumMat = new THREE.MeshBasicMaterial({
          color: '#2e3d54',
          wireframe: true,
          transparent: true,
          opacity: 0.25,
        });
        const frustumMesh = new THREE.Mesh(frustumGeo, frustumMat);

        const lensGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.1, 16);
        lensGeo.rotateX(Math.PI / 2);
        const lensMat = new THREE.MeshStandardMaterial({ color: '#3d4f6e', roughness: 0.4, metalness: 0.8 });

        const lensMesh = new THREE.Mesh(lensGeo, lensMat);
        lensMesh.position.set(0, 0, -0.05);

        camGroup.add(bodyMesh, frustumMesh, lensMesh);
        camGroup.visible = chromeVisible;
        cameraGizmos.set(node.id, camGroup);
        obj = camGroup;
        break;
      }
      case 'light': {
        const kind = node.props?.kind;
        const color = String(node.props?.color ?? '#ffffff');
        const intensity = Number(node.props?.intensity ?? 1);
        if (kind === 'directional') {
          const light = new THREE.DirectionalLight(color, intensity);
          light.castShadow = true;
          obj = light;
        } else if (kind === 'point') {
          obj = new THREE.PointLight(color, intensity);
        } else if (kind === 'spot') {
          obj = new THREE.SpotLight(color, intensity);
        } else if (kind === 'ambient') {
          obj = new THREE.AmbientLight(color, intensity);
        } else {
          obj = new THREE.HemisphereLight(color, '#10131a', intensity || 0.6);
        }
        attachLightHelper(node.id, obj as THREE.Light, kind ? String(kind) : 'hemisphere');
        break;
      }
      case 'anchor': {
        const anchor = new THREE.Group();
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.03, 12, 12),
          new THREE.MeshBasicMaterial({ color: '#4d8dff' }),
        );
        anchor.add(marker);
        anchor.visible = chromeVisible;
        anchorGizmos.set(node.id, anchor);
        obj = anchor;
        break;
      }
      case 'mesh': {
        if (node.props?.primitive) {
          const geo =
            node.props.primitive === 'box'
              ? new THREE.BoxGeometry(0.24, 0.24, 0.24)
              : new THREE.SphereGeometry(0.12, 24, 24);
          const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#8a96b0' }));
          mesh.castShadow = Boolean(node.props?.castShadow);
          const wrap = new THREE.Group();
          wrap.add(mesh);
          meshRoots.set(node.id, wrap);
          obj = wrap;
        } else if (node.props?.subPath !== undefined) {
          obj = new THREE.Group();
          loadExtractedMesh(node, obj, modelLoadCtx);
        } else {
          obj = new THREE.Group();
          loadMesh(node, obj, modelLoadCtx);
        }
        break;
      }
      default:
        obj = new THREE.Group();
    }
    obj.name = node.id;
    if (node.transform) {
      obj.position.fromArray(node.transform.position ?? [0, 0, 0]);
      obj.rotation.set(
        node.transform.rotation?.[0] ?? 0,
        node.transform.rotation?.[1] ?? 0,
        node.transform.rotation?.[2] ?? 0,
      );
      obj.scale.fromArray(node.transform.scale ?? [1, 1, 1]);
    }
    obj.visible = Boolean(node.visible);
    parent.add(obj);
    objects.set(node.id, obj);
    for (const childId of node.children ?? []) {
      if (!objects.has(childId) && manifest.sceneNodes[childId]) {
        buildNode(manifest.sceneNodes[childId], obj);
      }
    }
  }

  /* ---------- environment / IBL ---------- */
  let appliedEnvKey = '';
  const envCtx = {
    scene,
    renderer,
    appliedEnvKey,
    setAppliedEnvKey: (k: string) => {
      appliedEnvKey = k;
    },
    invalidate,
  };

  applyEnvironment(envCtx);

  /* ---------- selection highlight ---------- */
  let selectionHelper: THREE.BoxHelper | null = null;
  let selectedId: string | null = null;
  let selectedIdList: string[] = [];
  function setSelected(nodeId: string | null, selectedIds?: string[]): void {
    const prevId = selectedId;
    selectedId = nodeId;
    selectedIdList = selectedIds ?? (nodeId ? [nodeId] : []);
    if (selectionHelper) {
      scene.remove(selectionHelper);
      selectionHelper.dispose();
      selectionHelper = null;
    }
    if (nodeId && chromeVisible && navMode === 'editor') {
      const obj = objects.get(nodeId);
      if (obj) {
        selectionHelper = new THREE.BoxHelper(obj, 0x00e5ff);
        scene.add(selectionHelper);
        if (nodeId !== prevId) {
          frameSelected();
        }
      }
    }
    refreshGizmo();
    invalidate();
  }

  /* ---------- editor navigation: orbit/pan/zoom ---------- */
  const orbit = new OrbitControls(navCamera, renderer.domElement);
  orbit.target.set(0, 0.5, 0);
  orbit.enableDamping = false;
  orbit.enabled = true;
  orbit.addEventListener('change', () => invalidate());

  /* ---------- transform gizmo: W/E/R tools ---------- */
  let currentTool: TransformTool = 'select';
  const gizmo = new TransformControls(navCamera, renderer.domElement);
  gizmo.setSize(0.9);
  const gizmoHelper =
    typeof (gizmo as unknown as { getHelper?: () => THREE.Object3D }).getHelper === 'function'
      ? (gizmo as unknown as { getHelper: () => THREE.Object3D }).getHelper()
      : (gizmo as unknown as THREE.Object3D);
  scene.add(gizmoHelper);
  gizmo.addEventListener('dragging-changed', (e) => {
    orbit.enabled = !(e as unknown as { value: boolean }).value;
  });
  gizmo.addEventListener('change', () => invalidate());

  interface TransformBase {
    position: number[];
    rotation: number[];
    scale: number[];
  }
  let multiBase: Map<string, TransformBase> | null = null;
  gizmo.addEventListener('mouseDown', () => {
    const m = getManifest();
    multiBase = new Map();
    for (const id of selectedIdList) {
      const n = m.sceneNodes[id];
      if (n) multiBase.set(id, structuredClone(n.transform));
    }
  });
  gizmo.addEventListener('mouseUp', () => {
    multiBase = null;
  });

  gizmo.addEventListener('objectChange', () => {
    const obj = gizmo.object as THREE.Object3D | undefined;
    if (!obj || !selectedId) return;
    const m = getManifest();
    if (selectedIdList.length > 1 && m.sceneNodes[selectedId] && multiBase?.has(selectedId)) {
      const anchorBase = multiBase.get(selectedId)!;
      const pivot = new THREE.Vector3().fromArray(anchorBase.position);
      const cmds: Command[] = [];
      const push = (id: string, key: 'position' | 'rotation' | 'scale', value: number[]) =>
        cmds.push({
          type: 'set',
          path: `sceneNodes.${id}.transform.${key}`,
          value: value.map((n) => Number(n.toFixed(4))),
        });
      if (currentTool === 'translate') {
        const delta = new THREE.Vector3(
          obj.position.x - anchorBase.position[0],
          obj.position.y - anchorBase.position[1],
          obj.position.z - anchorBase.position[2],
        );
        for (const id of selectedIdList) {
          const base = multiBase.get(id);
          if (!base || m.sceneNodes[id]?.locked) continue;
          push(id, 'position', [
            base.position[0] + delta.x,
            base.position[1] + delta.y,
            base.position[2] + delta.z,
          ]);
        }
      } else if (currentTool === 'rotate') {
        const baseQ = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(anchorBase.rotation[0], anchorBase.rotation[1], anchorBase.rotation[2]),
        );
        const dq = obj.quaternion.clone().multiply(baseQ.invert());
        for (const id of selectedIdList) {
          const base = multiBase.get(id);
          if (!base || m.sceneNodes[id]?.locked) continue;
          const q = dq
            .clone()
            .multiply(
              new THREE.Quaternion().setFromEuler(
                new THREE.Euler(base.rotation[0], base.rotation[1], base.rotation[2]),
              ),
            );
          const e = new THREE.Euler().setFromQuaternion(q);
          push(id, 'rotation', [e.x, e.y, e.z]);
          if (id !== selectedId) {
            const p = new THREE.Vector3().fromArray(base.position).sub(pivot).applyQuaternion(dq).add(pivot);
            push(id, 'position', [p.x, p.y, p.z]);
          }
        }
      } else if (currentTool === 'scale') {
        const ratio = [
          obj.scale.x / (anchorBase.scale[0] || 1e-6),
          obj.scale.y / (anchorBase.scale[1] || 1e-6),
          obj.scale.z / (anchorBase.scale[2] || 1e-6),
        ];
        for (const id of selectedIdList) {
          const base = multiBase.get(id);
          if (!base || m.sceneNodes[id]?.locked) continue;
          push(
            id,
            'scale',
            base.scale.map((v, i) => v * ratio[i]),
          );
          if (id !== selectedId) {
            push(
              id,
              'position',
              base.position.map((v, i) => pivot.getComponent(i) + (v - pivot.getComponent(i)) * ratio[i]),
            );
          }
        }
      }
      if (cmds.length) dispatchBatch(cmds, `gizmo-multi:${selectedId}`);
      return;
    }
    const t =
      currentTool === 'rotate'
        ? { key: 'rotation', value: [obj.rotation.x, obj.rotation.y, obj.rotation.z] }
        : currentTool === 'scale'
          ? { key: 'scale', value: [obj.scale.x, obj.scale.y, obj.scale.z] }
          : { key: 'position', value: [obj.position.x, obj.position.y, obj.position.z] };
    dispatch({
      type: 'set',
      path: `sceneNodes.${selectedId}.transform.${t.key}`,
      value: t.value.map((n) => Number(n.toFixed(4))),
      coalesceKey: `gizmo:${selectedId}:${t.key}`,
    });
  });

  function refreshGizmo(): void {
    const node = selectedId ? getManifest().sceneNodes[selectedId] : null;
    const obj = selectedId ? objects.get(selectedId) : null;
    if (chromeVisible && currentTool !== 'select' && navMode === 'editor' && obj && node && !node.locked) {
      gizmo.setMode(currentTool);
      gizmo.attach(obj);
      gizmoHelper.visible = true;
    } else {
      gizmo.detach();
      gizmoHelper.visible = false;
    }
    invalidate();
  }

  /* ---------- raycast click-selection ---------- */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downPos: { x: number; y: number } | null = null;

  renderer.domElement.addEventListener('pointerdown', (e) => {
    downPos = { x: e.clientX, y: e.clientY };
  });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downPos || navMode !== 'editor') return;
    const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    downPos = null;
    if (moved > 5 || (gizmo as unknown as { dragging: boolean }).dragging) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, navCamera);
    const pickables: THREE.Object3D[] = [];
    for (const [id, obj] of objects) {
      const node = getManifest().sceneNodes[id];
      if (node && !node.locked && node.visible) pickables.push(obj);
    }
    const hits = raycaster.intersectObjects(pickables, true);
    let picked: string | null = null;
    for (const hit of hits) {
      let o: THREE.Object3D | null = hit.object;
      while (o) {
        if (objects.has(o.name) && o.name) {
          picked = o.name;
          break;
        }
        o = o.parent;
      }
      if (picked) break;
    }
    callbacks.onSelect?.(picked, e.ctrlKey || e.metaKey || e.shiftKey);
  });

  function frameSelected(): void {
    const obj = (selectedId && objects.get(selectedId)) || objects.get('grp-assembly');
    if (!obj) return;
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty())
      box.setFromCenterAndSize(obj.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(0.5, 0.5, 0.5));
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.3);

    orbit.target.copy(center);

    let dir = navCamera.position.clone().sub(center);
    if (dir.lengthSq() < 0.001) dir.set(0, 0.5, 1);
    dir.normalize();

    const distance = Math.max(maxDim * 2.5, 1.0);
    navCamera.position.copy(center).addScaledVector(dir, distance);

    orbit.update();
    invalidate();
  }

  /* ---------- waypoint bridge ---------- */
  const waypointCtx = {
    container,
    overlay: callbacks.overlayEl ?? null,
    objects,
    activeCamera,
    invalidate,
  };
  rebuildWaypoints(waypointCtx);

  /* ---------- evaluated state application ----------
     Evaluator is built from AUDIBLE tracks only (04 TimelineEditor   2:
     mute = evaluation skips, solo wins)   " muted channels release ownership
     back to manifest base values. Mute/solo are transient UI state, so the
     UI-store subscription below rebuilds on toggle. */
  let evaluator = createEvaluator(audibleTracks(manifest.tracks));
  let evalSig = trackSignature(audibleTracks(manifest.tracks));
  let evalSpans = channelSpans(audibleTracks(manifest.tracks));
  const EPS = 1e-6;

  function spanOwns(key: string, progress: number): boolean {
    const span = evalSpans.get(key);
    return !!span && progress >= span[0] - EPS && progress <= span[1] + EPS;
  }

  function applyEvaluated(progress: number): void {
    const state = evaluator.evaluate(progress);
    for (const [key, buf] of state.channels) {
      const dot = key.lastIndexOf('.');
      const targetId = key.slice(0, dot);
      const channel = key.slice(dot + 1);
      const matRec = getManifest().materials?.[targetId];
      if (matRec) {
        const mat = (libMaterials.get(targetId) ??
          importedMaterials.get(targetId) ??
          libMaterialFor(targetId, matCtx)) as THREE.MeshPhysicalMaterial | null;
        if (mat) {
          switch (channel) {
            case 'emissiveIntensity':
              mat.emissiveIntensity = buf[0];
              break;
            case 'roughness':
              if ('roughness' in mat) mat.roughness = buf[0];
              break;
            case 'metallic':
              if ('metalness' in mat) mat.metalness = buf[0];
              break;
            case 'opacity':
              mat.opacity = buf[0];
              if (buf[0] < 1 - EPS) mat.transparent = true;
              break;
            case 'baseColor':
              mat.color?.setRGB(buf[0], buf[1], buf[2], THREE.SRGBColorSpace);
              break;
          }
        }
        continue;
      }
      const obj = objects.get(targetId);
      if (!obj) continue;
      switch (channel) {
        case 'position':
          if (targetId === activeCameraId) camera.position.set(buf[0], buf[1], buf[2]);
          else obj.position.set(buf[0], buf[1], buf[2]);
          break;
        case 'target':
          cameraTarget.set(buf[0], buf[1], buf[2]);
          break;
        case 'rotation':
          if (spanOwns(key, progress)) obj.rotation.set(buf[0], buf[1], buf[2]);
          break;
        case 'intensity':
          if ((obj as THREE.Light).isLight && spanOwns(key, progress)) {
            (obj as THREE.Light).intensity = buf[0];
          }
          break;
        case 'visible':
          obj.visible = buf[0] >= 0.5;
          break;
      }
    }
    camera.lookAt(cameraTarget);
    selectionHelper?.update();
  }

  /* ---------- manifest sync ---------- */
  let activeCameraId = 'cam-main';

  function ensureGraph(): void {
    const m = getManifest();
    activeCameraId =
      Object.values(m.sceneNodes).find((n) => n.type === 'camera' && n.props?.active)?.id ?? activeCameraId;
    for (const [id, obj] of [...objects]) {
      if (!m.sceneNodes[id]) {
        obj.parent?.remove(obj);
        disposeSubtree(obj);
        objects.delete(id);
        meshRoots.delete(id);
        meshGen.delete(id);
        originalMats.delete(id);
        removeLightHelper(id);
        if (selectedId === id) setSelected(null);
      }
    }
    const attach = (id: string, parentObj: THREE.Object3D) => {
      const node = m.sceneNodes[id];
      if (!node) return;
      let obj = objects.get(id);
      if (!obj) {
        buildNode(node, parentObj);
        obj = objects.get(id)!;
      } else if (obj.parent !== parentObj) {
        parentObj.add(obj);
      }
      if (obj) {
        for (const c of node.children ?? []) {
          if (c && m.sceneNodes[c]) attach(c, obj);
        }
      }
    };
    for (const id of m.sceneRootOrder) attach(id, scene);
    for (const [id, obj] of objects) {
      const node = m.sceneNodes[id];
      if (node?.type === 'mesh' && !node.props?.primitive && meshGen.get(id) !== assetGenFor(node)) {
        const old = meshRoots.get(id);
        if (old && old !== obj) {
          obj.remove(old);
          disposeSubtree(old);
        }
        meshRoots.delete(id);
        originalMats.delete(id);
        if (node.props?.subPath !== undefined) loadExtractedMesh(node, obj, modelLoadCtx);
        else loadMesh(node, obj, modelLoadCtx);
      }
    }
  }

  /* ---------- camera path visualization ---------- */
  let camPathLine: THREE.Line | null = null;
  let camPathKey = '';

  const camPathCtx = {
    scene,
    activeCameraId,
    get camPathLine() {
      return camPathLine;
    },
    get camPathKey() {
      return camPathKey;
    },
    chromeVisible,
    setCamPathLine: (l: THREE.Line | null) => {
      camPathLine = l;
    },
    setCamPathKey: (k: string) => {
      camPathKey = k;
    },
    invalidate,
  };
  rebuildCameraPath(camPathCtx);

  function syncFromManifest(): void {
    const m = getManifest();
    const aud = audibleTracks(m.tracks);
    const sig = trackSignature(aud);
    if (sig !== evalSig) {
      evalSig = sig;
      evaluator = createEvaluator(aud);
    }
    evalSpans = channelSpans(aud);
    ensureGraph();
    const p = getProgress();
    for (const [id, obj] of objects) {
      const node = m.sceneNodes[id];
      if (!node) continue;
      obj.visible = node.visible;
      if (id !== activeCameraId) {
        obj.position.fromArray(node.transform.position);
        obj.scale.fromArray(node.transform.scale);
        if (!spanOwns(`${id}.rotation`, p)) {
          obj.rotation.set(
            node.transform.rotation[0],
            node.transform.rotation[1],
            node.transform.rotation[2],
          );
        }
      }
      if ((obj as THREE.Light).isLight && node.props) {
        const light = obj as THREE.Light;
        if (!spanOwns(`${id}.intensity`, p)) {
          light.intensity = Number(node.props.intensity ?? light.intensity);
        }
        light.color = new THREE.Color(String(node.props.color ?? '#ffffff'));
      }
      if (id === activeCameraId && node.props) {
        camera.fov = Number(node.props.fov ?? camera.fov);
        camera.updateProjectionMatrix();
      }
    }
    function updateFallbackLighting(): void {
      let visibleUserLights = 0;
      for (const [id, obj] of objects) {
        const node = m.sceneNodes[id];
        if (node && node.type === 'light' && node.visible !== false && obj.visible) {
          visibleUserLights++;
        }
      }
      if (visibleUserLights === 0) {
        defaultSystemHemiLight.intensity = 1.25;
        defaultSystemDirLight.intensity = 1.45;
      } else {
        defaultSystemHemiLight.intensity = 0.55;
        defaultSystemDirLight.intensity = 0.45;
      }
    }
    updateFallbackLighting();

    applyMaterials(matCtx);
    applyEnvironment(envCtx);
    camPathCtx.activeCameraId = activeCameraId;
    camPathCtx.chromeVisible = chromeVisible;
    rebuildCameraPath(camPathCtx);
    for (const helper of lightHelpers.values()) {
      (helper as unknown as { update?: () => void }).update?.();
    }
    selectionHelper?.update();
    rebuildWaypoints(waypointCtx);
    invalidate();
  }

  function resize(): void {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    navCamera.aspect = w / h;
    navCamera.updateProjectionMatrix();
    invalidate();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const unsubProgress = subscribeProgress(() => invalidate());
  const unsubManifest = subscribeManifest(() => syncFromManifest());
  /* transient mute/solo toggles rebuild the audible evaluator (cheap no-op
     when the audible signature is unchanged   " e.g. selection changes) */
  const unsubUIState = subscribeUIState(() => {
    const sig = trackSignature(audibleTracks(getManifest().tracks));
    if (sig !== evalSig) syncFromManifest();
  });

  const previewCam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100);
  const previewVec = new THREE.Vector3();

  function renderCameraPreview(): void {
    if (navMode !== 'editor' || !selectedId) return;
    const node = getManifest().sceneNodes[selectedId];
    if (!node || node.type !== 'camera') return;
    if (selectedId === activeCameraId) {
      previewCam.position.copy(camera.position);
      previewCam.quaternion.copy(camera.quaternion);
      previewCam.fov = camera.fov;
    } else {
      const obj = objects.get(selectedId);
      if (!obj) return;
      obj.getWorldPosition(previewVec);
      previewCam.position.copy(previewVec);
      previewCam.fov = Number(node.props?.fov ?? 50);
      previewCam.lookAt(cameraTarget);
    }
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    const pw = Math.round(Math.min(280, w * 0.3));
    const ph = Math.round((pw * 9) / 16);
    previewCam.aspect = pw / ph;
    previewCam.updateProjectionMatrix();
    const helperWasVisible = gizmoHelper.visible;
    const selWasVisible = selectionHelper?.visible ?? false;
    gizmoHelper.visible = false;
    if (selectionHelper) selectionHelper.visible = false;
    renderer.setViewport(w - pw - 12, 12, pw, ph);
    renderer.setScissor(w - pw - 12, 12, pw, ph);
    renderer.setScissorTest(true);
    renderer.render(scene, previewCam);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
    gizmoHelper.visible = helperWasVisible;
    if (selectionHelper) selectionHelper.visible = selWasVisible;
  }

  function loop(): void {
    if (!running) return;
    if (needsFrame) {
      needsFrame = false;
      const t0 = performance.now();
      const p = getProgress();
      applyEvaluated(p);
      renderer.render(scene, activeCamera());
      renderCameraPreview();
      updateWaypoints(p, waypointCtx);
      frameMs = performance.now() - t0;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  return {
    invalidate,
    setSelected,
    setNavigation(mode: NavigationMode) {
      navMode = mode;
      orbit.enabled = !(gizmo as unknown as { dragging: boolean }).dragging;
      refreshGizmo();
      invalidate();
    },
    setTool(tool: TransformTool) {
      currentTool = tool;
      refreshGizmo();
    },
    setSpace(space: 'world' | 'local') {
      gizmo.setSpace(space);
      invalidate();
    },
    setChrome(visible: boolean) {
      chromeVisible = visible;
      grid.visible = visible;
      camPathCtx.chromeVisible = visible;
      if (camPathLine) camPathLine.visible = visible;
      for (const helper of lightHelpers.values()) helper.visible = visible;
      for (const camGizmo of cameraGizmos.values()) camGizmo.visible = visible;
      for (const anchorGizmo of anchorGizmos.values()) anchorGizmo.visible = visible;
      setSelected(selectedId);
      refreshGizmo();
      /* DOM backdrop mode: transparent canvas so sections see the 3D scene behind them.
         Editor mode: opaque dark background for the full-screen 3D studio. */
      if (visible) {
        const bg = getBgColor();
        scene.background = bg;
        renderer.setClearColor(bg, 1);
      } else {
        scene.background = null;
        renderer.setClearColor(0x000000, 0); // fully transparent
      }
      invalidate();
    },
    pickAt(clientX: number, clientY: number) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      const cam = activeCamera();
      raycaster.setFromCamera(pointer, cam);
      const pickables: THREE.Object3D[] = [];
      for (const [id, obj] of objects) {
        const node = getManifest().sceneNodes[id];
        if (node && !node.locked && node.visible) pickables.push(obj);
      }
      const hits = raycaster.intersectObjects(pickables, true);
      for (const hit of hits) {
        let o: THREE.Object3D | null = hit.object;
        while (o) {
          if (objects.has(o.name) && o.name) {
            return { nodeId: o.name, point: [hit.point.x, hit.point.y, hit.point.z] };
          }
          o = o.parent;
        }
      }
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const pt = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, pt)) {
        return { nodeId: null, point: [pt.x, pt.y, pt.z] as [number, number, number] };
      }
      return { nodeId: null, point: [0, 0, 0] as [number, number, number] };
    },
    frameSelected,
    getCameraState() {
      const cam = activeCamera();
      return {
        position: [
          Number(cam.position.x.toFixed(3)),
          Number(cam.position.y.toFixed(3)),
          Number(cam.position.z.toFixed(3)),
        ],
        target: [
          Number(orbit.target.x.toFixed(3)),
          Number(orbit.target.y.toFixed(3)),
          Number(orbit.target.z.toFixed(3)),
        ],
      };
    },
    setPresetView(view: 'perspective' | 'top' | 'left' | 'right' | 'front' | 'camera') {
      if (view === 'camera') {
        navMode = 'track';
      } else {
        navMode = 'editor';
        const target = orbit.target.clone();
        const dist = 6;
        switch (view) {
          case 'top':
            navCamera.position.set(target.x, target.y + dist, target.z + 0.001);
            break;
          case 'left':
            navCamera.position.set(target.x - dist, target.y + 0.5, target.z);
            break;
          case 'right':
            navCamera.position.set(target.x + dist, target.y + 0.5, target.z);
            break;
          case 'front':
            navCamera.position.set(target.x, target.y + 0.5, target.z + dist);
            break;
          case 'perspective':
          default:
            navCamera.position.set(target.x, target.y + 2.5, target.z + 5);
            break;
        }
        navCamera.lookAt(target);
        orbit.update();
      }
      invalidate();
    },
    getStats: () => ({
      frameMs,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    }),
    dispose() {
      running = false;
      unsubProgress();
      unsubManifest();
      unsubUIState();
      ro.disconnect();
      if (camPathLine) {
        scene.remove(camPathLine);
        camPathLine.geometry.dispose();
        (camPathLine.material as THREE.Material).dispose();
      }
      for (const id of [...lightHelpers.keys()]) removeLightHelper(id);
      orbit.dispose();
      gizmo.detach();
      gizmo.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    },
  };
}
