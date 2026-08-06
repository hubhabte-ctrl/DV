/**
 * Material Studio's left rail panel contribution (Phase 3 decoupling).
 * Provides the Layers tab (Material Library).
 */
import { Icons } from '../../../../app/ui/Icons';
import { toast } from '../../../../app/ui/Toast';
import { getManifest, setUIState, useUIState } from '@bs/engine';
import { MaterialSceneTree } from '../panels/MaterialSceneTree';

export interface RailPanelProps {
  tab: string;
  search: string;
}

export function MaterialSidebar({ tab, search }: RailPanelProps) {
  const selMaterial = useUIState((s) => s.selectedMaterialId);

  if (tab === 'layers') {
    return <MaterialSceneTree search={search} />;
  }

  if (tab !== 'materials') return null;

  return (
    <div className="bs-mat-tab">
      <div className="bs-grouphead bs-mat-tab-header">
        Material Library
        <button
          type="button"
          className="uk-iconbtn"
          title="New material"
          style={{ marginLeft: 'auto' }}
          onClick={() => toast('New material created', 'ok')}
        >
          {Icons.plus ?? '+'}
        </button>
      </div>
      {Object.values(getManifest().materials ?? {})
        .filter(
          (mat) =>
            !search ||
            mat.name.toLowerCase().includes(search.toLowerCase()),
        )
        .map((mat) => (
          <div
            key={mat.id}
            className={`uk-tree__row bs-mat-row ${selMaterial === mat.id ? 'uk-tree__row--selected' : ''}`}
            onClick={() => setUIState({ selectedMaterialId: mat.id })}
          >
            {/* Colour swatch   " dynamic value bridge (plan   3.3) */}
            <span
              className="bs-mat-swatch"
              style={{ background: mat.baseColor ?? '#8a96b0' }}
            />
            <span className="uk-tree__label bs-mat-label">
              {mat.name}
            </span>
            <span className="bs-muted bs-mono bs-mat-type">
              PBR
            </span>
          </div>
        ))}
      {Object.keys(getManifest().materials ?? {}).length === 0 && (
        <div className="bs-muted bs-mat-empty">
          No materials yet   " import a GLB or create one.
        </div>
      )}
    </div>
  );
}
