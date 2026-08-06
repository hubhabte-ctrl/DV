export interface InspectorContext { subTab: string; query: string; }
/**
 * Material Studio's inspector contribution.
 *
 * Owns what `shared/InspectorPanel.tsx` used to hold for this studio: the tab
 * strip, the identity header, and the body. Registration happens at module
 * scope, so importing this file from `index.ts` is what wires the studio in.
 *
 * Changing any of this now touches only `studios/material-studio/**`.
 */
import { Icons } from '../../app/ui/Icons';
import { InspectorObjectHeader } from './components/inspector/InspectorObjectHeader';
import { MaterialInspector } from './components/inspector/MaterialInspector';
import { MaterialSidebar } from './components/sidebar/MaterialSidebar';

export function MaterialStudioInspector({ subTab, query }: InspectorContext) {
  return (
    <>
      {/* `InspectorPanel.tsx:759-762`: fixed identity   " this studio inspects the
          active material, not a tree selection, so the header never varies. */}
      <InspectorObjectHeader
        kind="material studio"
        name="Global Materials"
        icon={Icons.palette}
      />
      <MaterialInspector query={query} subTab={subTab} />
    </>
  );
}

