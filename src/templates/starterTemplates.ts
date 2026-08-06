/**
 * Genesis Blueprints Registry & Factory (Build Studio - The Foundry).
 *
 * Provides official Genesis Blueprints (3D Product Showcase, Interactive Landing, Blank Canvas)
 * and the clean default project baseline generator.
 */
import { seedManifest } from '@bs/services/seed';
import { syncDraft } from '@bs/services';
import { createBlankManifest, hydrateManifest, getManifest, defaultSceneStage, type Manifest } from '@bs/engine';
import { schedulePersist } from '../engine/storage';
import { setUIState } from '@bs/engine';
import { getCloudStatus } from '../engine/cloudStatus';

;

export interface StarterTemplate {
  id: string;
  name: string;
  category: 'Showcase' | 'Landing' | 'Starter';
  description: string;
  sectionsCount: number;
  has3D: boolean;
  badge: string;
  getManifest: () => Manifest;
}

/** 3D Interactive Web Landing Template. */
function createInteractiveLandingManifest(): Manifest {
  return {
    schemaVersion: 1,
    projectName: 'Interactive 3D Web Landing',
    breakpoints: {
      desktop: { label: 'Desktop (Base)', canvasWidth: 1160 },
      tablet: { label: 'Tablet', canvasWidth: 768 },
      mobile: { label: 'Mobile', canvasWidth: 375 },
    },
    sections: [
      { id: 'sec-land-1', name: '01  * Hero', range: [0, 0.33], rootDomNodeId: 'land-hero-root' },
      { id: 'sec-land-2', name: '02  * Features', range: [0.33, 0.66], rootDomNodeId: 'land-feat-root' },
      { id: 'sec-land-3', name: '03  * Showcase', range: [0.66, 1], rootDomNodeId: 'land-show-root' },
    ],
    domRootOrder: ['land-hero-root', 'land-feat-root', 'land-show-root'],
    domNodes: {
      'land-hero-root': {
        id: 'land-hero-root',
        type: 'section',
        tag: 'section',
        label: 'Section  * Hero',
        children: ['land-hero-title', 'land-hero-sub'],
        style: { padding: 64, gap: 16, background: 'rgba(13,20,32,0.45)', color: '#f2f5fa', textAlign: 'center' },
        overrides: {},
      },
      'land-hero-title': {
        id: 'land-hero-title',
        type: 'heading',
        tag: 'h1',
        label: 'H1  * Landing Title',
        content: 'Next-Gen 3D Web Digital Experiences',
        children: [],
        style: { fontSize: 52, fontWeight: 700, fontFamily: 'Space Grotesk', color: '#f2f5fa', textAlign: 'center' },
        overrides: {},
      },
      'land-hero-sub': {
        id: 'land-hero-sub',
        type: 'paragraph',
        tag: 'p',
        label: 'P  * Subtitle',
        content: 'Combine interactive Three.js 3D elements with responsive web design.',
        children: [],
        style: { fontSize: 18, color: '#9aa5b8', textAlign: 'center' },
        overrides: {},
      },
      'land-feat-root': {
        id: 'land-feat-root',
        type: 'section',
        tag: 'section',
        label: 'Section  * Features',
        children: ['land-feat-title'],
        style: { padding: 64, gap: 16, background: 'rgba(18,26,41,0.5)', color: '#f2f5fa', textAlign: 'center' },
        overrides: {},
      },
      'land-feat-title': {
        id: 'land-feat-title',
        type: 'heading',
        tag: 'h2',
        label: 'H2  * Features Title',
        content: 'Engineered for Performance & Aesthetics',
        children: [],
        style: { fontSize: 36, fontWeight: 600, color: '#00e5ff', textAlign: 'center' },
        overrides: {},
      },
      'land-show-root': {
        id: 'land-show-root',
        type: 'section',
        tag: 'section',
        label: 'Section  * Showcase',
        children: ['land-show-title'],
        style: { padding: 64, gap: 16, background: 'rgba(13,20,32,0.45)', color: '#f2f5fa', textAlign: 'center' },
        overrides: {},
      },
      'land-show-title': {
        id: 'land-show-title',
        type: 'heading',
        tag: 'h2',
        label: 'H2  * Showcase Title',
        content: 'Real-time 3D Scene DOMViewportControls',
        children: [],
        style: { fontSize: 36, fontWeight: 600, color: '#f2f5fa', textAlign: 'center' },
        overrides: {},
      },
    },
    sceneRootOrder: ['land-cube-1'],
    sceneNodes: {
      'land-cube-1': {
        id: 'land-cube-1',
        label: 'Interactive Cube Stage',
        type: 'mesh',
        visible: true,
        locked: false,
        transform: { position: [0, 0.5, 0], rotation: [0, 0.4, 0], scale: [1.2, 1.2, 1.2] },
        props: { primitive: 'box', castShadow: true },
        children: [],
      },
    },
    waypoints: [],
    tracks: [
      {
        id: 'land-rot-trk',
        label: 'Stage Rotation',
        target: 'land-cube-1',
        channel: 'rotationY',
        keyframes: [
          { t: 0, v: [0], ease: 'linear' },
          { t: 1, v: [3.14159 * 2], ease: 'linear' },
        ],
      },
    ],
    materials: {},
    markers: [],
    assets: [],
    environment: { background: 'color', backgroundColor: '#0b0d10', envIntensity: 1 },
    stage: defaultSceneStage(),
    publishedVersions: [],
    components: {},
    designTokens: [],
  };
}

