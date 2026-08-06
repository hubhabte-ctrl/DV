/**
 * Scroll-driven 3D scene integration regression tests (issues.md   " IL-11):
 *  - the stage is a first-class manifest record (Layers/Inspector contract);
 *  - scene3d embeds carry independent per-instance settings;
 *  - stage selection is exclusive with DOM node/waypoint selection.
 * Tests undo their changes so the singleton seed state stays untouched.
 */
// @ts-ignore
import { beforeAll, describe, expect, it } from 'vitest';
import { seedManifest, seedAssets } from '@bs/services/seed';
import { hydrateManifest } from '@bs/engine';

beforeAll(() => {
  const m = structuredClone(seedManifest) as Record<string, unknown>;
  m.assets = structuredClone(seedAssets.assets);
  hydrateManifest(m);
});

import {
  addDomNode,
  defaultScene3dSettings,
  defaultSceneStage,
  getManifest,
  newNodeId,
  redo,
  removeDomNode,
  scene3dSettingsOf,
  setScene3dSetting,
  setStageProp,
  undo,
  type DomNode,
} from '@bs/engine';
import { getUIState, setUIState } from '@bs/engine';

function makeScene3dNode(assetId?: string): DomNode {
  return {
    id: newNodeId('scene3d'),
    type: 'scene3d',
    tag: 'div',
    label: '3D  * test',
    children: [],
    style: { position: 'absolute', left: 0, top: 0, width: 420, height: 300, zIndex: 2 },
    overrides: {},
    assetId,
    scene: defaultScene3dSettings(),
  };
}

describe('scroll stage record (issues.md   " Layers/Inspector contract)', () => {
  it('seeds a default stage on the manifest', () => {
    const stage = getManifest().stage;
    expect(stage).toBeDefined();
    expect(stage.visible).toBe(true);
    expect(stage.mode).toBe('full');
    expect(stage.placement).toBe('background');
    expect(defaultSceneStage().mode).toBe('full');
  });

  it('setStageProp writes through the command engine and round-trips undo/redo', () => {
    const m = getManifest();
    setStageProp('mode', 'section');
    expect(m.stage.mode).toBe('section');
    setStageProp('placement', 'overlay');
    expect(m.stage.placement).toBe('overlay');
    undo();
    expect(m.stage.placement).toBe('background');
    redo();
    expect(m.stage.placement).toBe('overlay');
    undo(); // placement back
    undo(); // mode back
    expect(m.stage.mode).toBe('full');
    expect(m.stage.placement).toBe('background');
  });
});

describe('scene3d embed instances (issues.md   " independent instances)', () => {
  it('two embeds of the SAME asset keep independent settings', () => {
    const m = getManifest();
    const parentId = m.domRootOrder[0];
    const a = makeScene3dNode('asset-shared');
    const b = makeScene3dNode('asset-shared');
    addDomNode(parentId, a, 0);
    addDomNode(parentId, b, 1);
    expect(a.id).not.toBe(b.id); // unique id per drop
    setScene3dSetting(a.id, 'camera', 'fov', 75);
    expect(scene3dSettingsOf(m.domNodes[a.id]).camera.fov).toBe(75);
    // instance B is untouched   " settings never shared through the asset
    expect(scene3dSettingsOf(m.domNodes[b.id]).camera.fov).toBe(38);
    undo(); // fov
    expect(scene3dSettingsOf(m.domNodes[a.id]).camera.fov).toBe(38);
    removeDomNode(b.id);
    removeDomNode(a.id);
    undo();
    undo();
    undo();
    undo(); // restore seed (2 removes + 2 adds)
    expect(m.domNodes[a.id]).toBeUndefined();
    expect(m.domNodes[b.id]).toBeUndefined();
  });

  it('scene3dSettingsOf merges defaults for sparse/legacy nodes', () => {
    const legacy = { scene: undefined } as Pick<DomNode, 'scene'>;
    const merged = scene3dSettingsOf(legacy);
    expect(merged.scroll.mode).toBe('turntable');
    expect(merged.scroll.range).toEqual([0, 1]);
    expect(merged.environment.background).toBe('transparent');
    const partial = scene3dSettingsOf({
      scene: { scroll: { mode: 'static' } } as unknown as DomNode['scene'],
    });
    expect(partial.scroll.mode).toBe('static');
    expect(partial.camera.fov).toBe(38); // untouched groups fall back
  });

  it('setScene3dSetting refuses non-scene3d targets', () => {
    const m = getManifest();
    const anyText = Object.values(m.domNodes).find((n) => n.type !== 'scene3d');
    expect(anyText).toBeDefined();
    setScene3dSetting(anyText!.id, 'camera', 'fov', 99);
    expect(anyText!.scene).toBeUndefined();
  });
});

describe('stage selection exclusivity (store)', () => {
  it('selecting the stage clears DOM node/waypoint selection and vice versa', () => {
    setUIState({ selectedDomNodeId: 'intro-title' });
    setUIState({ stageSelected: true });
    let s = getUIState();
    expect(s.stageSelected).toBe(true);
    expect(s.selectedDomNodeId).toBeNull();
    expect(s.selectedDomNodeIds).toEqual([]);
    setUIState({ selectedDomNodeId: 'intro-title' });
    s = getUIState();
    expect(s.stageSelected).toBe(false);
    expect(s.selectedDomNodeId).toBe('intro-title');
    setUIState({ selectedDomNodeId: null }); // leave a clean slate
  });
});
