/**
 * UI store selection-model tests (Phase 0.3   " 01 SelectionSystem, audit A-3/A-10).
 * Single-select remains the trivial case of multi-select; selections never
 * dangle after their targets disappear.
 */
// @ts-ignore
import { beforeEach, describe, expect, it } from 'vitest';
import { getUIState, pruneSelections, setUIState, toggleDomSelection, toggleSceneSelection } from '@bs/engine';

function resetSelections(): void {
  setUIState({
    selectedDomNodeId: null,
    selectedSceneNodeId: null,
    selectedTrackId: null,
    selectedWaypointId: null,
    selectedMaterialId: null,
    selectedAssetId: null,
    selectedKeyframeT: null,
  });
}

const acceptAll = {
  dom: () => true,
  scene: () => true,
  track: () => true,
  waypoint: () => true,
  material: () => true,
  asset: () => true,
};

describe('selection model v2', () => {
  beforeEach(resetSelections);

  it('single-select (anchor) resets the plural array', () => {
    setUIState({ selectedDomNodeId: 'a' });
    expect(getUIState().selectedDomNodeIds).toEqual(['a']);
    setUIState({ selectedDomNodeId: 'b' });
    expect(getUIState().selectedDomNodeIds).toEqual(['b']);
    setUIState({ selectedDomNodeId: null });
    expect(getUIState().selectedDomNodeIds).toEqual([]);
  });

  it('toggle adds and removes; anchor tracks the last addition', () => {
    setUIState({ selectedDomNodeId: 'a' });
    toggleDomSelection('b');
    expect(getUIState().selectedDomNodeIds).toEqual(['a', 'b']);
    expect(getUIState().selectedDomNodeId).toBe('b');
    toggleDomSelection('a'); // remove
    expect(getUIState().selectedDomNodeIds).toEqual(['b']);
    expect(getUIState().selectedDomNodeId).toBe('b');
    toggleDomSelection('b'); // remove last
    expect(getUIState().selectedDomNodeIds).toEqual([]);
    expect(getUIState().selectedDomNodeId).toBeNull();
  });

  it('scene selection follows the same model independently', () => {
    setUIState({ selectedSceneNodeId: 'm1' });
    toggleSceneSelection('m2');
    expect(getUIState().selectedSceneNodeIds).toEqual(['m1', 'm2']);
    expect(getUIState().selectedDomNodeIds).toEqual([]); // domains independent
  });

  it('prune drops invalid ids and re-anchors to the last valid one', () => {
    setUIState({ selectedDomNodeId: 'a' });
    toggleDomSelection('b');
    toggleDomSelection('c'); // anchor = c
    pruneSelections({ ...acceptAll, dom: (id) => id !== 'c' });
    expect(getUIState().selectedDomNodeIds).toEqual(['a', 'b']);
    expect(getUIState().selectedDomNodeId).toBe('b');
  });

  it('prune clears dangling track/waypoint/material/asset selections', () => {
    setUIState({
      selectedTrackId: 't1',
      selectedKeyframeT: 0.5,
      selectedWaypointId: 'w1',
      selectedMaterialId: 'mat1',
      selectedAssetId: 'as1',
    });
    pruneSelections({
      ...acceptAll,
      track: () => false,
      waypoint: () => false,
      material: () => false,
      asset: () => false,
    });
    const s = getUIState();
    expect(s.selectedTrackId).toBeNull();
    expect(s.selectedKeyframeT).toBeNull();
    expect(s.selectedWaypointId).toBeNull();
    expect(s.selectedMaterialId).toBeNull();
    expect(s.selectedAssetId).toBeNull();
  });

  it('prune with all-valid selections is a no-op (no listener churn)', () => {
    setUIState({ selectedDomNodeId: 'a', selectedTrackId: 't1' });
    const before = getUIState();
    pruneSelections(acceptAll);
    expect(getUIState()).toBe(before); // same state object   " nothing dispatched
  });
});
