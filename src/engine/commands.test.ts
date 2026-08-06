/**
 * Command-engine regression tests (Phase 0.1   " IL-1, FR-110/111, FR-122).
 * The engine is a module singleton seeded from data/manifest.json; tests run
 * sequentially in file order and either undo their changes or operate on
 * nodes they create. The history-cap test runs last by design.
 */
// @ts-ignore
import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-ignore
import {
  addDomNode,
  addSection,
  addTrack,
  canRedo,
  canUndo,
  clearOverride,
  deleteAsset,
  deleteKeyframe,
  deleteMaterial,
  dispatch,
  duplicateAsset,
  duplicateMaterial,
  getManifest,
  getTrack,
  hasOverride,
  materialUsedBy,
  newNodeId,
  redo,
  registerImportedScene,
  removeDomNode,
  removeTrack,
  renameTrack,
  reorderSections,
  replaceAsset,
  resolveStyle,
  setMaterialMap,
  setMaterialUv,
  setStyleValue,
  setTrackKeyframes,
  undo,
  type DomNode,
  type Material,
  type SceneNode,
  type Track,
} from '@bs/engine';
import { getUIState, setUIState } from '@bs/engine';
import { seedManifest, seedAssets } from '@bs/services/seed';
import { hydrateManifest } from '@bs/engine';
import { beforeAll } from 'vitest';


beforeAll(() => {
  const m = structuredClone(seedManifest) as Record<string, unknown>;
  m.assets = structuredClone(seedAssets.assets);
  hydrateManifest(m);
});

afterEach(() => {
  vi.restoreAllMocks();
});


/* ---------------- FR-110/111   " dispatch / undo / redo ---------------- */

describe('command engine (IL-1, FR-110/111)', () => {
  it('round-trips a set command through undo and redo', () => {
    const m = getManifest();
    const original = m.domNodes['intro-title'].style.fontSize;
    dispatch({ type: 'set', path: 'domNodes.intro-title.style.fontSize', value: 99 });
    expect(m.domNodes['intro-title'].style.fontSize).toBe(99);
    undo();
    expect(m.domNodes['intro-title'].style.fontSize).toBe(original);
    redo();
    expect(m.domNodes['intro-title'].style.fontSize).toBe(99);
    undo(); // leave seed state untouched
    expect(m.domNodes['intro-title'].style.fontSize).toBe(original);
  });

  it('a batch transaction is one undo step (Doc 04   3.1)', () => {
    const m = getManifest();
    const node: DomNode = {
      id: newNodeId('text'),
      type: 'text',
      tag: 'p',
      label: 'Test node',
      content: 'hi',
      children: [],
      style: { fontSize: 14 },
      overrides: {},
    };
    const parentChildrenBefore = [...m.domNodes['intro-root'].children];
    addDomNode('intro-root', node, 1); // two commands in one transaction
    expect(m.domNodes[node.id]).toBeDefined();
    expect(m.domNodes['intro-root'].children[1]).toBe(node.id);
    undo(); // single undo reverts both
    expect(m.domNodes[node.id]).toBeUndefined();
    expect(m.domNodes['intro-root'].children).toEqual(parentChildrenBefore);
  });

  it('coalesces same-key commands within 120 ms into one undo step', () => {
    const m = getManifest();
    const original = m.domNodes['intro-sub'].style.fontSize;
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(10_000);
    dispatch({ type: 'set', path: 'domNodes.intro-sub.style.fontSize', value: 20, coalesceKey: 'k1' });
    now.mockReturnValue(10_050); // < 120 ms later   " replaces the stack head
    dispatch({ type: 'set', path: 'domNodes.intro-sub.style.fontSize', value: 30, coalesceKey: 'k1' });
    expect(m.domNodes['intro-sub'].style.fontSize).toBe(30);
    undo(); // one undo restores the ORIGINAL value, not the intermediate
    expect(m.domNodes['intro-sub'].style.fontSize).toBe(original);
    redo();
    expect(m.domNodes['intro-sub'].style.fontSize).toBe(30);
    undo();
    expect(m.domNodes['intro-sub'].style.fontSize).toBe(original);
  });

  it('does NOT coalesce when commands arrive     120 ms apart', () => {
    const m = getManifest();
    const original = m.domNodes['intro-sub'].style.fontSize;
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(20_000);
    dispatch({ type: 'set', path: 'domNodes.intro-sub.style.fontSize', value: 21, coalesceKey: 'k2' });
    now.mockReturnValue(20_500); // separate gesture
    dispatch({ type: 'set', path: 'domNodes.intro-sub.style.fontSize', value: 31, coalesceKey: 'k2' });
    undo();
    expect(m.domNodes['intro-sub'].style.fontSize).toBe(21); // intermediate survives
    undo();
    expect(m.domNodes['intro-sub'].style.fontSize).toBe(original);
  });

  it('a new dispatch clears the redo stack', () => {
    const m = getManifest();
    const original = m.domNodes['intro-cta'].content;
    dispatch({ type: 'set', path: 'domNodes.intro-cta.content', value: 'One' });
    undo();
    expect(canRedo()).toBe(true);
    dispatch({ type: 'set', path: 'domNodes.intro-cta.content', value: 'Two' });
    expect(canRedo()).toBe(false);
    undo();
    expect(m.domNodes['intro-cta'].content).toBe(original);
  });

  it('deleting a subtree restores it fully on undo (inverse snapshots)', () => {
    const m = getManifest();
    const parentBefore = [...m.domNodes['intro-root'].children];
    const snapshot = structuredClone(m.domNodes['intro-cta']);
    expect(removeDomNode('intro-cta')).toBe(true);
    expect(m.domNodes['intro-cta']).toBeUndefined();
    undo();
    expect(m.domNodes['intro-cta']).toEqual(snapshot);
    expect(m.domNodes['intro-root'].children).toEqual(parentBefore);
  });

  it('refuses to delete section roots via removeDomNode', () => {
    expect(removeDomNode('intro-root')).toBe(false);
  });
});

