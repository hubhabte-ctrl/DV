/**
 * Shared Asset Library Panel.
 * Used by Asset Studio (as its main rail panel) and 3D Studio (as a tab).
 * Placed in shared/ because IL-1 forbids cross-studio imports.
 */
import { useState, useRef } from 'react';
import { Icons } from '../../../../app/ui/Icons';
import { toast } from '../../../../app/ui/Toast';
import {
  addAsset,
  assetUsedBy,
  deleteAsset,
  duplicateAsset,
  getManifest,
  newNodeId,
  registerImportedScene,
  renameAsset,
  replaceAssetWithFile,
  setUIState,
  useUIState,
  type AssetRecord,
} from '@bs/engine';
import { saveAssetBlob } from '../../../../engine/storage';
import { ASSET_CATEGORIES, IMPORT_ACCEPT, ingestFiles, isGltfFile } from '../../../../engine/assetIngest';
import { extractGlbScene } from '../../../../viewport/importGLB';
import { MIME_ASSET } from '../../utils/dnd';

/** GLB/GLTF import */
function importGlbFile(file: File): void {
  const url = URL.createObjectURL(file);
  const asset: AssetRecord = {
    id: newNodeId('asset'),
    name: file.name,
    category: '3D Models',
    version: 1,
    stats: `${Math.max(1, Math.round(file.size / 1024))} KB · imported`,
    usedBy: 0,
    url,
  };
  saveAssetBlob(asset.id, file);
  addAsset(asset);
  extractGlbScene(url, asset.id, file.name.replace(/\.(glb|gltf)$/i, ''))
    .then(({ nodes, rootId, materials, stats }) => {
      registerImportedScene(nodes, rootId, materials);
      setUIState({ mode: '3d', selectedSceneNodeId: rootId });
      toast(
        `${file.name} imported   " ${stats.meshes} meshes, ${stats.groups} groups` +
          `${stats.cameras ? `, ${stats.cameras} cameras` : ''}` +
          `${stats.lights ? `, ${stats.lights} lights` : ''}` +
          `, ${materials.length} materials extracted`,
      );
    })
    .catch((err) => {
      console.error('[import] GLB extraction failed', err);
      toast(`${file.name}: extraction failed   " asset registered, see console`);
    });
}

/** Universal import entry */
export function importAssetFiles(files: File[]): void {
  const rest: File[] = [];
  for (const file of files) {
    if (isGltfFile(file.name)) importGlbFile(file);
    else rest.push(file);
  }
  if (rest.length > 0) {
    const { imported, rejected } = ingestFiles(rest);
    if (imported.length) toast(`${imported.length} asset(s) imported`);
    if (rejected.length) toast(`Unsupported file type: ${rejected.join(', ')}`);
  }
}

