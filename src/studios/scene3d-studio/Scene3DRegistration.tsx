export interface InspectorContext { subTab: string; query: string; }
/**
 * 3D Studio's inspector contribution.
 * Owns what `shared/InspectorPanel.tsx` used to hold for this studio.
 * Registration happens at module scope, so importing this file wires it in.
 */
import { CollapsibleSection } from './components/common/CollapsibleSection';
import { ColorField, FieldRow, NumberField, SelectField } from './components/common/Fields';
import { Icons } from '../../app/ui/Icons';
import { getManifest, setEnvironmentProp, useUIState } from '@bs/engine';
import { InspectorObjectHeader } from './components/inspector/InspectorObjectHeader';
import { Scene3DInspector } from './components/inspector/Scene3DInspector';
import { Scene3DSidebar } from './components/sidebar/Scene3DSidebar';

const SCENE_ICON: Record<string, React.ReactNode> = {
  mesh: Icons.cube,
  group: Icons.group,
  camera: Icons.camera,
  light: Icons.light,
  anchor: Icons.anchor,
};

export function Scene3DStudioInspector({ subTab, query }: InspectorContext) {
  const selScene = useUIState((s) => s.selectedSceneNodeId);
  const m = getManifest();

  let header = null;
  let body: React.ReactNode = null;

  if (selScene && m.sceneNodes[selScene]) {
    const node = m.sceneNodes[selScene];
    header = (
      <InspectorObjectHeader
        kind={`scene · ${node.id}`}
        name={node.label}
        icon={SCENE_ICON[node.type] ?? Icons.container}
      />
    );
    body = <Scene3DInspector sceneNode={node} query={query} subTab={subTab} />;
  } else {
    header = (
      <InspectorObjectHeader
        kind="Scene Lights, Cameras & HDR"
        name="3D Environment & Stage"
        icon={Icons.cube}
      />
    );
    
    const env = m.environment;
    const NONE = '(none)';
    const hdrAssets = m.assets.filter((a) => a.category === 'HDR' && a.url);
    const currentHdr = env.hdrAssetId ? m.assets.find((a) => a.id === env.hdrAssetId) : undefined;
    const rows: { label: string; el: React.ReactNode }[] = [
      {
        label: 'Environment Image',
        el: (
          <SelectField
            value={currentHdr?.name ?? (env.hdrAssetId ? '(missing asset)' : NONE)}
            options={[NONE, ...hdrAssets.map((a) => a.name)]}
            onChange={(name) =>
              setEnvironmentProp(
                'hdrAssetId',
                name === NONE ? undefined : hdrAssets.find((a) => a.name === name)?.id,
              )
            }
          />
        ),
      },
      {
        label: 'Background',
        el: (
          <SelectField
            value={env.background}
            options={['color', 'hdr']}
            onChange={(v) => setEnvironmentProp('background', v)}
          />
        ),
      },
      {
        label: 'Background Color',
        el: (
          <ColorField
            value={env.backgroundColor}
            onChange={(v) => setEnvironmentProp('backgroundColor', v, true)}
          />
        ),
      },
      {
        label: 'Environment Intensity',
        el: (
          <NumberField
            value={env.envIntensity}
            min={0}
            max={4}
            step={0.1}
            onChange={(v) => setEnvironmentProp('envIntensity', v)}
            onScrub={(v) => setEnvironmentProp('envIntensity', v, true)}
          />
        ),
      },
    ].filter((r) => !query || r.label.toLowerCase().includes(query.toLowerCase()));
    
    body = (
      <>
        <div className="bs-muted bs-mono bs-insp-body-pad-sm">
          scene · environment
        </div>
        <CollapsibleSection title="Lighting">
          {rows.map((r) => (
            <FieldRow key={r.label} label={r.label}>
              {r.el}
            </FieldRow>
          ))}
          <div className="bs-muted bs-insp-env-hint">
            Import a .hdr file in the Asset Studio, then pick it here — every PBR material responds to the environment.
          </div>
        </CollapsibleSection>
      </>
    );
  }

  return (
    <>
      {header}
      {body}
    </>
  );
}

