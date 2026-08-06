/**
 * @engine/commands barrel — re-exports the full public surface of the command
 * engine from its per-domain modules (WS2-3c strangler-fig, IL-11).
 *
 * Import from this file OR from the top-level `../commands` shim — both resolve
 * to the same singletons. Consumers already importing `'../engine/commands'`
 * continue to work unchanged; new code should import from this barrel directly.
 */

// Core bus (manifest state + dispatch/undo/redo)
export {
  canRedo,
  canUndo,
  clearHistory,
  createBlankManifest,
  dispatch,
  dispatchBatch,
  getManifest,
  hydrateManifest,
  newNodeId,
  notifyManifestListeners,
  redo,
  subscribeManifest,
  undo,
  type Command,
} from './bus';

// Manifest types
export {
  MATERIAL_MAP_SLOTS,
  defaultScene3dSettings,
  defaultSceneStage,
  scene3dSettingsOf,
  type AssetRecord,
  type ComponentDef,
  type ComponentTemplateNode,
  type DesignToken,
  type DomNode,
  type EnvironmentSettings,
  type Keyframe,
  type Manifest,
  type Marker,
  type Material,
  type MaterialMapSlot,
  type MaterialMaps,
  type MaterialUv,
  type PublishedVersion,
  type SceneNode,
  type Scene3dSettings,
  type SceneStage,
  type Section,
  type StyleBlock,
  type Track,
  type Waypoint,
} from './types';

// DOM domain
export {
  addDesignToken,
  addDomNode,
  addSection,
  addWaypoint,
  clearOverride,
  componentInstances,
  createComponentFromNode,
  detachComponentInstance,
  duplicateDomNode,
  duplicateSection,
  findDomParent,
  hasOverride,
  instantiateComponent,
  moveDomNode,
  moveDomNodeBeside,
  removeComponentDef,
  removeDomNode,
  removeDesignToken,
  removeSection,
  removeWaypoint,
  reorderSections,
  resolveStyle,
  resolveTokenValue,
  setDesignTokenProp,
  setScene3dSetting,
  setStyleValue,
  setStageProp,
  setWaypointProp,
  updateComponentFromInstance,
} from './dom';

// Scene domain
export {
  addSceneNode,
  duplicateSceneNode,
  eulerFromQuat,
  findSceneParent,
  groupSceneNode,
  moveSceneNode,
  moveSceneNodeBeside,
  quatFromEuler,
  quatMultiply,
  registerImportedScene,
  removeSceneNode,
  rotateVecByQuat,
  setActiveCamera,
  setEnvironmentProp,
  ungroupSceneNode,
} from './scene';

// Material domain
export {
  addMaterial,
  deleteMaterial,
  duplicateMaterial,
  materialUsedBy,
  setMaterialMap,
  setMaterialProp,
  setMaterialUv,
} from './material';

// Asset domain
export {
  addAsset,
  addAssets,
  assetFolders,
  assetUsedBy,
  deleteAsset,
  deleteAssets,
  duplicateAsset,
  renameAsset,
  replaceAsset,
  replaceAssetWithFile,
  setAssetProps,
  setAssetsProps,
} from './asset';

// Timeline domain
export {
  addMarker,
  addTrack,
  deleteKeyframe,
  duplicateTrack,
  getKeyframeName,
  getTrack,
  removeMarker,
  removeTrack,
  renameKeyframe,
  renameTrack,
  setMarkerProp,
  setTrackKeyframes,
  setTrackLocked,
  updateKeyframe,
} from './timeline';
