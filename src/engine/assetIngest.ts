/**
 * Universal asset ingest (Phase 1.4   " FR-180, brief   5, audit AS-1/D-8).
 * Category routing by file extension; every imported file becomes a versioned
 * asset record with a session URL and a persisted Blob (Phase 0.2).
 * GLB/GLTF scene extraction is a separate step owned by the 3D pipeline
 * (`viewport/importGLB.ts`)   " this module only manages records.
 */
import { addAssets, newNodeId, type AssetRecord } from '@bs/engine';
import { saveAssetBlob } from './storage';

/** Category filter chips (Asset Studio + left-rail panel). */
export const ASSET_CATEGORIES = [
  'All',
  '3D Models',
  'Images',
  'SVG',
  'Videos',
  'Audio',
  'Fonts',
  'Textures',
  'HDR',
] as const;

const EXT_CATEGORY: Record<string, string> = {
  // 3D (GLB/GLTF extract full hierarchies; OBJ/FBX/STL load whole-object   " Phase 3, audit S-6)
  glb: '3D Models',
  gltf: '3D Models',
  obj: '3D Models',
  fbx: '3D Models',
  stl: '3D Models',
  // images
  png: 'Images',
  jpg: 'Images',
  jpeg: 'Images',
  webp: 'Images',
  gif: 'Images',
  avif: 'Images',
  svg: 'SVG',
  // media
  mp4: 'Videos',
  webm: 'Videos',
  mov: 'Videos',
  mp3: 'Audio',
  wav: 'Audio',
  ogg: 'Audio',
  m4a: 'Audio',
  // type
  woff: 'Fonts',
  woff2: 'Fonts',
  ttf: 'Fonts',
  otf: 'Fonts',
  // shading
  ktx2: 'Textures',
  exr: 'Textures',
  hdr: 'HDR',
};

/** `accept` attribute for the import pickers. */
export const IMPORT_ACCEPT = Object.keys(EXT_CATEGORY)
  .map((e) => `.${e}`)
  .join(',');

export function categoryForFile(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_CATEGORY[ext] ?? null;
}

export function isGltfFile(name: string): boolean {
  return /\.(glb|gltf)$/i.test(name);
}

export interface IngestResult {
  imported: AssetRecord[];
  rejected: string[];
}

/**
 * Register files as asset records   " ONE transaction for the whole batch
 * (one undo removes every record). Blobs persist per record id.
 */
export function ingestFiles(files: Iterable<File>): IngestResult {
  const imported: AssetRecord[] = [];
  const rejected: string[] = [];
  for (const file of files) {
    const category = categoryForFile(file.name);
    if (!category) {
      rejected.push(file.name);
      continue;
    }
    const asset: AssetRecord = {
      id: newNodeId('asset'),
      name: file.name,
      category,
      version: 1,
      stats: `${Math.max(1, Math.round(file.size / 1024))} KB`,
      usedBy: 0,
      url: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : undefined,
      // metadata model (Phase 2.10   " 06 Metadata.md, audit AS-6)
      mime: file.type || undefined,
      size: file.size,
      createdAt: new Date().toISOString(),
      tags: [],
    };
    saveAssetBlob(asset.id, file);
    imported.push(asset);
  }
  addAssets(imported);
  return { imported, rejected };
}