/** Official Genesis Blueprints Registry. */
export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: '3d-product-showcase',
    name: 'Genesis Blueprint  * Apex Showcase',
    category: 'Showcase',
    description: 'Immersive 3D product showcase with scroll-driven camera path, material controls, and DOM overlay sections.',
    sectionsCount: 3,
    has3D: true,
    badge: 'FEATURED',
    getManifest: () => structuredClone(seedManifest) as unknown as Manifest,
  },
  {
    id: 'interactive-landing',
    name: 'Genesis Blueprint  * Landing Experience',
    category: 'Landing',
    description: 'Modern 3-section responsive landing with floating Apex Render Stage, hero typography, and scroll animations.',
    sectionsCount: 3,
    has3D: true,
    badge: 'POPULAR',
    getManifest: () => createInteractiveLandingManifest(),
  },
  {
    id: 'blank-canvas',
    name: 'Genesis Blueprint  * Clean Slate',
    category: 'Starter',
    description: 'Fresh Spatial Canvas baseline with zero dummy data. Ideal for building bespoke experiences from scratch.',
    sectionsCount: 1,
    has3D: false,
    badge: 'CLEAN SLATE',
    getManifest: () => createBlankManifest(),
  },
];

/** Import a template into the active DOM & 3D workspace. */
export function importStarterTemplate(templateId: string): { success: boolean; message: string } {
  const tpl = STARTER_TEMPLATES.find((t) => t.id === templateId) ?? STARTER_TEMPLATES[0];
  const manifestData = tpl.getManifest();
  
  // 1. Hydrate the manifest singleton in memory
  hydrateManifest(manifestData as unknown as Record<string, unknown>);
  
  // 2. Reset selection & sync UI state
  const firstRootId = manifestData.domRootOrder[0] ?? null;
  setUIState({
    selectedDomNodeId: firstRootId,
    selectedSceneNodeId: null,
    selectedMaterialId: null,
    mode: 'dom',
  });
  
  // 3. Persist imported project snapshot to IndexedDB (local storage buffer)
  schedulePersist(getManifest);

  // 4. Synchronize imported template manifest to PostgreSQL cloud database (if PostgreSQL is online)
  try {
    const cloud = getCloudStatus();
    if (cloud.mode === 'postgresql') {
      syncDraft(manifestData as unknown as Record<string, unknown>);
    }
  } catch (e) {
    console.warn('[templates] PostgreSQL draft sync error:', e);
  }
  
  return {
    success: true,
    message: `${tpl.name} template imported   " ${tpl.sectionsCount} sections, DOM hierarchy, and 3D stage ready!`,
  };
}
