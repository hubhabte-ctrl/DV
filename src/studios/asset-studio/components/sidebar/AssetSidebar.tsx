/**
 * Asset Studio's left rail panel contribution (Phase 3 decoupling).
 */
import { AssetFolderTree, AssetLibraryPanel } from '../panels/AssetLibraryPanel';

export interface RailPanelProps {
  search: string;
}

export function AssetSidebar({ search }: RailPanelProps) {
  return <AssetFolderTree search={search} />;
}
