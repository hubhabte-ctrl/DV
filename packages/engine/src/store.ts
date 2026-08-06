/**
 * Lightweight UI store (Zustand-class, dependency-free).
 * Holds *editor UI state only* — mode, selection, profile, save chip.
 * Manifest state lives exclusively in the command engine (Doc 04 §8).
 */
import { useSyncExternalStore } from 'react';

export type EditorMode = 'dom' | '3d' | 'material' | 'assets' | 'animate' | 'preview';
export type DeviceProfile = 'desktop' | 'tablet' | 'mobile';
export type SaveState = 'Saved' | 'Saving' | 'Unsaved' | 'Offline' | 'Save failed';
export type TransformTool = 'select' | 'translate' | 'rotate' | 'scale';

export interface UIState {
  mode: EditorMode;
  profile: DeviceProfile;
  saveState: SaveState;
  /** anchor (last-selected) — kept in sync with the plural arrays below */
  selectedDomNodeId: string | null;
  selectedSceneNodeId: string | null;
  /** multi-selection model v2 (01 SelectionSystem; audit A-3):
   *  plural arrays hold the full selection; the singular fields are the anchor */
  selectedDomNodeIds: string[];
  selectedSceneNodeIds: string[];
  selectedTrackId: string | null;
  selectedWaypointId: string | null;
  /** the scroll-driven 3D stage is selected in the DOM Studio Layers panel
   *  (issues.md) — mutually exclusive with DOM node/waypoint selection */
  stageSelected: boolean;
  selectedMaterialId: string | null;
  selectedAssetId: string | null;
  /** active category filter in the Asset Studio (Phase 2.10) */
  selectedAssetCategory: string;
  /** bulk asset selection (Phase 2.10 — audit AS-2); anchor = selectedAssetId */
  selectedAssetIds: string[];
  /** selected keyframe identified by (track, t) — indices shift when sorted */
  selectedKeyframeT: number | null;
  /** Animation Studio Timeline Panel mode: graph editor replaces the dope
   *  sheet in place (Spec 07 §5, toggle `G`) — transient UI state (FR-123) */
  timelineGraphMode: boolean;
  /** transient per-track mute/solo (04 TimelineEditor §2/§6: evaluation skips,
   *  NEVER persisted to the manifest — AC-2 schema audit) */
  mutedTrackIds: string[];
  soloTrackIds: string[];
  inspectorSearch: string;
  qualityLevel: 'High' | 'Medium' | 'Low';
  tool: TransformTool;
  space: 'world' | 'local';
  paletteOpen: boolean;
  /** DOM canvas zoom factor 0.1–4 (Phase 1.5, 01 CanvasEngine) — transient
   *  viewport state, never persisted (FR-123) */
  canvasZoom: number;
  /* ── panel sizing (Phase 3 — audit U-7): resizable + collapsible side
     panels; transient editor state like zoom (FR-123) ── */
  theme: 'dark' | 'light';
  leftRailW: number;
  inspectorW: number;
  timelineH: number;
  leftRailCollapsed: boolean;
  inspectorCollapsed: boolean;
  timelineCollapsed: boolean;
  conflictVersion: number | null;
  /* ── Designer Workspace settings (FR-123) ── */
  showGrid: boolean;
  showRulers: boolean;
  showGuides: boolean;
  snapToGrid: boolean;
  snapToElements: boolean;
}

let state: UIState = {
  mode: 'dom',
  profile: 'desktop',
  saveState: 'Saved',
  selectedDomNodeId: null,
  selectedSceneNodeId: null,
  selectedDomNodeIds: [],
  conflictVersion: null,
  selectedSceneNodeIds: [],
  selectedTrackId: null,
  selectedWaypointId: null,
  stageSelected: false,
  selectedMaterialId: null,
  selectedAssetId: null,
  selectedAssetCategory: 'All',
  selectedAssetIds: [],
  selectedKeyframeT: null,
  timelineGraphMode: false,
  mutedTrackIds: [],
  soloTrackIds: [],
  inspectorSearch: '',
  qualityLevel: 'High',
  tool: 'select',
  space: 'world',
  paletteOpen: false,
  canvasZoom: 1,
  theme: 'dark',
  leftRailW: 340, /* T4.5: SSOT --rail-w (64px) + --layers-w (276px) = 340px */
  inspectorW: 340, /* SSOT --insp-w (340px) — see MIN_INSPECTOR_W */
  timelineH: 160,
  leftRailCollapsed: false,
  inspectorCollapsed: false,
  timelineCollapsed: false,
  showGrid: true,
  showRulers: true,
  showGuides: true,
  snapToGrid: true,
  snapToElements: true,
};

export function toggleTheme(): void {
  const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
  // Single-writer rule (Spec 07 §2 / Plan 06 RC-7): applyTokens() is the only
  // writer of `data-theme` — TopBar's theme effect re-applies tokens on change.
  setUIState({ theme: nextTheme });
}

export function toggleGrid(): void {
  setUIState({ showGrid: !state.showGrid });
}

export function toggleRulers(): void {
  setUIState({ showRulers: !state.showRulers });
}

