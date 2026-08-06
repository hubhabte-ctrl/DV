/**
 * Phase 2 test-debt + Phase 3 regression tests (IL-11, Doc 08).
 * Covers: removeSection/duplicateSection (2.7), markers (2.5), asset
 * organization batches (2.10), environment (2.3), keyframe floor (T-7),
 * ungroup TRS re-composition (S-9), active-camera switch (S-10), sibling
 * reorder (LayerSystem), component system (D-5), design tokens (D-6),
 * bezier evaluator determinism + channel spans (T-2/A-7).
 * The engine is a module singleton   " each test undoes its changes.
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
  addDesignToken,
  addMarker,
  addSceneNode,
  addTrack,
  componentInstances,
  createComponentFromNode,
  deleteKeyframe,
  detachComponentInstance,
  dispatch,
  duplicateSection,
  eulerFromQuat,
  getManifest,
  getTrack,
  instantiateComponent,
  moveDomNodeBeside,
  moveSceneNodeBeside,
  newNodeId,
  quatFromEuler,
  quatMultiply,
  removeComponentDef,
  removeDesignToken,
  removeMarker,
  removeSection,
  removeTrack,
  resolveTokenValue,
  rotateVecByQuat,
  setActiveCamera,
  setAssetProps,
  setAssetsProps,
  setDesignTokenProp,
  setEnvironmentProp,
  setMarkerProp,
  undo,
  ungroupSceneNode,
  updateComponentFromInstance,
  type DomNode,
  type SceneNode,
  type Track,
} from '@bs/engine';
import { channelSpans, createEvaluator, sampleKeyframes } from '@bs/engine';

const freshDomNode = (type = 'text', label = 'P3 node'): DomNode => ({
  id: newNodeId(type),
  type,
  tag: 'p',
  label,
  content: 'phase 3',
  children: [],
  style: { fontSize: 14 },
  overrides: {},
});

/* ---------------- Phase 2 debt: sections (audit A-2, Phase 2.7) ---------------- */

describe('removeSection / duplicateSection (Phase 2.7   " audit A-2)', () => {
  it('duplicates a section as one undo step and redistributes ranges', () => {
    const m = getManifest();
    const before = m.sections.length;
    const srcId = m.sections[0].id;
    const newRootId = duplicateSection(srcId);
    expect(newRootId).toBeTruthy();
    expect(m.sections.length).toBe(before + 1);
    expect(m.domNodes[newRootId!]).toBeDefined();
    // ranges cover [0,1] contiguously
    expect(m.sections[0].range[0]).toBe(0);
    expect(m.sections[m.sections.length - 1].range[1]).toBe(1);
    for (let i = 1; i < m.sections.length; i++) {
      expect(m.sections[i].range[0]).toBeCloseTo(m.sections[i - 1].range[1], 6);
    }
    undo();
    expect(m.sections.length).toBe(before);
    expect(m.domNodes[newRootId!]).toBeUndefined();
  });

  it('removes a section subtree in one undo step and refuses the last one', () => {
    const m = getManifest();
    const before = m.sections.length;
    const victim = m.sections[m.sections.length - 1];
    const rootId = victim.rootDomNodeId;
    expect(removeSection(victim.id)).toBe(true);
    expect(m.sections.length).toBe(before - 1);
    expect(m.domNodes[rootId]).toBeUndefined();
    expect(m.sections[m.sections.length - 1].range[1]).toBe(1);
    undo();
    expect(m.sections.length).toBe(before);
    expect(m.domNodes[rootId]).toBeDefined();
    // refusal: a page keeps at least one section
    const survivors = [...m.sections];
    for (let i = 0; i < survivors.length - 1; i++) removeSection(getManifest().sections[0].id);
    expect(getManifest().sections.length).toBe(1);
    expect(removeSection(getManifest().sections[0].id)).toBe(false);
    for (let i = 0; i < survivors.length - 1; i++) undo();
    expect(getManifest().sections.length).toBe(before);
  });
});

/* ---------------- Phase 2 debt: markers (Phase 2.5   " audit T-3) ---------------- */

describe('timeline markers (Phase 2.5   " audit T-3)', () => {
  it('adds, edits, sorts and removes markers as commands', () => {
    const m = getManifest();
    const before = m.markers.length;
    const mk = addMarker(0.8, 'Late');
    const mk2 = addMarker(0.2, 'Early');
    expect(m.markers.length).toBe(before + 2);
    // kept sorted by t
    const ts = m.markers.map((x) => x.t);
    expect([...ts].sort((a, b) => a - b)).toEqual(ts);
    setMarkerProp(mk2.id, 't', 0.95);
    expect(m.markers[m.markers.length - 1].id).toBe(mk2.id); // re-sorted
    removeMarker(mk.id);
    removeMarker(mk2.id);
    expect(m.markers.length).toBe(before);
    undo();
    undo();
    undo();
    undo();
    undo(); // 5 ops   ' 5 undos restore the seed
    expect(getManifest().markers.length).toBe(before);
  });
});

