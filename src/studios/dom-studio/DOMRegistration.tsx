export interface InspectorContext { subTab: string; query: string; }
/**
 * DOM Studio's inspector contribution.
 * Owns what `shared/InspectorPanel.tsx` used to hold for this studio.
 * Registration happens at module scope, so importing this file wires it in.
 */
import { CollapsibleSection } from './components/common/CollapsibleSection';
import { ColorField, FieldRow, NumberField, SelectField, TextField, Vector3Field } from './components/common/Fields';
import { Icons } from '../../app/ui/Icons';
import {
  addDesignToken,
  dispatch,
  getManifest,
  removeDesignToken,
  setDesignTokenProp,
  setEnvironmentProp,
  setStageProp,
  setWaypointProp,
  setUIState,
  useUIState,
} from '@bs/engine';
import { toast } from '../../app/ui/Toast';
import { InspectorObjectHeader } from './components/inspector/InspectorObjectHeader';
import { DOMInspector } from './components/inspector/DOMInspector';
import { DOMSidebar } from './components/sidebar/DOMSidebar';

const DOM_ICON: Record<string, React.ReactNode> = {
  section: Icons.section,
  container: Icons.container,
  heading: Icons.heading,
  text: Icons.text,
  button: Icons.buttonEl,
  image: Icons.image,
  scene3d: Icons.cube,
};