export function toggleGuides(): void {
  setUIState({ showGuides: !state.showGuides });
}

export function toggleSnapToGrid(): void {
  setUIState({ snapToGrid: !state.snapToGrid });
}

export function toggleSnapToElements(): void {
  setUIState({ snapToElements: !state.snapToElements });
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

export function setCanvasZoom(zoom: number): void {
  setUIState({ canvasZoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) });
}

/* Panel sizing (Phase 3 — audit U-7): clamped so the workspace never collapses. */
export const MIN_PANEL_W = 200;
export const MAX_PANEL_W = 480;

/* The SSOT inspector width: `--insp-w: 340px`
   (`UI_UX_reference/src/design-system/tokens/spacing.css:31`, mirrored in
   `packages/ui-kit/src/tokens/tokens.css:419`). The reference shell renders
   the inspector as a FIXED `var(--insp-w)` grid track, so every inspector
   layout in the design system — field rows, the segmented control, the
   material card grid — is drawn against exactly this width and none of them
   define behaviour below it.

   Production makes the panel drag-resizable, so that floor has to be enforced
   here instead of by a fixed track. It is a MINIMUM, not a default: below it
   the material grid drops to one column and the tab row wraps, which is the
   collapse reported against the 220px floor this replaces. */
export const MIN_INSPECTOR_W = 340;
export const MAX_INSPECTOR_W = 520;
export const MIN_LEFT_RAIL_W = 340;
export const MAX_LEFT_RAIL_W = 480;

export function setPanelWidth(panel: 'leftRail' | 'inspector', width: number): void {
  /* Delegates to the same per-panel bounds as `setPanelDimension` — these two
     entry points previously carried independent limits (200/480 here vs
     220/520 and 180/480 there), so a caller could seat a width one path
     considered legal and the other did not. */
  const w = Math.round(width);
  if (panel === 'leftRail') {
    setUIState({
      leftRailW: Math.min(MAX_LEFT_RAIL_W, Math.max(MIN_LEFT_RAIL_W, w)),
      leftRailCollapsed: false,
    });
  } else {
    setUIState({
      inspectorW: Math.min(MAX_INSPECTOR_W, Math.max(MIN_INSPECTOR_W, w)),
      inspectorCollapsed: false,
    });
  }
}

const listeners = new Set<() => void>();

export function getUIState(): UIState {
  return state;
}

/** Imperative UI-state subscription for non-React consumers (e.g. the
 *  viewport runtime reacting to transient mute/solo — 04 TimelineEditor §2). */
