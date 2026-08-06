/**
 * Asset Studio (FR-180..184, Doc 05   9)   " independent editing environment for
 * project assets (Rule 1/5): category browsing, search, import, rename,
 * replace-as-new-version, duplicate, and soft-delete-with-warning (Part 4
 * Asset law). Selecting an asset opens its detail contract in the Inspector.
 *
 * Phase 2.10 (audit AS-2/AS-5/AS-6):
 *  - organization: folders, tags, favorites; Ctrl/Shift-click bulk selection
 *    with a bulk action bar (favorite / move to folder / delete   " ONE undo);
 *  - REAL replace: the picker's file becomes the new version (FR-183);
 *  - metadata model: mime, byte size, created/modified timestamps.
 */
import { useEffect, useRef, useState } from 'react';
import { Icons } from '../../../../app/ui/Icons';
import { SearchInput } from '../common/SearchInput';
import { toast } from '../../../../app/ui/Toast';
import {
  assetFolders,
  assetUsedBy,
  deleteAsset,
  deleteAssets,
  duplicateAsset,
  getManifest,
  replaceAssetWithFile,
  setAssetProps,
  setAssetsProps,
  subscribeManifest,
  type AssetRecord,
} from '@bs/engine';
import { ASSET_CATEGORIES, IMPORT_ACCEPT } from '../../../../engine/assetIngest';
import { getUIState, setUIState, toggleAssetSelection, useUIState } from '@bs/engine';
import { MIME_ASSET } from '../../utils/dnd';

function AssetThumb({ asset }: { asset: AssetRecord }) {
  if (
    (asset.category === 'Images' || asset.category === 'SVG' || asset.category === 'Textures') &&
    asset.url
  ) {
    return <img className="uk-assetcard__img" src={asset.url} alt={asset.name} draggable={false} />;
  }
  if (asset.category === 'Videos' && asset.url) {
    return <video className="uk-assetcard__img" src={asset.url} muted playsInline />;
  }
  if (asset.category === '3D Models') return <span className="bs-assetglyph">{Icons.cube}</span>;
  if (asset.category === 'Audio') return <span className="bs-assetglyph">{Icons.audio}</span>;
  if (asset.category === 'Videos') return <span className="bs-assetglyph">{Icons.video}</span>;
  if (asset.category === 'Fonts') return <span style={{ fontSize: 24, fontWeight: 700 }}>Aa</span>;
  return <span className="bs-assetglyph">{Icons.image}</span>;
}

function sizeLabel(a: AssetRecord): string {
  if (a.size === undefined) return a.stats;
  return a.size >= 1024 * 1024
    ? `${(a.size / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(a.size / 1024))} KB`;
}

