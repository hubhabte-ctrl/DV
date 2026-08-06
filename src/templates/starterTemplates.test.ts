// @ts-ignore
import { describe, expect, it } from 'vitest';
import { STARTER_TEMPLATES, importStarterTemplate } from './starterTemplates';
import { getManifest, createBlankManifest } from '@bs/engine';

describe('Starter Templates Library', () => {
  it('defines 3 official starter templates', () => {
    expect(STARTER_TEMPLATES.length).toBe(3);
    const ids = STARTER_TEMPLATES.map((t) => t.id);
    expect(ids).toContain('3d-product-showcase');
    expect(ids).toContain('interactive-landing');
    expect(ids).toContain('blank-canvas');
  });

  it('createBlankManifest returns a clean 0-section manifest baseline', () => {
    const blank = createBlankManifest();
    expect(blank.sections.length).toBe(0);
    expect(blank.domRootOrder.length).toBe(0);
    expect(blank.sceneRootOrder.length).toBe(0);
    expect(blank.tracks.length).toBe(0);
    expect(Object.keys(blank.materials).length).toBe(0);
  });

  it('importStarterTemplate hydrates blank-canvas into active manifest', () => {
    const res = importStarterTemplate('blank-canvas');
    expect(res.success).toBe(true);
    const m = getManifest();
    expect(m.sections.length).toBe(0);
    expect(m.domRootOrder.length).toBe(0);
    expect(m.sceneRootOrder.length).toBe(0);
  });

  it('importStarterTemplate hydrates 3d-product-showcase into active manifest', () => {
    const res = importStarterTemplate('3d-product-showcase');
    expect(res.success).toBe(true);
    const m = getManifest();
    expect(m.sections.length).toBe(4);
    expect(m.sceneRootOrder.length).toBeGreaterThan(0);
  });
});