export function subscribeUIState(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/* ── transient track audibility (04 TimelineEditor §2/§6: mute = evaluation
   skips; solo wins over mute; neither ever appears in the manifest) ── */

export function isTrackAudible(trackId: string): boolean {
  if (state.soloTrackIds.length > 0) return state.soloTrackIds.includes(trackId);
  return !state.mutedTrackIds.includes(trackId);
}

export function toggleTrackMute(trackId: string): void {
  const muted = state.mutedTrackIds.includes(trackId)
    ? state.mutedTrackIds.filter((id) => id !== trackId)
    : [...state.mutedTrackIds, trackId];
  setUIState({ mutedTrackIds: muted });
}

export function toggleTrackSolo(trackId: string): void {
  const solo = state.soloTrackIds.includes(trackId)
    ? state.soloTrackIds.filter((id) => id !== trackId)
    : [...state.soloTrackIds, trackId];
  setUIState({ soloTrackIds: solo });
}

export function setUIState(patch: Partial<UIState>): void {
  const p = { ...patch };
  // stage selection is exclusive with DOM node/waypoint selection (issues.md)
  if (p.stageSelected) {
    p.selectedDomNodeId = null;
    p.selectedDomNodeIds = [];
    p.selectedWaypointId = null;
  } else if ((p.selectedDomNodeId || p.selectedWaypointId) && !('stageSelected' in p)) {
    p.stageSelected = false;
  }
  // single-select remains the trivial case of the multi-select model:
  // setting the anchor alone resets the plural array to match
  if ('selectedDomNodeId' in p && !('selectedDomNodeIds' in p)) {
    p.selectedDomNodeIds = p.selectedDomNodeId ? [p.selectedDomNodeId] : [];
  }
  if ('selectedSceneNodeId' in p && !('selectedSceneNodeIds' in p)) {
    p.selectedSceneNodeIds = p.selectedSceneNodeId ? [p.selectedSceneNodeId] : [];
  }
  if ('selectedAssetId' in p && !('selectedAssetIds' in p)) {
    p.selectedAssetIds = p.selectedAssetId ? [p.selectedAssetId] : [];
  }
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}

/** Additive (Ctrl/Shift-click) DOM selection toggle; anchor = last added. */
export function toggleDomSelection(id: string): void {
  const ids = state.selectedDomNodeIds.includes(id)
    ? state.selectedDomNodeIds.filter((x) => x !== id)
    : [...state.selectedDomNodeIds, id];
  setUIState({ selectedDomNodeIds: ids, selectedDomNodeId: ids[ids.length - 1] ?? null });
}

/** Additive (Ctrl/Shift-click) scene selection toggle; anchor = last added. */
export function toggleSceneSelection(id: string): void {
  const ids = state.selectedSceneNodeIds.includes(id)
    ? state.selectedSceneNodeIds.filter((x) => x !== id)
    : [...state.selectedSceneNodeIds, id];
  setUIState({ selectedSceneNodeIds: ids, selectedSceneNodeId: ids[ids.length - 1] ?? null });
}

/** Additive (Ctrl/Shift-click) asset selection toggle (Phase 2.10 — AS-2). */
export function toggleAssetSelection(id: string): void {
  const ids = state.selectedAssetIds.includes(id)
    ? state.selectedAssetIds.filter((x) => x !== id)
    : [...state.selectedAssetIds, id];
  setUIState({ selectedAssetIds: ids, selectedAssetId: ids[ids.length - 1] ?? null });
}

/** Validity predicates supplied by the command engine (it owns the manifest). */
export interface SelectionValidators {
  dom(id: string): boolean;
  scene(id: string): boolean;
  track(id: string): boolean;
  waypoint(id: string): boolean;
  material(id: string): boolean;
  asset(id: string): boolean;
}

/** Drop selections whose targets no longer exist (undo/redo/delete safety —
 *  audit A-10). Called by the command engine after every manifest change. */
export function pruneSelections(v: SelectionValidators): void {
  const patch: Partial<UIState> = {};
  const domIds = state.selectedDomNodeIds.filter(v.dom);
  if (domIds.length !== state.selectedDomNodeIds.length) {
    patch.selectedDomNodeIds = domIds;
    patch.selectedDomNodeId =
      state.selectedDomNodeId && v.dom(state.selectedDomNodeId)
        ? state.selectedDomNodeId
        : (domIds[domIds.length - 1] ?? null);
  }
  const sceneIds = state.selectedSceneNodeIds.filter(v.scene);
  if (sceneIds.length !== state.selectedSceneNodeIds.length) {
    patch.selectedSceneNodeIds = sceneIds;
    patch.selectedSceneNodeId =
      state.selectedSceneNodeId && v.scene(state.selectedSceneNodeId)
        ? state.selectedSceneNodeId
        : (sceneIds[sceneIds.length - 1] ?? null);
  }
  if (state.selectedTrackId && !v.track(state.selectedTrackId)) {
    patch.selectedTrackId = null;
    patch.selectedKeyframeT = null;
  }
  const muted = state.mutedTrackIds.filter(v.track);
  if (muted.length !== state.mutedTrackIds.length) patch.mutedTrackIds = muted;
  const solo = state.soloTrackIds.filter(v.track);
  if (solo.length !== state.soloTrackIds.length) patch.soloTrackIds = solo;
  if (state.selectedWaypointId && !v.waypoint(state.selectedWaypointId)) {
    patch.selectedWaypointId = null;
  }
  if (state.selectedMaterialId && !v.material(state.selectedMaterialId)) {
    patch.selectedMaterialId = null;
  }
  const assetIds = state.selectedAssetIds.filter(v.asset);
  if (assetIds.length !== state.selectedAssetIds.length) {
    patch.selectedAssetIds = assetIds;
    patch.selectedAssetId =
      state.selectedAssetId && v.asset(state.selectedAssetId)
        ? state.selectedAssetId
        : (assetIds[assetIds.length - 1] ?? null);
  } else if (state.selectedAssetId && !v.asset(state.selectedAssetId)) {
    patch.selectedAssetId = null;
  }
  if (Object.keys(patch).length > 0) setUIState(patch);
}

export function useUIState<T>(selector: (s: UIState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
  );
}

export function setPanelDimension(side: 'leftRail' | 'inspector' | 'timeline', size: number): void {
  if (side === 'leftRail') {
    const clamped = Math.max(MIN_LEFT_RAIL_W, Math.min(MAX_LEFT_RAIL_W, size));
    setUIState({ leftRailW: clamped, leftRailCollapsed: false });
  } else if (side === 'inspector') {
    /* Floor is the SSOT `--insp-w` (340px) — see `MIN_INSPECTOR_W`. */
    const clamped = Math.max(MIN_INSPECTOR_W, Math.min(MAX_INSPECTOR_W, size));
    setUIState({ inspectorW: clamped, inspectorCollapsed: false });
  } else if (side === 'timeline') {
    /* Animation Studio hero surface (Spec 07 §5): resizable up to 70% of the
       viewport — the timeline is the primary surface, the viewport above is
       the monitor. Fallback max keeps tests/SSR deterministic. */
    const maxH = typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.7) : 600;
    const clamped = Math.max(120, Math.min(maxH, size));
    setUIState({ timelineH: clamped, timelineCollapsed: false });
  }
}

export function togglePanelCollapsed(side: 'leftRail' | 'inspector' | 'timeline'): void {
  if (side === 'leftRail') {
    setUIState({ leftRailCollapsed: !state.leftRailCollapsed });
  } else if (side === 'inspector') {
    setUIState({ inspectorCollapsed: !state.inspectorCollapsed });
  } else if (side === 'timeline') {
    setUIState({ timelineCollapsed: !state.timelineCollapsed });
  }
}