function AssetFolderTree({ search }: { search: string }) {
  const m = getManifest();
  const selectedCategory = useUIState((s) => s.selectedAssetCategory);

  return (
    <div className="uk-tree bs-asset-folder-tree">
      {ASSET_CATEGORIES.map((cat) => {
        const items = m.assets.filter(
          (a) =>
            (cat === 'All' || a.category === cat) &&
            (!search || a.name.toLowerCase().includes(search.toLowerCase())),
        );
        if (items.length === 0 && search) return null;

        const isSelected = selectedCategory === cat;

        return (
          <div key={cat} className="uk-tree__group bs-asset-folder-group">
            <div
              className={`uk-tree__row bs-asset-folder-header ${isSelected ? 'uk-tree__row--selected' : ''}`}
              onClick={() => setUIState({ selectedAssetCategory: cat })}
            >
              <span className="uk-tree__icon bs-asset-folder-icon">
                {Icons.folder}
              </span>
              <span className="uk-tree__label bs-asset-folder-label">
                {cat}
              </span>
              <span className="bs-muted bs-mono bs-asset-folder-count">
                ({items.length})
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Scene3DAssetPanel({ search }: { search: string }) {
  const m = getManifest();
  const selAsset = useUIState((s) => s.selectedAssetId);
  const [assetCat, setAssetCat] = useState('All');
  const [renamingAssetId, setRenamingAssetId] = useState<string | null>(null);
  
  const importRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replacingAssetId = useRef<string | null>(null);

  return (
    <>
      <div className="bs-row bs-asset-tab-filters">
        {ASSET_CATEGORIES.map((cat) => (
          <button
            type="button"
            key={cat}
            className={`uk-filterchip ${assetCat === cat ? 'uk-filterchip--on' : ''}`}
            onClick={() => setAssetCat(cat)}
          >
            {cat}
          </button>
        ))}
        <span className="bs-spacer" />
        <button
          type="button"
          className="uk-filterchip"
          title="Import assets — 3D models, images, SVG, video, audio, fonts, textures, HDR"
          onClick={() => importRef.current?.click()}
        >
          + Import
        </button>
        <input
          ref={importRef}
          type="file"
          accept={IMPORT_ACCEPT}
          multiple
          className="bs-hidden"
          onChange={(e) => {
            importAssetFiles(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
        <input
          ref={replaceRef}
          type="file"
          accept={IMPORT_ACCEPT}
          className="bs-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            const id = replacingAssetId.current;
            replacingAssetId.current = null;
            e.target.value = '';
            if (!file || !id) return;
            const asset = getManifest().assets.find((a) => a.id === id);
            replaceAssetWithFile(id, file);
            toast(
              `${asset?.name ?? 'Asset'} replaced with ${file.name}   " new version, references reload`,
            );
          }}
        />
      </div>
      <div
        className="bs-drop-zone bs-m-md"
        onClick={() => importRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add('bs-drop-zone--active');
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove('bs-drop-zone--active');
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('bs-drop-zone--active');
          importAssetFiles(Array.from(e.dataTransfer.files ?? []));
        }}
      >
        {Icons.publish}
        <span>Click or drop files here to import</span>
      </div>
      <div className="bs-asset-grid">
        {m.assets
          .filter((a) => assetCat === 'All' || a.category === assetCat)
          .filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()))
          .map((a) => {
            const used = assetUsedBy(a);
            const isModel = a.category === '3D Models';
            const isImage =
              a.category === 'Images' || a.category === 'Textures' || a.category === 'SVG';
            return (
              <div
                key={a.id}
                className="bs-asset-card"
                title={`v${a.version} · used by ${used} — drag onto the canvas`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(MIME_ASSET, a.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
              >
                <div className="bs-asset-thumb">
                  {isImage && a.url ? (
                    <img
                      className="uk-assetcard__img bs-asset-thumb-img"
                      src={a.url}
                      alt={a.name}
                      draggable={false}
                    />
                  ) : a.category === '3D Models' ? (
                    Icons.cube
                  ) : a.category === 'Audio' ? (
                    Icons.audio
                  ) : a.category === 'Video' ? (
                    Icons.video
                  ) : a.category === 'Fonts' ? (
                    <span className="bs-asset-font-glyph">Aa</span>
                  ) : (
                    Icons.image
                  )}
                  {isModel ? (
                    <span className="bs-abadge bs-abadge--ok">OK</span>
                  ) : isImage ? (
                    <span className="bs-abadge bs-abadge--run">RUN</span>
                  ) : (
                    <span className="bs-abadge bs-abadge--ok">OK</span>
                  )}
                </div>
                <div className="bs-asset-meta">
                  {renamingAssetId === a.id ? (
                    <input
                      className="uk-input bs-asset-rename-input"
                      defaultValue={a.name}
                      autoFocus
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== a.name) renameAsset(a.id, v);
                        setRenamingAssetId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        else if (e.key === 'Escape') setRenamingAssetId(null);
                      }}
                    />
                  ) : (
                    <div className="bs-asset-name" onDoubleClick={() => setRenamingAssetId(a.id)}>
                      {a.name}
                    </div>
                  )}
                  <div className="bs-asset-sub">
                    <span>
                      v{a.version} · {a.stats}
                    </span>
                  </div>
                </div>
                <div className="uk-assetcard__actions">
                  <button
                    type="button"
                    title="Rename (double-click name)"
                    aria-label={`Rename ${a.name}`}
                    onClick={() => setRenamingAssetId(a.id)}
                  >
                    {Icons.rename}
                  </button>
                  <button
                    type="button"
                    title="Replace — pick a file; creates a new version"
                    aria-label={`Replace ${a.name}`}
                    onClick={() => {
                      replacingAssetId.current = a.id;
                      replaceRef.current?.click();
                    }}
                  >
                    {Icons.replace}
                  </button>
                  <button
                    type="button"
                    title="Duplicate"
                    aria-label={`Duplicate ${a.name}`}
                    onClick={() => duplicateAsset(a.id)}
                  >
                    {Icons.duplicate}
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    aria-label={`Delete ${a.name}`}
                    onClick={() => {
                      if (deleteAsset(a.id)) toast(`${a.name} deleted`);
                      else toast(`${a.name} is in use   " remove references first (soft-delete law)`);
                    }}
                  >
                    {Icons.trash}
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </>
  );
}