export function AssetWorkspace({ onImport }: { onImport: (files: File[]) => void }) {
  const selected = useUIState((s) => s.selectedAssetId);
  const selectedIds = useUIState((s) => s.selectedAssetIds);
  const cat = useUIState((s) => s.selectedAssetCategory);
  const [folder, setFolder] = useState('All');
  const [favOnly, setFavOnly] = useState(false);
  const [search, setSearch] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replacingId = useRef<string | null>(null);
  const [, force] = useState(0);
  useEffect(() => subscribeManifest(() => force((n) => n + 1)), []);

  const m = getManifest();
  const folders = assetFolders();
  const assets = m.assets
    .filter((a) => cat === 'All' || a.category === cat)
    .filter((a) => folder === 'All' || (folder === '(no folder)' ? !a.folder : a.folder === folder))
    .filter((a) => !favOnly || a.favorite)
    .filter(
      (a) =>
        !search ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        (a.tags ?? []).some((t) => t.toLowerCase().includes(search.toLowerCase())),
    );

  const startReplace = (assetId: string) => {
    replacingId.current = assetId;
    replaceRef.current?.click();
  };

  const bulkMoveToFolder = () => {
    const name = window.prompt('Move selection to folder (empty clears the folder):', '');
    if (name === null) return;
    setAssetsProps(selectedIds, { folder: name.trim() || undefined });
    toast(`${selectedIds.length} asset(s) moved — one Ctrl+Z reverts all`);
  };

  return (
    <div className="bs-assetstudio">
      {/* Toolbar */}
      <div className="bs-row bs-assetstudio__toolbar">
        {/* folder filter (Phase 2.10   " AS-2) */}
        <select
          className="uk-select bs-assetstudio__folder"
          value={folder}
          aria-label="Folder filter"
          onChange={(e) => setFolder(e.target.value)}
        >
          {['All', '(no folder)', ...folders].map((f) => (
            <option key={f} value={f}>
              {f === 'All' ? 'All folders' : f}
            </option>
          ))}
        </select>
        <button
          className={`uk-filterchip ${favOnly ? 'uk-filterchip--on' : ''}`}
          title="Show favorites only"
          aria-pressed={favOnly}
          onClick={() => setFavOnly((f) => !f)}
        >
          <span className="bs-inlineicon">{favOnly ? Icons.starFilled : Icons.star}</span> Favorites
        </button>
        <span className="bs-spacer" />
        <div style={{ width: 240 }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name or #tag…" />
        </div>
        <button
          className="uk-filterchip uk-filterchip--on"
          title="Import - 3D, images, SVG, video, audio, fonts, textures, HDR (FR-180)"
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
            onImport(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
        {/* REAL replace picker (Phase 2.10   " FR-183, audit AS-5) */}
        <input
          ref={replaceRef}
          type="file"
          accept={IMPORT_ACCEPT}
          className="bs-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            const id = replacingId.current;
            replacingId.current = null;
            e.target.value = '';
            if (!file || !id) return;
            const asset = getManifest().assets.find((a) => a.id === id);
            replaceAssetWithFile(id, file);
            toast(`${asset?.name ?? 'Asset'} replaced with ${file.name} — new version, references reload`);
          }}
        />
      </div>

      {/* bulk action bar (Phase 2.10   " AS-2): appears with 2+ selected */}
      {selectedIds.length > 1 && (
        <div className="bs-bulkbar" role="toolbar" aria-label="Bulk asset actions">
          <span className="bs-bulkbar__count">{selectedIds.length} selected</span>
          <button
            onClick={() => {
              setAssetsProps(selectedIds, { favorite: true });
              toast('Selection marked favorite — one Ctrl+Z reverts');
            }}
          >
            <span className="bs-inlineicon">{Icons.star}</span> Favorite
          </button>
          <button onClick={bulkMoveToFolder}>
            <span className="bs-inlineicon">{Icons.folder}</span> Move to folder   
          </button>
          <button
            onClick={() => {
              const { deleted, skipped } = deleteAssets(selectedIds);
              if (deleted) toast(`${deleted} asset(s) deleted`);
              if (skipped.length) toast(`In use, kept: ${skipped.join(', ')} (soft-delete law)`);
            }}
          >
            <span className="bs-inlineicon">{Icons.trash}</span> Delete
          </button>
          <button onClick={() => setUIState({ selectedAssetId: null, selectedAssetIds: [] })}>Clear</button>
        </div>
      )}

      {/* Grid */}
      <div className="uk-assetgrid bs-assetstudio__grid">
        {assets.map((a) => {
          const used = assetUsedBy(a);
          const isSel = selectedIds.includes(a.id);
          return (
            <div
              key={a.id}
              className="uk-assetcard"
              style={{ cursor: 'pointer', borderColor: isSel ? 'var(--accent)' : undefined }}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey || e.shiftKey)
                  toggleAssetSelection(a.id); // bulk (AS-2)
                else setUIState({ selectedAssetId: a.id });
              }}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(MIME_ASSET, a.id);
                e.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <div className="uk-assetcard__thumb" style={{ aspectRatio: '16/10' }}>
                <AssetThumb asset={a} />
                <button
                  className={`bs-favtoggle ${a.favorite ? 'bs-favtoggle--on' : ''}`}
                  title={a.favorite ? 'Remove favorite' : 'Mark favorite'}
                  aria-label={`${a.favorite ? 'Unfavorite' : 'Favorite'} ${a.name}`}
                  aria-pressed={!!a.favorite}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAssetProps(a.id, { favorite: !a.favorite });
                  }}
                >
                  {a.favorite ? Icons.starFilled : Icons.star}
                </button>
              </div>
              <div className="uk-assetcard__name">
                {a.name}
                {selected === a.id && !isSel ? null : null}
              </div>
              <div className="uk-assetcard__meta">
                v{a.version}  * {sizeLabel(a)}
                {a.folder ? `  * ${a.folder}` : ''}
                {used > 0 ? `  * used  -${used}` : ''}
              </div>
              {(a.tags?.length ?? 0) > 0 && (
                <div className="bs-assettags">
                  {a.tags!.map((t) => (
                    <span key={t} className="bs-assettag">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
              <div className="uk-assetcard__actions">
                <button
                  title="Replace - pick a file; creates a new version (FR-183)"
                  aria-label={`Replace ${a.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    startReplace(a.id);
                  }}
                >
                  {Icons.replace}
                </button>
                <button
                  title="Duplicate"
                  aria-label={`Duplicate ${a.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateAsset(a.id);
                  }}
                >
                  {Icons.duplicate}
                </button>
                <button
                  title="Delete"
                  aria-label={`Delete ${a.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (deleteAsset(a.id)) {
                      if (getUIState().selectedAssetId === a.id) setUIState({ selectedAssetId: null });
                      toast(`${a.name} deleted`);
                    } else {
                      toast(`${a.name} is in use — remove references first`);
                    }
                  }}
                >
                  {Icons.trash}
                </button>
              </div>
            </div>
          );
        })}
        {assets.length === 0 && (
          <div className="bs-muted bs-p-24">
            No assets match this filter.
          </div>
        )}
      </div>
    </div>
  );
}
