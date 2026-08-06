/**
 * Material Studio   " full-viewport look-dev instrument.
 *   * Left     " Outer LeftRail (scene hierarchy & layer tree)
 *   * Center   " MaterialLookDevViewport (orbitable preview, lighting/mesh/bg/A-B)
 *   * Right    " Outer InspectorPanel (Material Architect PBR controls)
 */
import { MaterialLookDevViewport } from './MaterialLookDevViewport';

export function MaterialWorkspace() {
  return (
    <div className="bs-matstudio">
      <div className="bs-matstudio__viewport">
        <MaterialLookDevViewport />
      </div>
    </div>
  );
}
