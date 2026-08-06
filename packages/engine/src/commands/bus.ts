/**
 * Command bus — manifest singleton + dispatch/undo/redo (WS2-3c, Doc 04 §3, FR-110/111, IL-1).
 * Physical move into @bs/engine (Plan 06 §3.4, WS2-1c completion). Behavior-identical (IL-11).
 *
 * - THE ONLY writer of manifest state (IL-1).
 * - Every command computes its inverse at apply time.
 * - Commands with equal coalesceKey arriving < 120 ms apart replace the stack
 *   head keeping the original inverse (a full drag = one undo step).
 */
import { pruneSelections } from '../store';
import {
  defaultSceneStage,
  type AssetRecord,
  type Manifest,
} from './types';

/* ---------------- Persistence hook (Plan 06 §3.4, no reverse packages→src) ----------------
 *
 * `@bs/engine` never imports from `src/`. Shell-level persistence
 * (IndexedDB, PostgreSQL draft sync) registers a hook at boot and the bus
 * fires it after every state-changing operation.
 *
 * Governed by: Plan 06 §3.4 (state architecture), IL-1, FR-112.
 */
type PersistenceHook = (getSnapshot: () => unknown) => void;
let persistenceHook: PersistenceHook | null = null;

/** Register a persistence hook. Idempotent — later calls replace the previous
 *  hook. Called from `src/engine/storage.ts` at boot (`main.tsx`). */
export function registerPersistenceHook(hook: PersistenceHook | null): void {
  persistenceHook = hook;
}

function schedulePersist(getSnapshot: () => unknown): void {
  if (persistenceHook) persistenceHook(getSnapshot);
}

let idCounter = 0;
export function newNodeId(prefix = 'node'): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export type Command =
  | { type: 'set'; path: string; value: unknown }
  | { type: 'delete'; path: string }
  | { type: 'batch'; commands: Command[] };

/* ---------------- Clean Blank Manifest Baseline ---------------- */

export function createBlankManifest(): Manifest {
  return {
    schemaVersion: 1,
    projectName: 'Untitled Project',
    breakpoints: {
      desktop: { label: 'Desktop (Base)', canvasWidth: 1160 },
      tablet: { label: 'Tablet', canvasWidth: 768 },
      mobile: { label: 'Mobile', canvasWidth: 375 },
    },
    sections: [],
    domRootOrder: [],
    domNodes: {},
    sceneRootOrder: [],
    sceneNodes: {},
    waypoints: [],
    tracks: [],
    materials: {},
    markers: [],
    assets: [],
    environment: {
      background: 'color',
      backgroundColor: '#0b0d10',
      envIntensity: 1,
    },
    stage: defaultSceneStage(),
    publishedVersions: [],
    components: {},
    designTokens: [],
  };
}

/* ---------------- State ---------------- */

/* Boot seed starts with clean blank canvas baseline; templates imported on demand from LeftRail. */
const manifest: Manifest = createBlankManifest();

function pruneManifestSelections(): void {
  pruneSelections({
    dom: (id: string) => id in manifest.domNodes,
    scene: (id: string) => id in manifest.sceneNodes,
    track: (id: string) => manifest.tracks.some((t) => t.id === id),
    waypoint: (id: string) => manifest.waypoints.some((w) => w.id === id),
    material: (id: string) => id in manifest.materials,
    asset: (id: string) => manifest.assets.some((a) => a.id === id),
  });
}

export function getManifest(): Manifest {
  return manifest;
}

/** Hydrate manifest from external snapshot (WS1 — ADR-005). */
export function hydrateManifest(saved: Record<string, unknown>, blobUrls?: Map<string, string>): void {
  const m = saved as unknown as Manifest;
  manifest.schemaVersion = m.schemaVersion ?? 1;
  manifest.projectName = m.projectName ?? 'Untitled Project';
  manifest.breakpoints = m.breakpoints ?? manifest.breakpoints;
  manifest.sections = m.sections ?? [];
  manifest.domRootOrder = m.domRootOrder ?? [];
  manifest.domNodes = m.domNodes ?? {};
  manifest.sceneRootOrder = m.sceneRootOrder ?? [];
  manifest.sceneNodes = m.sceneNodes ?? {};
  manifest.waypoints = m.waypoints ?? [];
  manifest.tracks = m.tracks ?? [];
  manifest.materials = m.materials ?? {};
  manifest.markers = m.markers ?? [];
  manifest.assets = (m.assets ?? []) as AssetRecord[];
  manifest.environment = m.environment ?? { background: 'color', backgroundColor: '#0b0d10', envIntensity: 1 };
  manifest.stage = m.stage ?? defaultSceneStage();
  manifest.publishedVersions = m.publishedVersions ?? [];
  manifest.components = m.components ?? {};
  manifest.designTokens = m.designTokens ?? [];

  if (blobUrls) {
    for (const a of manifest.assets) {
      const url = blobUrls.get(a.id);
      if (url) a.url = url;
    }
  }

  pruneManifestSelections();
  notifyManifestListeners();
}

/* ---------------- Listener Registry ---------------- */

const manifestListeners = new Set<() => void>();

export function subscribeManifest(fn: () => void): () => void {
  manifestListeners.add(fn);
  return () => {
    manifestListeners.delete(fn);
  };
}