/* ---------------- Phase 2 debt: asset organization (Phase 2.10   " AS-2/AS-6) ---------------- */

describe('asset organization (Phase 2.10   " audit AS-2/AS-6)', () => {
  it('patches metadata on one asset and bulk-patches many as ONE undo step', () => {
    const m = getManifest();
    const [a, b] = m.assets;
    setAssetProps(a.id, { folder: 'test-folder', tags: ['x', 'y'], favorite: true });
    expect(m.assets.find((x) => x.id === a.id)?.folder).toBe('test-folder');
    undo();
    expect(getManifest().assets.find((x) => x.id === a.id)?.folder).toBeUndefined();
    setAssetsProps([a.id, b.id], { favorite: true });
    expect(m.assets.find((x) => x.id === a.id)?.favorite).toBe(true);
    expect(m.assets.find((x) => x.id === b.id)?.favorite).toBe(true);
    undo(); // ONE undo reverts the whole bulk op
    expect(getManifest().assets.find((x) => x.id === a.id)?.favorite).toBeFalsy();
    expect(getManifest().assets.find((x) => x.id === b.id)?.favorite).toBeFalsy();
  });
});

/* ---------------- Phase 2 debt: environment (Phase 2.3   " audit S-4) ---------------- */

describe('environment settings (Phase 2.3   " audit S-4/M-3)', () => {
  it('writes environment props through the command engine', () => {
    const m = getManifest();
    const prior = m.environment.envIntensity;
    setEnvironmentProp('envIntensity', 2.5);
    expect(m.environment.envIntensity).toBe(2.5);
    undo();
    expect(m.environment.envIntensity).toBe(prior);
  });
});

/* ---------------- Phase 3: keyframe floor (audit T-7) ---------------- */

describe('keyframe floor removal (Phase 3   " audit T-7)', () => {
  it('allows deleting down to a single constant keyframe, never to zero', () => {
    const track: Track = {
      id: newNodeId('trk'),
      label: 'floor test',
      target: 'obj-x',
      channel: 'opacity',
      keyframes: [
        { t: 0, v: [0] },
        { t: 0.5, v: [1] },
        { t: 1, v: [0] },
      ],
    };
    addTrack(track);
    deleteKeyframe(track.id, 0.5);
    deleteKeyframe(track.id, 1);
    expect(getTrack(track.id)?.keyframes.length).toBe(1); // constant track is valid
    deleteKeyframe(track.id, 0);
    expect(getTrack(track.id)?.keyframes.length).toBe(1); // floor: never empty
    removeTrack(track.id);
  });
});

/* ---------------- Phase 3: ungroup TRS re-composition (audit S-9) ---------------- */

