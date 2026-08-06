/**
 * Asset ingest routing tests (Phase 1.4   " FR-180, audit AS-1).
 * Pure category routing; record creation is exercised via the command tests.
 */
// @ts-ignore
import { describe, expect, it } from 'vitest';
import { ASSET_CATEGORIES, categoryForFile, IMPORT_ACCEPT, isGltfFile } from './assetIngest';

describe('asset category routing (FR-180)', () => {
  it('routes every supported type from the brief   5 list', () => {
    expect(categoryForFile('model.glb')).toBe('3D Models');
    expect(categoryForFile('scene.GLTF')).toBe('3D Models');
    expect(categoryForFile('part.obj')).toBe('3D Models');
    expect(categoryForFile('rig.fbx')).toBe('3D Models');
    expect(categoryForFile('print.stl')).toBe('3D Models');
    expect(categoryForFile('hero.png')).toBe('Images');
    expect(categoryForFile('photo.JPEG')).toBe('Images');
    expect(categoryForFile('icon.svg')).toBe('SVG');
    expect(categoryForFile('clip.mp4')).toBe('Videos');
    expect(categoryForFile('loop.webm')).toBe('Videos');
    expect(categoryForFile('hum.mp3')).toBe('Audio');
    expect(categoryForFile('fx.wav')).toBe('Audio');
    expect(categoryForFile('inter.woff2')).toBe('Fonts');
    expect(categoryForFile('mono.ttf')).toBe('Fonts');
    expect(categoryForFile('metal.ktx2')).toBe('Textures');
    expect(categoryForFile('env.hdr')).toBe('HDR');
  });

  it('rejects unknown types instead of guessing', () => {
    expect(categoryForFile('archive.zip')).toBeNull();
    expect(categoryForFile('README')).toBeNull();
    expect(categoryForFile('script.exe')).toBeNull();
  });

  it('exposes a coherent accept list and category chips', () => {
    expect(IMPORT_ACCEPT).toContain('.glb');
    expect(IMPORT_ACCEPT).toContain('.png');
    expect(IMPORT_ACCEPT).toContain('.hdr');
    expect(ASSET_CATEGORIES[0]).toBe('All');
  });

  it('identifies extractable gltf content', () => {
    expect(isGltfFile('a.glb')).toBe(true);
    expect(isGltfFile('a.gltf')).toBe(true);
    expect(isGltfFile('a.obj')).toBe(false);
  });
});