export function notifyManifestListeners(): void {
  for (const fn of manifestListeners) fn();
}

/* ---------------- Command Execution Helpers ---------------- */

function setByPath(obj: Record<string, unknown>, path: string, value: unknown): unknown {
  const parts = path.split('.');
  let curr = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!(key in curr) || typeof curr[key] !== 'object' || curr[key] === null) {
      curr[key] = {};
    }
    curr = curr[key] as Record<string, unknown>;
  }
  const lastKey = parts[parts.length - 1];
  const old = curr[lastKey];
  if (value === undefined) {
    delete curr[lastKey];
  } else {
    curr[lastKey] = typeof value === 'object' && value !== null ? structuredClone(value) : value;
  }
  return typeof old === 'object' && old !== null ? structuredClone(old) : old;
}

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let curr: unknown = obj;
  for (const part of parts) {
    if (curr === null || typeof curr !== 'object') return undefined;
    curr = (curr as Record<string, unknown>)[part];
  }
  return curr === undefined ? undefined : structuredClone(curr);
}

function applyCommand(cmd: Command): () => void {
  if (cmd.type === 'set') {
    const prev = getByPath(manifest as unknown as Record<string, unknown>, cmd.path);
    const hasPrev = prev !== undefined;
    setByPath(manifest as unknown as Record<string, unknown>, cmd.path, cmd.value);
    return () => {
      if (hasPrev) {
        setByPath(manifest as unknown as Record<string, unknown>, cmd.path, prev);
      } else {
        setByPath(manifest as unknown as Record<string, unknown>, cmd.path, undefined);
      }
    };
  } else if (cmd.type === 'delete') {
    const prev = getByPath(manifest as unknown as Record<string, unknown>, cmd.path);
    setByPath(manifest as unknown as Record<string, unknown>, cmd.path, undefined);
    return () => {
      setByPath(manifest as unknown as Record<string, unknown>, cmd.path, prev);
    };
  } else if (cmd.type === 'batch') {
    const reverses = cmd.commands.map(applyCommand);
    return () => {
      for (let i = reverses.length - 1; i >= 0; i--) reverses[i]();
    };
  }
  return () => {};
}

/* ---------------- History Stack (Undo / Redo) ---------------- */

const MAX_HISTORY = 200;

interface UndoStep {
  forward: () => void;
  backward: () => void;
  coalesceKey?: string;
  timestamp: number;
}

const undoStack: UndoStep[] = [];
const redoStack: UndoStep[] = [];

export function canUndo(): boolean {
  return undoStack.length > 0;
}

export function canRedo(): boolean {
  return redoStack.length > 0;
}

export function dispatch(
  cmdOrStep: Command | { forward: () => void; backward: () => void; coalesceKey?: string },
  coalesceKey?: string,
): void {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let step: UndoStep;

  if ('forward' in cmdOrStep) {
    step = { ...cmdOrStep, timestamp: now };
    cmdOrStep.forward();
  } else {
    let reverseFn: (() => void) | null = null;
    const applyFn = () => {
      reverseFn = applyCommand(cmdOrStep);
    };
    applyFn();
    step = {
      forward: applyFn,
      backward: () => {
        if (reverseFn) reverseFn();
      },
      coalesceKey: coalesceKey ?? ('coalesceKey' in cmdOrStep ? (cmdOrStep as { coalesceKey?: string }).coalesceKey : undefined),
      timestamp: now,
    };
  }

  if (
    step.coalesceKey &&
    undoStack.length > 0 &&
    undoStack[undoStack.length - 1].coalesceKey === step.coalesceKey &&
    now - undoStack[undoStack.length - 1].timestamp < 120
  ) {
    const prev = undoStack[undoStack.length - 1];
    undoStack[undoStack.length - 1] = {
      forward: step.forward,
      backward: prev.backward,
      coalesceKey: step.coalesceKey,
      timestamp: now,
    };
    redoStack.length = 0;
    pruneManifestSelections();
    schedulePersist(getManifest);
    notifyManifestListeners();
    return;
  }

  undoStack.push(step);
  if (undoStack.length > MAX_HISTORY) undoStack.shift();

  redoStack.length = 0;
  pruneManifestSelections();
  schedulePersist(getManifest);
  notifyManifestListeners();
}

export function dispatchBatch(commands: Command[], coalesceKey?: string): void {
  const reverses: Array<() => void> = [];
  dispatch({
    forward: () => {
      for (const cmd of commands) {
        reverses.push(applyCommand(cmd));
      }
    },
    backward: () => {
      for (let i = reverses.length - 1; i >= 0; i--) {
        reverses[i]();
      }
    },
    coalesceKey,
  });
}

export function undo(): void {
  const step = undoStack.pop();
  if (!step) return;
  step.backward();
  redoStack.push(step);
  pruneManifestSelections();
  schedulePersist(getManifest);
  notifyManifestListeners();
}

export function redo(): void {
  const step = redoStack.pop();
  if (!step) return;
  step.forward();
  undoStack.push(step);
  pruneManifestSelections();
  schedulePersist(getManifest);
  notifyManifestListeners();
}

/** Clear undo/redo history (e.g. on new project creation or template import). */
export function clearHistory(): void {
  undoStack.length = 0;
  redoStack.length = 0;
}
