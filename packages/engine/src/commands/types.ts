/**
 * Manifest domain types (WS2-3c — extracted from commands.ts, pure move IL-11).
 * Every interface here mirrors exactly what was in commands.ts lines 14–312.
 * No runtime state, no imports from engine peers — pure data shapes.
 */
import type { DeviceProfile } from '../store';

export interface StyleBlock {
  [prop: string]: string | number;
}

export interface DomNode {
  id: string;
  type: string;
  tag: string;
  label: string;
  content?: string;
  children: string[];
  style: StyleBlock;
  /** sparse patches per profile (FR-122) */
  overrides: Partial<Record<DeviceProfile, StyleBlock>>;
  /** layer-tree affordances (01 LayerSystem): hidden nodes render nowhere; locked nodes are not canvas-editable */
  hidden?: boolean;
  locked?: boolean;
  /** `scene3d` embeds reference a GLB asset by immutable id (Part 4 asset law) */
  assetId?: string;
  /** per-instance 3D settings for `scene3d` embeds (issues.md Inspector
   *  Requirements): every dropped asset creates an independent instance —
   *  instances share the asset record, never these settings */
  scene?: Scene3dSettings;
  /** instance-root marker (Phase 3 — audit D-5, 01 ComponentSystem): the node
   *  was stamped from `components[componentId]` and re-syncs on def updates */
  componentId?: string;
}

/** Editable settings of one `scene3d` embed instance (issues.md — camera,
 *  lighting, HDR environment, model transform, scroll animation). Undefined
 *  sub-keys fall back to defaults via `scene3dSettingsOf` (forward-compat). */
export interface Scene3dSettings {
  model: { position: number[]; rotation: number[]; scale: number };
  camera: { fov: number; height: number; distance: number };
  lighting: { keyIntensity: number; keyColor: string; hemiIntensity: number };
  environment: {
    background: 'transparent' | 'color';
    backgroundColor: string;
    /** HDR asset id for image-based lighting — empty = built-in lights only */
    hdrAssetId?: string;
    envIntensity: number;
  };
  /** scroll-driven animation: 'turntable' spins `speed` turns across `range`
   *  of the [0,1] clock; a timeline track on `{nodeId}.rotationY` overrides */
  scroll: { mode: 'turntable' | 'static'; speed: number; range: [number, number] };
}

export function defaultScene3dSettings(): Scene3dSettings {
  return {
    model: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 },
    camera: { fov: 38, height: 0.35, distance: 2.6 },
    lighting: { keyIntensity: 2.4, keyColor: '#ffffff', hemiIntensity: 0.9 },
    environment: { background: 'transparent', backgroundColor: '#0b0d10', envIntensity: 1 },
    scroll: { mode: 'turntable', speed: 1, range: [0, 1] },
  };
}

/** Read a scene3d node's settings with defaults merged (sparse persistence —
 *  pre-existing embeds keep today's exact behavior). */
export function scene3dSettingsOf(node: Pick<DomNode, 'scene'>): Scene3dSettings {
  const d = defaultScene3dSettings();
  const s = node.scene;
  if (!s) return d;
  return {
    model: { ...d.model, ...s.model },
    camera: { ...d.camera, ...s.camera },
    lighting: { ...d.lighting, ...s.lighting },
    environment: { ...d.environment, ...s.environment },
    scroll: { ...d.scroll, ...s.scroll },
  };
}

/** Self-contained component template subtree (children nested inline) —
 *  Phase 3, audit D-5 (01 ComponentSystem.md). */
export interface ComponentTemplateNode extends Omit<DomNode, 'children'> {
  children: ComponentTemplateNode[];
}

/** Reusable component definition: master template + name. Instances reference
 *  it via `DomNode.componentId`; sync is explicit ("update from instance"). */
export interface ComponentDef {
  id: string;
  name: string;
  root: ComponentTemplateNode;
}

/** Named design token (Phase 3 — audit D-6, 01 DesignTokens.md). Style values
 *  written as `$name` resolve to the token's value everywhere. */
export interface DesignToken {
  id: string;
  name: string;
  value: string | number;
}

/** Texture channel slots — values are asset ids (FR-140..142, 03 TexturePipeline). */
export interface MaterialMaps {
  map?: string;
  normalMap?: string;
  roughnessMap?: string;
  metalnessMap?: string;
  aoMap?: string;
  emissiveMap?: string;
}

export const MATERIAL_MAP_SLOTS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'emissiveMap',
] as const;
export type MaterialMapSlot = (typeof MATERIAL_MAP_SLOTS)[number];

/** UV transform applied to every texture slot of the material (goal.md §3). */
export interface MaterialUv {
  tiling?: [number, number];
  offset?: [number, number];
  rotation?: number;
}

/** Shared PBR material record (FR-140..142). Edits propagate to all linked
 *  meshes — duplication is the only fork mechanism (Doc 13 Part 4). */