describe('ungroup transform re-composition (Phase 3   " audit S-9)', () => {
  it('rotates and scales children through the dissolved group frame   " nothing jumps', () => {
    const m = getManifest();
    const child: SceneNode = {
      id: newNodeId('mesh'),
      label: 'S9 child',
      type: 'mesh',
      visible: true,
      locked: false,
      children: [],
      transform: { position: [1, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      props: { primitive: 'box' },
    };
    const group: SceneNode = {
      id: newNodeId('group'),
      label: 'S9 group',
      type: 'group',
      visible: true,
      locked: false,
      children: [child.id],
      transform: { position: [10, 0, 0], rotation: [0, Math.PI / 2, 0], scale: [2, 2, 2] },
    };
    addSceneNode(child, null); // registered, then adopted by the group
    dispatch({ type: 'set', path: 'sceneRootOrder', value: m.sceneRootOrder.filter((x) => x !== child.id) });
    addSceneNode(group, null);
    expect(ungroupSceneNode(group.id)).toBe(true);
    const t = m.sceneNodes[child.id].transform;
    // world position: 90   about Y maps +X   '   'Z; scaled by 2; translated by 10
    expect(t.position[0]).toBeCloseTo(10, 4);
    expect(t.position[1]).toBeCloseTo(0, 4);
    expect(t.position[2]).toBeCloseTo(-2, 4);
    expect(t.rotation[1]).toBeCloseTo(Math.PI / 2, 4);
    expect(t.scale).toEqual([2, 2, 2]);
    // cleanup: undo ungroup, group add, root-order patch, child add
    undo();
    undo();
    undo();
    undo();
    expect(getManifest().sceneNodes[child.id]).toBeUndefined();
    expect(getManifest().sceneNodes[group.id]).toBeUndefined();
  });

  it('quaternion helpers agree with the XYZ Euler convention', () => {
    const q = quatFromEuler([0, Math.PI / 2, 0]);
    const v = rotateVecByQuat(q, [1, 0, 0]);
    expect(v[0]).toBeCloseTo(0, 6);
    expect(v[2]).toBeCloseTo(-1, 6);
    const e = eulerFromQuat(quatMultiply(q, quatFromEuler([0, 0, 0])));
    expect(e[1]).toBeCloseTo(Math.PI / 2, 6);
  });
});

/* ---------------- Phase 3: active camera switch (audit S-10) ---------------- */

describe('active camera switch (Phase 3   " audit S-10)', () => {
  it('keeps exactly one active camera per scene', () => {
    const m = getManifest();
    const priorActive = Object.values(m.sceneNodes).find((n) => n.type === 'camera' && n.props?.active);
    const cam: SceneNode = {
      id: newNodeId('camera'),
      label: 'S10 cam',
      type: 'camera',
      visible: true,
      locked: false,
      children: [],
      transform: { position: [0, 2, 4], rotation: [0, 0, 0], scale: [1, 1, 1] },
      props: { fov: 50, active: false },
    };
    addSceneNode(cam, null);
    expect(setActiveCamera(cam.id)).toBe(true);
    const actives = Object.values(m.sceneNodes).filter((n) => n.type === 'camera' && n.props?.active);
    expect(actives.length).toBe(1);
    expect(actives[0].id).toBe(cam.id);
    expect(setActiveCamera('not-a-camera')).toBe(false);
    undo(); // revert the switch
    if (priorActive) expect(Boolean(getManifest().sceneNodes[priorActive.id].props?.active)).toBe(true);
    undo(); // remove the camera
    expect(getManifest().sceneNodes[cam.id]).toBeUndefined();
  });
});

/* ---------------- Phase 3: sibling reorder (01 LayerSystem) ---------------- */

describe('sibling reorder (Phase 3   " 01 LayerSystem)', () => {
  it('inserts a DOM node before/after a sibling', () => {
    const m = getManifest();
    const parentId = m.domRootOrder[0];
    const kids = m.domNodes[parentId].children;
    expect(kids.length).toBeGreaterThan(1);
    const [first, second] = kids;
    expect(moveDomNodeBeside(first, second, 'after')).toBe(true);
    expect(m.domNodes[parentId].children.indexOf(first)).toBe(
      m.domNodes[parentId].children.indexOf(second) + 1,
    );
    undo();
    expect(getManifest().domNodes[parentId].children[0]).toBe(first);
    // section roots refuse (they reorder via reorderSections)
    expect(moveDomNodeBeside(first, m.domRootOrder[0], 'before')).toBe(false);
  });

  it('reorders scene roots and refuses descendant cycles', () => {
    const m = getManifest();
    const roots = [...m.sceneRootOrder];
    expect(roots.length).toBeGreaterThan(1);
    expect(moveSceneNodeBeside(roots[0], roots[roots.length - 1], 'after')).toBe(true);
    expect(m.sceneRootOrder[m.sceneRootOrder.length - 1]).toBe(roots[0]);
    undo();
    expect(getManifest().sceneRootOrder).toEqual(roots);
    const parentWithChild = Object.values(m.sceneNodes).find((n) => n.children.length > 0);
    if (parentWithChild) {
      expect(moveSceneNodeBeside(parentWithChild.id, parentWithChild.children[0], 'before')).toBe(false);
    }
  });
});

/* ---------------- Phase 3: component system (audit D-5) ---------------- */

describe('component system (Phase 3   " audit D-5, 01 ComponentSystem)', () => {
  it('creates, instantiates, syncs and detaches components', () => {
    const m = getManifest();
    const parentId = m.domRootOrder[0];
    const node = freshDomNode('button', 'CTA');
    dispatch({ type: 'set', path: `domNodes.${node.id}`, value: node });
    dispatch({
      type: 'set',
      path: `domNodes.${parentId}.children`,
      value: [...m.domNodes[parentId].children, node.id],
    });
    // create
    const defId = createComponentFromNode(node.id)!;
    expect(defId).toBeTruthy();
    expect(m.components[defId].name).toBe('CTA');
    expect(m.domNodes[node.id].componentId).toBe(defId);
    // instantiate   " fresh ids, linked root, placement override applied
    const instId = instantiateComponent(defId, parentId, 0, { position: 'absolute', left: 5, top: 7 })!;
    expect(instId).toBeTruthy();
    expect(instId).not.toBe(node.id);
    expect(m.domNodes[instId].componentId).toBe(defId);
    expect(m.domNodes[instId].style.left).toBe(5);
    expect(componentInstances(defId).length).toBe(2);
    // sync: edit the source instance, push to others; placement survives
    dispatch({ type: 'set', path: `domNodes.${node.id}.content`, value: 'UPDATED' });
    expect(updateComponentFromInstance(node.id)).toBe(1);
    expect(m.domNodes[instId].content).toBe('UPDATED');
    expect(m.domNodes[instId].style.left).toBe(5);
    // def deletion refused while instances exist (soft-delete law)
    expect(removeComponentDef(defId)).toBe(false);
    // detach breaks the link
    detachComponentInstance(instId);
    expect(m.domNodes[instId].componentId).toBeUndefined();
    // cleanup (reverse order): detach, sync, instantiate, create, child-insert, node
    undo();
    undo();
    undo();
    undo();
    undo();
    undo();
    undo();
    expect(getManifest().components[defId]).toBeUndefined();
    expect(getManifest().domNodes[node.id]).toBeUndefined();
  });
});

/* ---------------- Phase 3: design tokens (audit D-6) ---------------- */

describe('design tokens (Phase 3   " audit D-6, 01 DesignTokens)', () => {
  it('adds, resolves, renames and removes tokens', () => {
    const t = addDesignToken('brand', '#ff0000');
    expect(resolveTokenValue('$brand')).toBe('#ff0000');
    setDesignTokenProp(t.id, 'value', 24);
    expect(resolveTokenValue('$brand')).toBe(24);
    setDesignTokenProp(t.id, 'name', 'brand2');
    expect(resolveTokenValue('$brand')).toBe('$brand'); // unknown refs pass through, visibly
    expect(resolveTokenValue('$brand2')).toBe(24);
    removeDesignToken(t.id);
    expect(resolveTokenValue('$brand2')).toBe('$brand2');
    undo();
    undo();
    undo();
    undo(); // seed state
    expect(getManifest().designTokens.find((x) => x.id === t.id)).toBeUndefined();
  });
});

/* ---------------- Phase 3: evaluator   " bezier + spans (T-2 debt / A-7) ---------------- */

describe('evaluator bezier + channel spans (Phase 2.5 debt / Phase 3 A-7)', () => {
  const track: Track = {
    id: 'trk-bez',
    label: 'bezier',
    target: 'node-x',
    channel: 'opacity',
    keyframes: [
      { t: 0.2, v: [0] },
      { t: 0.8, v: [1], ease: 'bezier', bezier: [0.4, 0, 0.2, 1] },
    ],
  };

  it('bezier easing is deterministic, clamped and monotonic (FR-153)', () => {
    const e1 = createEvaluator([track]);
    const e2 = createEvaluator([track]);
    let prev = -1;
    for (let i = 0; i <= 40; i++) {
      const p = i / 40;
      const a = e1.evaluate(p).channels.get('node-x.opacity')![0];
      const b = e2.evaluate(p).channels.get('node-x.opacity')![0];
      expect(a).toBe(b); // identical across evaluator instances
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
      expect(a + 1e-9).toBeGreaterThanOrEqual(prev); // monotonic for this curve
      prev = a;
    }
    // clamp semantics outside the span
    expect(e1.evaluate(0).channels.get('node-x.opacity')![0]).toBe(0);
    expect(e1.evaluate(1).channels.get('node-x.opacity')![0]).toBe(1);
  });

  it('channelSpans reports keyframe spans for span-scoped ownership (A-7)', () => {
    const spans = channelSpans([track]);
    expect(spans.get('node-x.opacity')).toEqual([0.2, 0.8]);
    expect(channelSpans([{ ...track, keyframes: [] }]).size).toBe(0);
  });

  it('sampleKeyframes matches evaluator output at the same progress', () => {
    const e = createEvaluator([track]);
    for (const p of [0.2, 0.35, 0.5, 0.65, 0.8]) {
      expect(sampleKeyframes(track.keyframes, p)[0]).toBeCloseTo(
        e.evaluate(p).channels.get('node-x.opacity')![0],
        12,
      );
    }
  });
});
