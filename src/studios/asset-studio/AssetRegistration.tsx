export interface InspectorContext { subTab: string; query: string; }
/**
 * Asset Studio's inspector contribution.
 *
 * Owns what `shared/InspectorPanel.tsx` used to hold for this studio: the tab
 * strip, the identity header, and the body (including the no-asset empty state).
 * Registration happens at module scope, so importing this file from `index.ts`
 * is what wires the studio in.
 */
import { Icons } from '../../app/ui/Icons';
import { getManifest, useUIState } from '@bs/engine';
import { InspectorObjectHeader } from './components/inspector/InspectorObjectHeader';
import { AssetInspector } from './components/inspector/AssetInspector';

export function AssetStudioInspector({ subTab, query }: InspectorContext) {
  const selAsset = useUIState((s) => s.selectedAssetId);
  const m = getManifest();

  /* `InspectorPanel.tsx:582` and `:770` both resolved the asset this way   "
     the explicit selection, else the first asset in the library. */
  const asset = selAsset ? m.assets.find((a) => a.id === selAsset) : m.assets[0];

  return (
    <>
      {/* `InspectorPanel.tsx:770-781`: the header shows either the resolved
          asset's identity or a fixed library-level fallback. Both branches set
          `hasSelection = true`, so the header always renders. */}
      <InspectorObjectHeader
        kind={asset ? `asset  * ${asset.id}` : 'Media & 3D Asset Library'}
        name={asset ? asset.name : 'Asset Inspector'}
        icon={Icons.image}
      />
      {asset ? (
        <AssetInspector asset={asset} query={query} subTab={subTab as never} />
      ) : (
        /* `InspectorPanel.tsx:586-590`, verbatim. */
        <div className="bs-muted bs-insp-body-pad">
          No asset selected. Select an asset in the Asset Studio library.
        </div>
      )}
    </>
  );
}

