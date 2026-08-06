export interface InspectorContext { subTab: string; query: string; }
/**
 * Animation Studio's inspector contribution.
 * Owns what `shared/InspectorPanel.tsx` used to hold for this studio.
 * Registration happens at module scope, so importing this file wires it in.
 */
import { CollapsibleSection } from './components/common/CollapsibleSection';
import { FieldRow, NumberField, SelectField } from './components/common/Fields';
import { Icons } from '../../app/ui/Icons';
import { getManifest, setTrackKeyframes, useUIState } from '@bs/engine';
import { InspectorObjectHeader } from './components/inspector/InspectorObjectHeader';
import { AnimateKeyframeInspector } from './components/inspector/AnimateKeyframeInspector';
import { AnimateSidebar } from './components/sidebar/AnimateSidebar';

export function AnimateStudioInspector({ subTab, query }: InspectorContext) {
  // AnimateKeyframeInspector internally handles track selection, 
  // active keyframe logic, and its own ObjectIdentityHeader.
  return <AnimateKeyframeInspector subTab={subTab as never} />;
}