/* ---------------- FR-122   " responsive sparse-patch overrides ---------------- */

describe('responsive resolution (FR-122, Doc 05   4)', () => {
  it('writes a sparse patch on non-desktop and resolves base     patch', () => {
    const m = getManifest();
    const node = () => m.domNodes['intro-title'];
    expect(resolveStyle(node(), 'desktop').letterSpacing).toBe(-1); // seed base
    expect(hasOverride(node(), 'tablet', 'letterSpacing')).toBe(false);

    setStyleValue('intro-title', 'tablet', 'letterSpacing', 2);
    expect(node().style.letterSpacing).toBe(-1); // base untouched
    expect(resolveStyle(node(), 'tablet').letterSpacing).toBe(2);
    expect(hasOverride(node(), 'tablet', 'letterSpacing')).toBe(true);
    expect(resolveStyle(node(), 'desktop').letterSpacing).toBe(-1);

    clearOverride('intro-title', 'tablet', 'letterSpacing'); // override dot reset
    expect(hasOverride(node(), 'tablet', 'letterSpacing')).toBe(false);
    expect(resolveStyle(node(), 'tablet').letterSpacing).toBe(-1);

    undo(); // restore the override
    expect(resolveStyle(node(), 'tablet').letterSpacing).toBe(2);
    undo(); // remove it again   " back to seed
    expect(hasOverride(node(), 'tablet', 'letterSpacing')).toBe(false);
  });

  it('desktop writes go to the base style block', () => {
    const m = getManifest();
    setStyleValue('intro-sub', 'desktop', 'lineHeight', 2);
    expect(m.domNodes['intro-sub'].style.lineHeight).toBe(2);
    expect(m.domNodes['intro-sub'].overrides.tablet?.lineHeight).toBeUndefined();
    undo();
  });
});

/* ---------------- Sections   " ranges always partition [0,1] ---------------- */

describe('section operations (Doc 05   3)', () => {
  it('addSection redistributes ranges evenly and appends the root', () => {
    const m = getManifest();
    const before = m.sections.length;
    const root: DomNode = {
      id: newNodeId('section'),
      type: 'section',
      tag: 'section',
      label: 'S *new',
      children: [],
      style: {},
      overrides: {},
    };
    addSection('05  * New', root);
    expect(m.sections.length).toBe(before + 1);
    expect(m.domRootOrder[m.domRootOrder.length - 1]).toBe(root.id);
    const n = m.sections.length;
    m.sections.forEach((s, i) => {
      expect(s.range[0]).toBeCloseTo(i / n, 3);
      expect(s.range[1]).toBeCloseTo((i + 1) / n, 3);
    });
    undo();
    expect(m.sections.length).toBe(before);
  });

  it('reorderSections moves the band and keeps root order aligned', () => {
    const m = getManifest();
    const firstId = m.sections[0].id;
    reorderSections(0, 2);
    expect(m.sections[2].id).toBe(firstId);
    expect(m.domRootOrder).toEqual(m.sections.map((s) => s.rootDomNodeId));
    // ranges remain a canonical partition of [0,1]
    const n = m.sections.length;
    m.sections.forEach((s, i) => {
      expect(s.range[0]).toBeCloseTo(i / n, 3);
      expect(s.range[1]).toBeCloseTo((i + 1) / n, 3);
    });
    undo();
    expect(m.sections[0].id).toBe(firstId);
  });
});

/* ---------------- Keyframes (Doc 13 Part 4 timeline law) ---------------- */