export interface Material {
  id: string;
  name: string;
  baseColor: string;
  metallic: number;
  roughness: number;
  emissive: string;
  emissiveIntensity: number;
  opacity: number;
  /** texture channel slots (audit M-1) — undefined slot = no override */
  maps?: MaterialMaps;
  /** UV tiling/offset/rotation (audit M-2) */
  uv?: MaterialUv;
  /** extracted from a GLB import (audit S-2): the runtime edits the original
   *  GLTF material instance in place, keeping its embedded textures */
  imported?: boolean;
  /* ── advanced shading (Phase 3 — audit M-7, 03 Inspector/{ClearCoat,Refraction}) ──
     Optional so persisted pre-Phase-3 manifests stay valid; undefined on an
     imported record means "keep the GLB's own value". */
  clearcoat?: number;
  clearcoatRoughness?: number;
  /** physical transmission 0..1 (refraction) */
  transmission?: number;
  /** index of refraction (1..2.333) */
  ior?: number;
  /** transparency mode: default derives from opacity; 'blend' forces alpha
   *  blending; 'clip' uses alpha-test cutout at 0.5 */
  alphaMode?: 'opaque' | 'blend' | 'clip';
}

/** Asset record (FR-180..184): external to nodes, referenced by immutable id;
 *  replacement bumps `version`, never mutates content in place (Doc 13 Part 4). */
export interface AssetRecord {
  id: string;
  name: string;
  category: string;
  version: number;
  stats: string;
  usedBy: number;
  /** session-local object URL for imported files (never persisted) */
  url?: string;
  /* ── metadata model (Phase 2.10 — 06 Metadata.md, audit AS-6) ── */
  mime?: string;
  /** file size in bytes */
  size?: number;
  createdAt?: string;
  modifiedAt?: string;
  /* ── organization (Phase 2.10 — brief §5, audit AS-2) ── */
  folder?: string;
  tags?: string[];
  favorite?: boolean;
}

export interface SceneNode {
  id: string;
  label: string;
  type: 'mesh' | 'group' | 'camera' | 'light' | 'anchor';
  visible: boolean;
  locked: boolean;
  children: string[];
  transform: { position: number[]; rotation: number[]; scale: number[] };
  props?: Record<string, string | number | boolean>;
}

export interface Keyframe {
  t: number;
  v: number[];
  name?: string;
  ease?: 'linear' | 'smooth' | 'bezier';
  /** cubic-bezier control points [x1, y1, x2, y2] when ease === 'bezier'
   *  (Phase 2.5 — FR-152, 04 GraphEditor) */
  bezier?: [number, number, number, number];
}

export interface Track {
  id: string;
  label: string;
  target: string;
  channel: string;
  keyframes: Keyframe[];
  /** locked tracks are not editable in the Timeline Panel (04 TimelineEditor
   *  §2: lock is PERSISTED — unlike mute/solo, which stay transient) */
  locked?: boolean;
}

export interface Section {
  id: string;
  name: string;
  range: [number, number];
  rootDomNodeId: string;
}

/** DOM waypoint bound to a named 3D anchor (FR-160/161, PRD-F-08). */
export interface Waypoint {
  id: string;
  label: string;
  content: string;
  anchorId: string;
  direction: 'left' | 'right';
  clamp: boolean;
  /** progress band in which the waypoint is active */
  range: [number, number];
}

/** Named timeline marker (Phase 2.5 — brief §4, audit T-3). */
export interface Marker {
  id: string;
  label: string;
  t: number;
}

/** Scene environment settings (Phase 2.3 — 02 EnvironmentSystem, audit S-4/M-3). */
export interface EnvironmentSettings {
  /** HDR asset id used for image-based lighting (PMREM) — empty = none */
  hdrAssetId?: string;
  /** 'color' renders backgroundColor; 'hdr' renders the environment map */
  background: 'color' | 'hdr';
  backgroundColor: string;
  /** scene.environmentIntensity — material env response strength */
  envIntensity: number;
}

/** The scroll-driven 3D stage behind the page (issues.md): a first-class,
 *  selectable record so the DOM Studio's full-page Three.js scene appears in
 *  Layers and the Property Inspector like any other component. */
export interface SceneStage {
  label: string;
  visible: boolean;
  /** 'full' spans the whole page scroll; 'section' activates only inside one section's band */
  mode: 'full' | 'section';
  /** section whose scroll band gates the stage when mode === 'section' */
  sectionId?: string;
  /** 'background' renders behind the page content; 'overlay' renders above it */
  placement: 'background' | 'overlay';
  opacity: number;
}

export function defaultSceneStage(): SceneStage {
  return {
    label: '3D Scene · Scroll Stage',
    visible: true,
    mode: 'full',
    placement: 'background',
    opacity: 1,
  };
}

/** Published version snapshot (Phase 2.9 — 12 PublishStudio UI contract;
 *  versions are immutable, pointer flips only after smoke test — IL-4/IL-5). */
export interface PublishedVersion {
  version: number;
  at: string;
  summary: string;
}

export interface Manifest {
  schemaVersion: number;
  projectName: string;
  breakpoints: Record<DeviceProfile, { label: string; canvasWidth: number }>;
  sections: Section[];
  domNodes: Record<string, DomNode>;
  domRootOrder: string[];
  sceneNodes: Record<string, SceneNode>;
  sceneRootOrder: string[];
  waypoints: Waypoint[];
  tracks: Track[];
  materials: Record<string, Material>;
  assets: AssetRecord[];
  markers: Marker[];
  environment: EnvironmentSettings;
  /** the DOM Studio's scroll-driven 3D stage (issues.md) */
  stage: SceneStage;
  publishedVersions: PublishedVersion[];
  /** reusable components (Phase 3 — audit D-5) */
  components: Record<string, ComponentDef>;
  /** design tokens / variables (Phase 3 — audit D-6) */
  designTokens: DesignToken[];
}
