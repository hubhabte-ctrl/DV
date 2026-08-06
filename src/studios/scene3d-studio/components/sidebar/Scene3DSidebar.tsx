/**
 * 3D Studio's left rail panel contribution (Phase 3 decoupling).
 * Provides the Layers and Assets tabs.
 */
import { Scene3DAssetPanel } from '../panels/Scene3DAssetPanel';
import { SceneTreePanel } from '../panels/SceneTreePanel';

export interface RailPanelProps {
  tab: string;
  search: string;
}

export function Scene3DSidebar({ tab, search }: RailPanelProps) {
  if (tab === 'scene') {
    return <SceneTreePanel search={search} />;
  }

  if (tab === 'assets') {
    return <Scene3DAssetPanel search={search} />;
  }

  return null;
}