describe('keyframe operations (FR-151/152)', () => {
  it('setTrackKeyframes sorts and de-duplicates by t', () => {
    setTrackKeyframes('trk-cam-target', [
      { t: 0.9, v: [0, 0, 0], ease: 'linear' },
      { t: 0.1, v: [1, 1, 1], ease: 'linear' },
      { t: 0.1 + 1e-9, v: [2, 2, 2], ease: 'linear' }, // duplicate within epsilon
      { t: 0.5, v: [3, 3, 3], ease: 'linear' },
    ]);
    const track = getTrack('trk-cam-target')!;
    expect(track.keyframes.map((k) => k.t)).toEqual([0.1, 0.5, 0.9]);
    undo();
  });

  it('deleteKeyframe keeps tracks evaluable (    1 key   " Phase 3 audit T-7)', () => {
    const track = () => getTrack('trk-cam-target')!;
    const seedCount = track().keyframes.length; // 3 in seed data
    deleteKeyframe('trk-cam-target', track().keyframes[0].t);
    expect(track().keyframes.length).toBe(seedCount - 1);
    deleteKeyframe('trk-cam-target', track().keyframes[0].t);
    expect(track().keyframes.length).toBe(seedCount - 2); // 1-key = valid constant (T-7)
    deleteKeyframe('trk-cam-target', track().keyframes[0].t); // would drop to zero
    expect(track().keyframes.length).toBe(seedCount - 2); // refused   " never empty
    undo();
    undo();
    expect(track().keyframes.length).toBe(seedCount);
  });
});

/* ---------------- Materials & assets (Doc 13 Part 4 laws) ---------------- */

describe('material and asset laws (FR-140..142, FR-180..184)', () => {
  it('duplication is the only fork mechanism for materials', () => {
    const m = getManifest();
    const dupId = duplicateMaterial('mat-housing')!;
    expect(m.materials[dupId].name).toBe('Anodized Housing copy');
    expect(materialUsedBy(dupId)).toBe(0);
    expect(deleteMaterial(dupId)).toBe(true); // unlinked   ' deletable
    undo(); // restore dup
    undo(); // remove dup   " back to seed
  });

  it('refuses to delete a material linked to meshes', () => {
    expect(materialUsedBy('mat-signal')).toBeGreaterThan(0); // seed beacon link
    expect(deleteMaterial('mat-signal')).toBe(false);
  });

  it('replaceAsset bumps the version, never mutates in place', () => {
    const m = getManifest();
    const before = m.assets.find((a) => a.id === 'asset-hdr-studio')!.version;
    replaceAsset('asset-hdr-studio');
    expect(m.assets.find((a) => a.id === 'asset-hdr-studio')!.version).toBe(before + 1);
    undo();
  });

  it('refuses to delete in-use assets (soft-delete-warn law)', () => {
    expect(deleteAsset('asset-sensor-glb')).toBe(false); // referenced by mesh-sensor
  });

  it('duplicateAsset inserts an unlinked copy after the original', () => {
    const m = getManifest();
    duplicateAsset('asset-audio-hum');
    const at = m.assets.findIndex((a) => a.id === 'asset-audio-hum');
    const copy = m.assets[at + 1];
    expect(copy.name).toContain('copy');
    expect(copy.usedBy).toBe(0);
    expect(deleteAsset(copy.id)).toBe(true);
    undo();
    undo();
  });
});

/* ---------------- Track authoring (Phase 1.2   " FR-151, audit T-1) ---------------- */

describe('track authoring (FR-151)', () => {
  it('adds, renames, and removes a track through the command engine', () => {
    const m = getManifest();
    const before = m.tracks.length;
    const track: Track = {
      id: newNodeId('trk'),
      label: 'Beacon  * position',
      target: 'mesh-beacon',
      channel: 'position',
      keyframes: [{ t: 0.5, v: [0.55, 0.95, 0.35], ease: 'smooth' }],
    };
    addTrack(track);
    expect(m.tracks.length).toBe(before + 1);
    renameTrack(track.id, 'Beacon  * pos v2');
    expect(getTrack(track.id)!.label).toBe('Beacon  * pos v2');
    removeTrack(track.id);
    expect(getTrack(track.id)).toBeUndefined();
    undo(); // restore track
    expect(getTrack(track.id)).toBeDefined();
    undo(); // un-rename
    undo(); // un-add
    expect(m.tracks.length).toBe(before);
  });
});

/* ---------------- Texture pipeline data model (Phase 1.3   " M-1/M-2) ---------------- */