export function DomStudioInspector({ subTab, query }: InspectorContext) {
  const profile = useUIState((s) => s.profile);
  const selDom = useUIState((s) => s.selectedDomNodeId);
  const selWp = useUIState((s) => s.selectedWaypointId);
  const stageSelected = useUIState((s) => s.stageSelected);
  const m = getManifest();

  let header = null;
  let body: React.ReactNode = null;

  if (selDom && m.domNodes[selDom]) {
    const node = m.domNodes[selDom];
    header = (
      <InspectorObjectHeader
        kind={`${node.tag} · ${node.id}`}
        name={node.label}
        icon={DOM_ICON[node.type] ?? Icons.container}
      />
    );
    
    const isSectionRoot = m.domRootOrder.includes(node.id);
    const boundTracks = m.tracks.filter((t) => t.target === node.id);
    body = (
      <DOMInspector
        node={node}
        profile={profile}
        query={query}
        subTab={subTab}
        isSectionRoot={isSectionRoot}
        boundTracks={boundTracks}
      />
    );
  } else if (stageSelected) {
    header = (
      <InspectorObjectHeader
        kind="stage · scroll-driven 3D scene"
        name={m.stage.label}
        icon={Icons.cube}
      />
    );
    
    const stage = m.stage;
    const matchesL = (label: string) => !query || label.toLowerCase().includes(query.toLowerCase());
    const activeCam = Object.values(m.sceneNodes).find((n) => n.type === 'camera' && n.props?.active);
    const lights = Object.values(m.sceneNodes).filter((n) => n.type === 'light');
    const NONE = '(none)';
    const hdrAssets = m.assets.filter((a) => a.category === 'HDR' && a.url);
    const currentHdr = m.environment.hdrAssetId
      ? m.assets.find((a) => a.id === m.environment.hdrAssetId)
      : undefined;
    const sceneTracks = m.tracks.filter((t) => m.sceneNodes[t.target]);
    
    body = (
      <>
        <div className="bs-muted bs-mono bs-insp-body-pad-sm">
          stage · scroll-driven 3D scene
        </div>
        <CollapsibleSection title="Scroll Background">
          {matchesL('label') && (
            <FieldRow label="Label">
              <TextField value={stage.label} onChange={(v) => setStageProp('label', v, true)} />
            </FieldRow>
          )}
          {matchesL('mode') && (
            <FieldRow label="Mode">
              <SelectField
                value={stage.mode === 'full' ? 'Full Page' : 'Single Section'}
                options={['Full Page', 'Single Section']}
                onChange={(v) => setStageProp('mode', v === 'Full Page' ? 'full' : 'section')}
              />
            </FieldRow>
          )}
          {stage.mode === 'section' && matchesL('section') && (
            <FieldRow label="Section">
              <SelectField
                value={m.sections.find((s) => s.id === stage.sectionId)?.name ?? m.sections[0]?.name ?? ''}
                options={m.sections.map((s) => s.name)}
                onChange={(name) => setStageProp('sectionId', m.sections.find((s) => s.name === name)?.id)}
              />
            </FieldRow>
          )}
          {matchesL('behavior') && (
            <FieldRow label="Behavior">
              <SelectField
                value={stage.placement === 'background' ? 'Background' : 'Overlay'}
                options={['Background', 'Overlay']}
                onChange={(v) => setStageProp('placement', v === 'Background' ? 'background' : 'overlay')}
              />
            </FieldRow>
          )}
          {matchesL('visible') && (
            <FieldRow label="Visible">
              <SelectField
                value={stage.visible ? 'Yes' : 'No'}
                options={['Yes', 'No']}
                onChange={(v) => setStageProp('visible', v === 'Yes')}
              />
            </FieldRow>
          )}
          {matchesL('opacity') && (
            <FieldRow label="Opacity">
              <NumberField
                value={stage.opacity}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => setStageProp('opacity', v)}
                onScrub={(v) => setStageProp('opacity', v, true)}
              />
            </FieldRow>
          )}
        </CollapsibleSection>
        {activeCam && (
          <CollapsibleSection title={`Camera · ${activeCam.label}`}>
            {matchesL('fov') && activeCam.props?.fov !== undefined && (
              <FieldRow label="Field of View">
                <NumberField
                  value={Number(activeCam.props.fov)}
                  min={10}
                  max={120}
                  step={1}
                  unit="°"
                  onChange={(v) =>
                    dispatch({
                      type: 'set',
                      path: `sceneNodes.${activeCam.id}.props.fov`,
                      value: v,
                      coalesceKey: `${activeCam.id}.fov`,
                    })
                  }
                />
              </FieldRow>
            )}
            {matchesL('position') && (
              <FieldRow label="Position">
                <Vector3Field
                  value={activeCam.transform.position}
                  step={0.1}
                  onChange={(v) =>
                    dispatch({
                      type: 'set',
                      path: `sceneNodes.${activeCam.id}.transform.position`,
                      value: v,
                      coalesceKey: `${activeCam.id}.position`,
                    })
                  }
                />
              </FieldRow>
            )}
            <div className="bs-muted bs-insp-hint">
              Camera tracks on the Experience Timeline override this base value while scrolling — edit them
              below or in the Timeline Studio.
            </div>
          </CollapsibleSection>
        )}
        <CollapsibleSection title={`Lighting · ${lights.length}`}>
          {lights.map((l) => (
            <div key={l.id} className="bs-insp-light-divider">
              {matchesL(l.label) && l.props?.intensity !== undefined && (
                <FieldRow label={l.label}>
                  <NumberField
                    value={Number(l.props.intensity)}
                    min={0}
                    max={10}
                    step={0.1}
                    onChange={(v) =>
                      dispatch({
                        type: 'set',
                        path: `sceneNodes.${l.id}.props.intensity`,
                        value: v,
                        coalesceKey: `${l.id}.intensity`,
                      })
                    }
                    onScrub={(v) =>
                      dispatch({
                        type: 'set',
                        path: `sceneNodes.${l.id}.props.intensity`,
                        value: v,
                        coalesceKey: `${l.id}.intensity`,
                      })
                    }
                  />
                </FieldRow>
              )}
              {matchesL(l.label) && l.props?.color !== undefined && (
                <FieldRow label="Color">
                  <ColorField
                    value={String(l.props.color)}
                    onChange={(v) =>
                      dispatch({
                        type: 'set',
                        path: `sceneNodes.${l.id}.props.color`,
                        value: v,
                        coalesceKey: `${l.id}.color`,
                      })
                    }
                  />
                </FieldRow>
              )}
            </div>
          ))}
          {lights.length === 0 && (
            <div className="bs-muted bs-insp-hint">
              No lights in the scene — add them in the 3D Studio.
            </div>
          )}
        </CollapsibleSection>
        <CollapsibleSection title="Environment">
          {matchesL('hdr env environment image') && (
            <FieldRow label="Environment Image">
              <SelectField
                value={currentHdr?.name ?? (m.environment.hdrAssetId ? '(missing asset)' : NONE)}
                options={[NONE, ...hdrAssets.map((a) => a.name)]}
                onChange={(name) =>
                  setEnvironmentProp(
                    'hdrAssetId',
                    name === NONE ? undefined : hdrAssets.find((a) => a.name === name)?.id,
                  )
                }
              />
            </FieldRow>
          )}
          {matchesL('background') && (
            <FieldRow label="Background">
              <SelectField
                value={m.environment.background}
                options={['color', 'hdr']}
                onChange={(v) => setEnvironmentProp('background', v)}
              />
            </FieldRow>
          )}
          {matchesL('bg color background color') && (
            <FieldRow label="Background Color">
              <ColorField
                value={m.environment.backgroundColor}
                onChange={(v) => setEnvironmentProp('backgroundColor', v, true)}
              />
            </FieldRow>
          )}
          {matchesL('env power environment intensity') && (
            <FieldRow label="Environment Intensity">
              <NumberField
                value={m.environment.envIntensity}
                min={0}
                max={4}
                step={0.1}
                onChange={(v) => setEnvironmentProp('envIntensity', v)}
                onScrub={(v) => setEnvironmentProp('envIntensity', v, true)}
              />
            </FieldRow>
          )}
        </CollapsibleSection>
        <CollapsibleSection title={`Scroll Animation · ${sceneTracks.length} tracks`}>
          {sceneTracks.map((t) => (
            <div
              key={t.id}
              className="uk-tree__row bs-insp-track-row"
              onClick={() => setUIState({ mode: 'animate', selectedTrackId: t.id })}
            >
              <span className="uk-tree__label">{t.label}</span>
              <span className="bs-muted bs-mono bs-insp-track-meta">
                {t.channel} · {t.keyframes.length} keys
              </span>
            </div>
          ))}
          <div className="bs-muted bs-insp-env-hint">
            The stage consumes the shared Experience Timeline — one [0,1] scroll clock drives camera, objects,
            lights and materials (Rule 7). Click a track to edit it; scene contents are edited in the 3D
            Studio.
          </div>
        </CollapsibleSection>
      </>
    );
  } else if (selWp) {
    const wp = (m.waypoints ?? []).find((w) => w.id === selWp);
    if (wp) {
      header = (
        <InspectorObjectHeader
          kind={`waypoint · ${wp.id}`}
          name={wp.label}
          icon={Icons.anchor}
        />
      );
      
      const anchorIds = Object.values(m.sceneNodes)
        .filter((n) => n.type === 'anchor')
        .map((n) => n.id);
      const rows: { label: string; el: React.ReactNode }[] = [
        {
          label: 'Label',
          el: <TextField value={wp.label} onChange={(v) => setWaypointProp(wp.id, 'label', v, true)} />,
        },
        {
          label: 'Content',
          el: <TextField value={wp.content} onChange={(v) => setWaypointProp(wp.id, 'content', v, true)} />,
        },
        {
          label: 'Bind Anchor',
          el: (
            <SelectField
              value={wp.anchorId}
              options={anchorIds}
              onChange={(v) => setWaypointProp(wp.id, 'anchorId', v)}
            />
          ),
        },
        {
          label: 'Direction',
          el: (
            <SelectField
              value={wp.direction}
              options={['left', 'right']}
              onChange={(v) => setWaypointProp(wp.id, 'direction', v)}
            />
          ),
        },
        {
          label: 'Edge Clamp',
          el: (
            <SelectField
              value={wp.clamp ? 'On' : 'Off'}
              options={['On', 'Off']}
              onChange={(v) => setWaypointProp(wp.id, 'clamp', v === 'On')}
            />
          ),
        },
        {
          label: 'From',
          el: (
            <NumberField
              value={wp.range[0]}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => setWaypointProp(wp.id, 'range', [v, wp.range[1]])}
            />
          ),
        },
        {
          label: 'To',
          el: (
            <NumberField
              value={wp.range[1]}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => setWaypointProp(wp.id, 'range', [wp.range[0], v])}
            />
          ),
        },
      ].filter((r) => !query || r.label.toLowerCase().includes(query.toLowerCase()));
      
      body = (
        <>
          <div className="bs-p-sm bs-muted bs-mono">
            waypoint · {wp.id} — {wp.anchorId}
          </div>
          <CollapsibleSection title="Waypoint Binding">
            {rows.map((r) => (
              <FieldRow key={r.label} label={r.label}>
                {r.el}
              </FieldRow>
            ))}
          </CollapsibleSection>
        </>
      );
    }
  } else {
    // Nothing selected: Design Tokens panel
    const tokens = m.designTokens ?? [];
    body = (
      <>
        <div className="bs-muted bs-mono bs-insp-body-pad-sm">
          page · design tokens
        </div>
        <CollapsibleSection title={`Design Tokens · ${tokens.length}`}>
          {tokens.map((t) => (
            <div key={t.id} className="bs-tokenrow">
              <TextField value={t.name} onChange={(v) => setDesignTokenProp(t.id, 'name', v, true)} />
              {/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(t.value)) ? (
                <ColorField
                  value={String(t.value)}
                  onChange={(v) => setDesignTokenProp(t.id, 'value', v, true)}
                />
              ) : (
                <TextField
                  value={String(t.value)}
                  onChange={(v) =>
                    setDesignTokenProp(t.id, 'value', /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : v, true)
                  }
                />
              )}
              <button
                className="uk-iconbtn"
                title={`Delete token $${t.name}`}
                aria-label={`Delete token ${t.name}`}
                onClick={() => removeDesignToken(t.id)}
              >
                {Icons.trash}
              </button>
            </div>
          ))}
          <div className="bs-insp-token-add">
            <button
              className="uk-btn uk-btn--secondary uk-btn--sm"
              onClick={() => {
                const t = addDesignToken(`token-${tokens.length + 1}`, '#7a98fd');
                toast(`$${t.name} created — reference it from any style field`);
              }}
            >
              + Add token
            </button>
          </div>
          <div className="bs-muted bs-insp-hint">
            Write <span className="bs-mono">$name</span> in any style field to bind it — editing the token
            updates every bound element (01 DesignTokens).
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