describe('material texture slots and UV (FR-140..142)', () => {
  it('assigns, clears, and undoes a texture slot', () => {
    const m = getManifest();
    setMaterialMap('mat-housing', 'normalMap', 'asset-tex-brushed');
    expect(m.materials['mat-housing'].maps?.normalMap).toBe('asset-tex-brushed');
    setMaterialMap('mat-housing', 'normalMap', undefined);
    expect(m.materials['mat-housing'].maps?.normalMap).toBeUndefined();
    undo(); // restore assignment
    expect(m.materials['mat-housing'].maps?.normalMap).toBe('asset-tex-brushed');
    undo(); // remove assignment   " back to seed
    expect(m.materials['mat-housing'].maps?.normalMap).toBeUndefined();
  });

  it('writes UV tiling/offset/rotation as record fields', () => {
    const m = getManifest();
    setMaterialUv('mat-housing', 'tiling', [2, 2]);
    setMaterialUv('mat-housing', 'rotation', 0.5);
    expect(m.materials['mat-housing'].uv?.tiling).toEqual([2, 2]);
    expect(m.materials['mat-housing'].uv?.rotation).toBe(0.5);
    undo();
    undo();
    expect(m.materials['mat-housing'].uv?.tiling).toBeUndefined();
  });

  it('duplicating an imported material yields a standalone editable fork', () => {
    const m = getManifest();
    const imported: Material = {
      id: newNodeId('mat'),
      name: 'GLB Import',
      baseColor: '#ffffff',
      metallic: 0.1,
      roughness: 0.9,
      emissive: '#000000',
      emissiveIntensity: 0,
      opacity: 1,
      imported: true,
    };
    dispatch({ type: 'set', path: `materials.${imported.id}`, value: imported });
    const forkId = duplicateMaterial(imported.id)!;
    expect(m.materials[forkId].imported).toBeUndefined();
    undo(); // remove fork
    undo(); // remove imported record
    expect(m.materials[imported.id]).toBeUndefined();
  });
});

/* ---------------- Imported scene registration (Phase 1.1   " S-1/S-2) ---------------- */

describe('registerImportedScene (FR-130..133)', () => {
  it('registers hierarchy + materials in ONE undo step', () => {
    const m = getManifest();
    const mat: Material = {
      id: newNodeId('mat'),
      name: 'Imp',
      baseColor: '#888888',
      metallic: 0,
      roughness: 0.5,
      emissive: '#000000',
      emissiveIntensity: 0,
      opacity: 1,
      imported: true,
    };
    const child: SceneNode = {
      id: newNodeId('mesh'),
      label: 'Body',
      type: 'mesh',
      visible: true,
      locked: false,
      children: [],
      transform: { position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      props: { assetId: 'asset-sensor-glb', subPath: '0', materialId: mat.id },
    };
    const root: SceneNode = {
      id: newNodeId('group'),
      label: 'Import Root',
      type: 'group',
      visible: true,
      locked: false,
      children: [child.id],
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    };
    const rootsBefore = m.sceneRootOrder.length;
    registerImportedScene([child, root], root.id, [mat]);
    expect(m.sceneNodes[root.id].children).toEqual([child.id]);
    expect(m.sceneNodes[child.id].props?.subPath).toBe('0');
    expect(m.materials[mat.id].imported).toBe(true);
    expect(m.sceneRootOrder[m.sceneRootOrder.length - 1]).toBe(root.id);
    undo(); // ONE step removes the entire import
    expect(m.sceneNodes[root.id]).toBeUndefined();
    expect(m.sceneNodes[child.id]).toBeUndefined();
    expect(m.materials[mat.id]).toBeUndefined();
    expect(m.sceneRootOrder.length).toBe(rootsBefore);
  });
});

/* ---------------- Selection pruning integration (audit A-10) ---------------- */

describe('selection pruning on manifest change', () => {
  it('clears the selection when the selected node is deleted', () => {
    setUIState({ selectedDomNodeId: 'intro-cta' });
    expect(getUIState().selectedDomNodeIds).toEqual(['intro-cta']);
    removeDomNode('intro-cta');
    expect(getUIState().selectedDomNodeId).toBeNull();
    expect(getUIState().selectedDomNodeIds).toEqual([]);
    undo(); // node returns; selection intentionally stays cleared
    expect(getManifest().domNodes['intro-cta']).toBeDefined();
    expect(getUIState().selectedDomNodeId).toBeNull();
  });
});

/* ---------------- FR-111   " history cap (runs last: floods the stack) ---------------- */

describe('history cap (FR-111)', () => {
  it('caps the undo stack at 200 entries', () => {
    for (let i = 0; i < 230; i++) {
      dispatch({ type: 'set', path: 'domNodes.specs-cta.content', value: `v${i}` });
    }
    let undos = 0;
    while (canUndo() && undos < 500) {
      undo();
      undos++;
    }
    expect(undos).toBeLessThanOrEqual(200);
    expect(canUndo()).toBe(false);
  });
});
