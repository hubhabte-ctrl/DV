/**
 * Scene3D Inspector Component   " 3D Studio purpose-built inspector (WS2-3a, issues.md).
 * Provides specialized 3D tabs for:
 *  - Transform: Position, Rotation, Scale, Pivot & 2D Placement
 *  - Mesh: 3D Asset GLB Model Picker, Cast/Receive Shadows, Subdivisions, Geometry
 *  - Material: PBR Material Picker, Base Color, Metallic, Roughness, Emissive, Maps
 *  - Lighting & Env: Camera FOV, Distance, Light Intensities, HDR Environment, Env Power
 */
import React from 'react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { ColorField, FieldRow, NumberField, NumberSliderField, SelectField, Vector3Field } from '../common/Fields';
import { SegmentedControl } from '../common/SegmentedControl';
import { toast } from '../../../../app/ui/Toast';
import {
  dispatch,
  getManifest,
  resolveStyle,
  scene3dSettingsOf,
  setScene3dSetting,
  setEnvironmentProp,
  setStyleValue,
  type DomNode,
  type SceneNode,
} from '@bs/engine';
import { useUIState } from '@bs/engine';
import { MaterialChannels } from './MaterialChannels';
import { MaterialInspector } from './MaterialInspector';
import type { Material } from '@bs/engine';

//  "  "  Material Slot Card Grid  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 
/**
 * Renders material slots with a tab nav (All / Slots / Ref Points / Presets)
 * auto-categorized from material names.
 * Each item = [sphere preview LEFT] + [name RIGHT], 4 per dark row band.
 */

type MatCategory = 'all' | 'slots' | 'refs' | 'presets';

/** Detect which category a label falls into */
function categorize(label: string): 'refs' | 'presets' | 'slots' {
  if (/ref[\s_]?point/i.test(label)) return 'refs';
  // All-caps (shader presets like CARBON WEAVE, BRUSHED STEEL)
  if (label.trim().length > 1 && label.trim() === label.trim().toUpperCase()) return 'presets';
  return 'slots';
}

function MatSlotGrid({
  materials,
  activeMaterialId,
  query,
  matLabel,
  onSelect,
}: {
  materials: Material[];
  activeMaterialId: string | undefined;
  query: string;
  matLabel: (name: string) => string;
  onSelect: (mat: Material) => void;
}) {
  const [activeTab, setActiveTab] = React.useState<MatCategory>('all');

  const buildSphere = (mat: Material) => {
    const baseColor = String(mat.baseColor ?? '#888888');
    const metallic = Number(mat.metallic ?? 0);
    const roughness = Number(mat.roughness ?? 0.5);
    const specularStrength = metallic > 0.5 ? 0.9 : 0.4;
    const highlightAlpha = Math.max(0.15, specularStrength - roughness * 0.6);
    const rimDark = roughness > 0.6 ? 0.55 : roughness > 0.3 ? 0.38 : 0.25;
    const hlColor =
      metallic > 0.6
        ? `rgba(255,255,255,${(highlightAlpha * 0.85).toFixed(2)})`
        : `rgba(255,255,255,${(highlightAlpha * 0.6).toFixed(2)})`;
    const rimColor = `rgba(0,0,0,${rimDark.toFixed(2)})`;
    return [
      `radial-gradient(circle at 35% 30%, ${hlColor} 0%, transparent 48%)`,
      `radial-gradient(circle at 68% 70%, ${rimColor} 0%, transparent 52%)`,
      `radial-gradient(circle at 50% 50%, ${baseColor} 0%, ${baseColor} 100%)`,
    ].join(', ');
  };

  // Apply search first
  const searched = materials.filter(
    (mat) => !query || matLabel(mat.name).toLowerCase().includes(query.toLowerCase()),
  );

  // Build category buckets
  const buckets: Record<'slots' | 'refs' | 'presets', Material[]> = {
    slots: [],
    refs: [],
    presets: [],
  };
  for (const mat of searched) {
    buckets[categorize(matLabel(mat.name))].push(mat);
  }

  // Tab definitions   " only show tabs that have items
  const TABS: { key: MatCategory; label: string }[] = [
    { key: 'all', label: `All (${searched.length})` },
    ...(buckets.slots.length ? [{ key: 'slots' as const, label: `Slots (${buckets.slots.length})` }] : []),
    ...(buckets.refs.length ? [{ key: 'refs' as const, label: `Refs (${buckets.refs.length})` }] : []),
    ...(buckets.presets.length ? [{ key: 'presets' as const, label: `Presets (${buckets.presets.length})` }] : []),
  ];

  const visible =
    activeTab === 'all'
      ? searched
      : activeTab === 'slots'
        ? buckets.slots
        : activeTab === 'refs'
          ? buckets.refs
          : buckets.presets;

  // Chunk into rows of 4
  const rows: Material[][] = [];
  for (let i = 0; i < visible.length; i += 4) {
    rows.push(visible.slice(i, i + 4));
  }

  return (
    <div className="bs-flex-col">
      {/*  "  "  Tab Nav  "  "  */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: '6px 8px 4px',
          borderBottom: '1px solid var(--border)',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '3px 9px',
                fontSize: 'var(--text-label)',
                fontWeight: isActive ? 600 : 400,
                borderRadius: 5,
                border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: isActive ? 'var(--accent-soft)' : 'var(--bs-color-bg-hover)',
                color: isActive ? 'var(--accent)' : 'var(--ink-3)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.12s',
                letterSpacing: '0.02em',
                flexShrink: 0,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/*  "  "  Slot cards  "  "  */}
      {visible.length === 0 ? (
        <div className="bs-p-md bs-text-xs bs-text-muted">
          No slots in this category{query ? ` matching "${query}"` : ''}.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: 6,
            padding: '8px 8px',
          }}
        >
          {visible.map((mat) => {
            const label = matLabel(mat.name);
            const active = mat.id === activeMaterialId;
            const emissive = String(mat.emissive ?? '#000000');
            const hasEmissive = emissive !== '#000000' && emissive !== 'black';
            const sphereGrad = buildSphere(mat);

            return (
              <button
                key={mat.id}
                title={label}
                onClick={() => onSelect(mat)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0,
                  padding: '5px 4px',
                  background: active ? 'var(--accent-soft)' : 'var(--bs-color-bg-hover)',
                  border: active ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'background 0.12s, border-color 0.12s, transform 0.1s',
                  transform: active ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                {/* Sphere only   " name shown via title tooltip */}
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: sphereGrad,
                    boxShadow: active
                      ? `0 0 0 2px var(--accent), 0 2px 10px rgba(0,0,0,0.7)${hasEmissive ? ', 0 0 12px ' + emissive + '99' : ''}`
                      : `inset 0 -2px 5px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.5)${hasEmissive ? ', 0 0 8px ' + emissive + '66' : ''}`,
                    transition: 'box-shadow 0.12s',
                    flexShrink: 0,
                  }}
                />
              </button>
            );
          })}
        </div>
      )}

    </div>
  );
}



export function Scene3DInspector({
  node,
  sceneNode,
  query,
  subTab,
}: {
  node?: DomNode;
  sceneNode?: SceneNode;
  query: string;
  subTab: 'transform' | 'mesh' | 'material' | 'lighting' | string;
}) {
  const profile = useUIState((st) => st.profile);
  const m = getManifest();
  const matches = (label: string) => !query || label.toLowerCase().includes(query.toLowerCase());
  const NONE = '(none)';

  const hdrAssets = m.assets.filter((a) => a.category === 'HDR' && a.url);

  /**
   * Returns a clean human-readable label for a material name.
   * "M_388d0060_5cfe_41b7_834c_f75c1b359007_Material_001  * Filter"   ' "Filter"
   * "fallback Material - Fuel_Head_Ref_Point_XXX"   ' "Fuel Head Ref"
   * Falls back to the original name if no separator found.
   */
  const matLabel = (name: string): string => {
    // Pattern: anything  * Slot    '  return Slot
    const bulletIdx = name.indexOf('  * ');
    if (bulletIdx !== -1) return name.slice(bulletIdx + 3).trim();
    // Pattern: fallback Material - Slot    '  return Slot
    const dashIdx = name.indexOf(' - ');
    if (dashIdx !== -1) return name.slice(dashIdx + 3).trim();
    return name;
  };

  //  "  "  Handle 3D Studio SceneNode target  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 
  if (sceneNode) {
    let isTransformTab = subTab === 'transform' || subTab === 'layout';
    const isMeshTab = subTab === 'mesh';
    const isMaterialTab = subTab === 'material';
    const isLightingTab = subTab === 'lighting' || subTab === 'style';

    if (!isTransformTab && !isMeshTab && !isMaterialTab && !isLightingTab) {
      isTransformTab = true;
    }

    const currentHdr = m.environment.hdrAssetId
      ? m.assets.find((a) => a.id === m.environment.hdrAssetId)
      : undefined;

    return (
      <>
        {/* Tab 1: 3D Transform & Shape (matching green check mark reference) */}
        {isTransformTab && (
          <>
            <CollapsibleSection title="Transform">
              {matches('position') && (
                <>
                  <FieldRow label="Position X">
                    <NumberSliderField
                      value={Number((sceneNode.transform.position?.[0] ?? 0).toFixed(3))}
                      min={-10000} max={10000} step={0.05}
                      onChange={(v) => {
                        const next = [...(sceneNode.transform.position ?? [0,0,0])];
                        next[0] = v;
                        dispatch({ type: 'set', path: `sceneNodes.${sceneNode.id}.transform.position`, value: next, coalesceKey: `${sceneNode.id}.px` });
                      }}
                    />
                  </FieldRow>
                  <FieldRow label="Position Y">
                    <NumberSliderField
                      value={Number((sceneNode.transform.position?.[1] ?? 0).toFixed(3))}
                      min={-10000} max={10000} step={0.05}
                      onChange={(v) => {
                        const next = [...(sceneNode.transform.position ?? [0,0,0])];
                        next[1] = v;
                        dispatch({ type: 'set', path: `sceneNodes.${sceneNode.id}.transform.position`, value: next, coalesceKey: `${sceneNode.id}.py` });
                      }}
                    />
                  </FieldRow>
                  <FieldRow label="Position Z">
                    <NumberSliderField
                      value={Number((sceneNode.transform.position?.[2] ?? 0).toFixed(3))}
                      min={-10000} max={10000} step={0.05}
                      onChange={(v) => {
                        const next = [...(sceneNode.transform.position ?? [0,0,0])];
                        next[2] = v;
                        dispatch({ type: 'set', path: `sceneNodes.${sceneNode.id}.transform.position`, value: next, coalesceKey: `${sceneNode.id}.pz` });
                      }}
                    />
                  </FieldRow>
                </>
              )}
              {matches('scale') && (
                <>
                  <FieldRow label="Scale X">
                    <NumberSliderField
                      value={Number((sceneNode.transform.scale?.[0] ?? 1).toFixed(3))}
                      min={0.001} max={100} step={0.05}
                      onChange={(v) => {
                        const next = [...(sceneNode.transform.scale ?? [1,1,1])];
                        next[0] = v;
                        dispatch({ type: 'set', path: `sceneNodes.${sceneNode.id}.transform.scale`, value: next, coalesceKey: `${sceneNode.id}.sx` });
                      }}
                    />
                  </FieldRow>
                  <FieldRow label="Scale Y">
                    <NumberSliderField
                      value={Number((sceneNode.transform.scale?.[1] ?? 1).toFixed(3))}
                      min={0.001} max={100} step={0.05}
                      onChange={(v) => {
                        const next = [...(sceneNode.transform.scale ?? [1,1,1])];
                        next[1] = v;
                        dispatch({ type: 'set', path: `sceneNodes.${sceneNode.id}.transform.scale`, value: next, coalesceKey: `${sceneNode.id}.sy` });
                      }}
                    />
                  </FieldRow>
                  <FieldRow label="Scale Z">
                    <NumberSliderField
                      value={Number((sceneNode.transform.scale?.[2] ?? 1).toFixed(3))}
                      min={0.001} max={100} step={0.05}
                      onChange={(v) => {
                        const next = [...(sceneNode.transform.scale ?? [1,1,1])];
                        next[2] = v;
                        dispatch({ type: 'set', path: `sceneNodes.${sceneNode.id}.transform.scale`, value: next, coalesceKey: `${sceneNode.id}.sz` });
                      }}
                    />
                  </FieldRow>
                </>
              )}
              {matches('rotation') && (
                <>
                  <FieldRow label="Rotation X">
                    <NumberSliderField
                      value={Number((sceneNode.transform.rotation?.[0] ?? 0).toFixed(3))}
                      min={-Math.PI} max={Math.PI} step={0.05}
                      onChange={(v) => {
                        const next = [...(sceneNode.transform.rotation ?? [0,0,0])];
                        next[0] = v;
                        dispatch({ type: 'set', path: `sceneNodes.${sceneNode.id}.transform.rotation`, value: next, coalesceKey: `${sceneNode.id}.rx` });
                      }}
                    />
                  </FieldRow>
                  <FieldRow label="Rotation Y">
                    <NumberSliderField
                      value={Number((sceneNode.transform.rotation?.[1] ?? 0).toFixed(3))}
                      min={-Math.PI} max={Math.PI} step={0.05}
                      onChange={(v) => {
                        const next = [...(sceneNode.transform.rotation ?? [0,0,0])];
                        next[1] = v;
                        dispatch({ type: 'set', path: `sceneNodes.${sceneNode.id}.transform.rotation`, value: next, coalesceKey: `${sceneNode.id}.ry` });
                      }}
                    />
                  </FieldRow>
                  <FieldRow label="Rotation Z">
                    <NumberSliderField
                      value={Number((sceneNode.transform.rotation?.[2] ?? 0).toFixed(3))}
                      min={-Math.PI} max={Math.PI} step={0.05}
                      onChange={(v) => {
                        const next = [...(sceneNode.transform.rotation ?? [0,0,0])];
                        next[2] = v;
                        dispatch({ type: 'set', path: `sceneNodes.${sceneNode.id}.transform.rotation`, value: next, coalesceKey: `${sceneNode.id}.rz` });
                      }}
                    />
                  </FieldRow>
                </>
              )}
            </CollapsibleSection>

            <CollapsibleSection title="Snapping">
              <FieldRow label="Snapping">
                <SegmentedControl
                  aria-label="Snapping mode"
                  accent="blue"
                  options={[
                    { value: 'object', label: 'Object' },
                    { value: 'grid', label: 'Grid' },
                    { value: 'off', label: 'Off' },
                  ]}
                  value={(sceneNode.props?.snapMode as string) ?? 'off'}
                  onChange={(v) =>
                    dispatch({
                      type: 'set',
                      path: `sceneNodes.${sceneNode.id}.props.snapMode`,
                      value: v,
                    })
                  }
                />
              </FieldRow>
            </CollapsibleSection>

            <CollapsibleSection title="Size">
              <FieldRow label="Width">
                <NumberSliderField
                  value={Number(sceneNode.props?.sizeX ?? 107)}
                  min={1} max={2000} step={1}
                  onChange={(v) =>
                    dispatch({ type: 'set', path: `sceneNodes.${sceneNode.id}.props.sizeX`, value: v })
                  }
                />
              </FieldRow>
              <FieldRow label="Height">
                <NumberSliderField
                  value={Number(sceneNode.props?.sizeY ?? 107)}
                  min={1} max={2000} step={1}
                  onChange={(v) =>
                    dispatch({ type: 'set', path: `sceneNodes.${sceneNode.id}.props.sizeY`, value: v })
                  }
                />
              </FieldRow>
              <FieldRow label="Segments">
                <NumberSliderField
                  value={Number(sceneNode.props?.subdivisions ?? 10)}
                  min={1}
                  max={100}
                  step={1}
                  onChange={(v) =>
                    dispatch({ type: 'set', path: `sceneNodes.${sceneNode.id}.props.subdivisions`, value: v })
                  }
                />
              </FieldRow>
              <FieldRow label="Corner Radius">
                <NumberSliderField
                  value={Number(sceneNode.props?.corner ?? 0)}
                  min={0}
                  max={50}
                  step={1}
                  onChange={(v) =>
                    dispatch({ type: 'set', path: `sceneNodes.${sceneNode.id}.props.corner`, value: v })
                  }
                />
              </FieldRow>
              <FieldRow label="Depth">
                <NumberSliderField
                  value={Number(sceneNode.props?.extrusion ?? 66)}
                  min={0}
                  max={200}
                  step={1}
                  onChange={(v) =>
                    dispatch({ type: 'set', path: `sceneNodes.${sceneNode.id}.props.extrusion`, value: v })
                  }
                />
              </FieldRow>
              <FieldRow label="Bevel">
                <NumberSliderField
                  value={Number(sceneNode.props?.bevel ?? 1)}
                  min={0}
                  max={20}
                  step={1}
                  onChange={(v) =>
                    dispatch({ type: 'set', path: `sceneNodes.${sceneNode.id}.props.bevel`, value: v })
                  }
                />
              </FieldRow>
              <FieldRow label="Bevel Segments">
                <NumberSliderField
                  value={Number(sceneNode.props?.bevelSides ?? 1)}
                  min={1}
                  max={20}
                  step={1}
                  onChange={(v) =>
                    dispatch({ type: 'set', path: `sceneNodes.${sceneNode.id}.props.bevelSides`, value: v })
                  }
                />
              </FieldRow>
              <div className="bs-p-md">
                <button
                  className="uk-btn uk-btn--secondary uk-btn--sm bs-w-full bs-flex-center"
                  onClick={() => toast('Shape geometry edit mode active', 'ok', 'Edit Shape')}
                >
                  Edit
                </button>
              </div>
            </CollapsibleSection>
          </>
        )}

        {/* Tab 2: Mesh Properties */}
        {isMeshTab && (
          <CollapsibleSection title="Geometry">
            {matches('visible') && (
              <FieldRow label="Visible">
                <SelectField
                  value={sceneNode.visible ? 'Yes' : 'No'}
                  options={['Yes', 'No']}
                  onChange={(v) =>
                    dispatch({
                      type: 'set',
                      path: `sceneNodes.${sceneNode.id}.visible`,
                      value: v === 'Yes',
                    })
                  }
                />
              </FieldRow>
            )}
            {matches('cast shadow') && (
              <FieldRow label="Cast Shadows">
                <SelectField
                  value={sceneNode.props?.castShadow ? 'Yes' : 'No'}
                  options={['Yes', 'No']}
                  onChange={(v) =>
                    dispatch({
                      type: 'set',
                      path: `sceneNodes.${sceneNode.id}.props.castShadow`,
                      value: v === 'Yes',
                    })
                  }
                />
              </FieldRow>
            )}
            {matches('receive shadow') && (
              <FieldRow label="Receive Shadows">
                <SelectField
                  value={sceneNode.props?.receiveShadow ? 'Yes' : 'No'}
                  options={['Yes', 'No']}
                  onChange={(v) =>
                    dispatch({
                      type: 'set',
                      path: `sceneNodes.${sceneNode.id}.props.receiveShadow`,
                      value: v === 'Yes',
                    })
                  }
                />
              </FieldRow>
            )}
            <FieldRow label="Node Type">
              <span className="bs-mono bs-text-xs bs-text-accent bs-text-uppercase">
                {sceneNode.type}
              </span>
            </FieldRow>
          </CollapsibleSection>
        )}

        {/* Tab 3: Material PBR (Card 02 Material Inspector Editor) */}
        {isMaterialTab && (
          <MaterialInspector query={query} />
        )}

        {/* Tab 4: Lighting & Environment */}
        {isLightingTab && (
          <>
            {/* Specific Camera / Light parameters if selected node is camera/light */}
            {sceneNode.type === 'camera' && (
              <CollapsibleSection title="Camera">
                <FieldRow label="Field of View">
                  <NumberField
                    value={Number(sceneNode.props?.fov ?? 45)}
                    min={10}
                    max={120}
                    step={1}
                    unit="°"
                    onChange={(v) =>
                      dispatch({
                        type: 'set',
                        path: `sceneNodes.${sceneNode.id}.props.fov`,
                        value: v,
                      })
                    }
                  />
                </FieldRow>
              </CollapsibleSection>
            )}

            {sceneNode.type === 'light' && (
              <CollapsibleSection title="Light">
                <FieldRow label="Intensity">
                  <NumberField
                    value={Number(sceneNode.props?.intensity ?? 1.5)}
                    min={0}
                    max={10}
                    step={0.1}
                    onChange={(v) =>
                      dispatch({
                        type: 'set',
                        path: `sceneNodes.${sceneNode.id}.props.intensity`,
                        value: v,
                      })
                    }
                  />
                </FieldRow>
              </CollapsibleSection>
            )}

            {/* Scene-Wide Environment & IBL DOMViewportControls */}
            <CollapsibleSection title="Lighting">
              {matches('hdr env environment image') && (
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
              {matches('background') && (
                <FieldRow label="Background">
                  <SelectField
                    value={m.environment.background}
                    options={['color', 'hdr']}
                    onChange={(v) => setEnvironmentProp('background', v as any)}
                  />
                </FieldRow>
              )}
              {matches('bg color background color') && (
                <FieldRow label="Background Color">
                  <ColorField
                    value={m.environment.backgroundColor}
                    onChange={(v) => setEnvironmentProp('backgroundColor', v, true)}
                  />
                </FieldRow>
              )}
              {matches('env power environment intensity') && (
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
          </>
        )}
      </>
    );
  }

  //  "  "  Handle DOM 3D Scene Node target  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 
  if (!node) {
    return (
      <div className="bs-muted bs-p-md">
        No node selected.
      </div>
    );
  }

  const style = resolveStyle(node, profile);
  const s = scene3dSettingsOf(node);
  const modelAssets = m.assets.filter(
    (a) => a.category === '3D Models' && a.url && /\.(glb|gltf)$/i.test(a.name),
  );
  const currentAsset = node.assetId ? m.assets.find((a) => a.id === node.assetId) : undefined;
  const currentHdr = s.environment.hdrAssetId
    ? m.assets.find((a) => a.id === s.environment.hdrAssetId)
    : undefined;

  let isTransformTab = subTab === 'transform' || subTab === 'layout';
  const isMeshTab = subTab === 'mesh';
  const isMaterialTab = subTab === 'material';
  const isLightingTab = subTab === 'lighting' || subTab === 'style';

  // Fallback for when DOM Studio passes 'design' or 'responsive' to a Canvas node
  if (!isTransformTab && !isMeshTab && !isMaterialTab && !isLightingTab) {
    isTransformTab = true;
  }

  return (
    <>
      {isTransformTab && (
        <>
          <CollapsibleSection title="Transform">
            {matches('position') && (
              <FieldRow label="Position">
                <Vector3Field
                  value={s.model.position}
                  step={0.05}
                  onChange={(v) => setScene3dSetting(node.id, 'model', 'position', v, true)}
                />
              </FieldRow>
            )}
            {matches('rotation') && (
              <FieldRow label="Rotation">
                <Vector3Field
                  value={s.model.rotation}
                  step={0.05}
                  onChange={(v) => setScene3dSetting(node.id, 'model', 'rotation', v, true)}
                />
              </FieldRow>
            )}
            {matches('scale') && (
              <FieldRow label="Scale">
                <NumberField
                  value={s.model.scale}
                  min={0.05}
                  max={10}
                  step={0.05}
                  onChange={(v) => setScene3dSetting(node.id, 'model', 'scale', v)}
                  onScrub={(v) => setScene3dSetting(node.id, 'model', 'scale', v, true)}
                />
              </FieldRow>
            )}
          </CollapsibleSection>

          <CollapsibleSection title="Canvas Bounds">
            {matches('width') && (
              <FieldRow label="Width">
                <NumberField
                  value={Number(style.width ?? 420)}
                  min={50}
                  step={1}
                  unit="px"
                  onChange={(v) => setStyleValue(node.id, profile, 'width', v, false)}
                  onScrub={(v) => setStyleValue(node.id, profile, 'width', v, true)}
                />
              </FieldRow>
            )}
            {matches('height') && (
              <FieldRow label="Height">
                <NumberField
                  value={Number(style.height ?? 300)}
                  min={50}
                  step={1}
                  unit="px"
                  onChange={(v) => setStyleValue(node.id, profile, 'height', v, false)}
                  onScrub={(v) => setStyleValue(node.id, profile, 'height', v, true)}
                />
              </FieldRow>
            )}
            {matches('z-index') && (
              <FieldRow label="Stacking Order">
                <NumberField
                  value={Number(style.zIndex ?? 2)}
                  step={1}
                  onChange={(v) => setStyleValue(node.id, profile, 'zIndex', v, false)}
                />
              </FieldRow>
            )}
          </CollapsibleSection>
        </>
      )}

      {isMeshTab && (
        <>
          <CollapsibleSection title="3D Model">
            {matches('asset') && (
              <FieldRow label="3D Model">
                <SelectField
                  value={currentAsset?.name ?? (node.assetId ? '(missing asset)' : NONE)}
                  options={[NONE, ...modelAssets.map((a) => a.name)]}
                  onChange={(name) =>
                    dispatch({
                      type: 'set',
                      path: `domNodes.${node.id}.assetId`,
                      value: name === NONE ? undefined : modelAssets.find((a) => a.name === name)?.id,
                    })
                  }
                />
              </FieldRow>
            )}
            <div
              className="bs-muted bs-p-md bs-text-xs"
            >
              Independent 3D model instance   " keeps its own transform, camera, lighting, and timeline tracks.
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Rendering">
            <FieldRow label="Cast Shadows">
              <SelectField value="Yes" options={['Yes', 'No']} onChange={() => {}} />
            </FieldRow>
            <FieldRow label="Receive Shadows">
              <SelectField value="Yes" options={['Yes', 'No']} onChange={() => {}} />
            </FieldRow>
            <FieldRow label="Wireframe">
              <SelectField value="No" options={['No', 'Yes']} onChange={() => {}} />
            </FieldRow>
          </CollapsibleSection>
        </>
      )}

      {isMaterialTab && (
        <CollapsibleSection title="Material">
          {(() => {
            const domMaterials = Object.values(m.materials);
            const currentId = String((node as any).props?.materialId ?? '');
            const current = currentId ? m.materials[currentId] : undefined;
            return (
              <>
                <MatSlotGrid
                  materials={domMaterials}
                  activeMaterialId={current?.id}
                  query={query}
                  matLabel={matLabel}
                  onSelect={(mat) => {
                    dispatch({
                      type: 'set',
                      path: `sceneNodes.${node.id}.props.materialId`,
                      value: mat.id,
                    });
                    toast(`Slot — ${matLabel(mat.name)}`);
                  }}
                />
                {current && <MaterialChannels materialId={current.id} query={query} />}
              </>
            );
          })()}
        </CollapsibleSection>
      )}

      {isLightingTab && (
        <>
          <CollapsibleSection title="Camera">
            {matches('fov') && (
              <FieldRow label="Field of View">
                <NumberField
                  value={s.camera.fov}
                  min={10}
                  max={120}
                  step={1}
                  unit="  "
                  onChange={(v) => setScene3dSetting(node.id, 'camera', 'fov', v)}
                  onScrub={(v) => setScene3dSetting(node.id, 'camera', 'fov', v, true)}
                />
              </FieldRow>
            )}
            {matches('distance') && (
              <FieldRow label="Distance">
                <NumberField
                  value={s.camera.distance}
                  min={0.5}
                  max={12}
                  step={0.1}
                  onChange={(v) => setScene3dSetting(node.id, 'camera', 'distance', v)}
                  onScrub={(v) => setScene3dSetting(node.id, 'camera', 'distance', v, true)}
                />
              </FieldRow>
            )}
          </CollapsibleSection>

          <CollapsibleSection title="Environment">
            {matches('hdr env environment image') && (
              <FieldRow label="Environment Image">
                <SelectField
                  value={currentHdr?.name ?? (s.environment.hdrAssetId ? '(missing asset)' : NONE)}
                  options={[NONE, ...hdrAssets.map((a) => a.name)]}
                  onChange={(name) =>
                    setScene3dSetting(
                      node.id,
                      'environment',
                      'hdrAssetId',
                      name === NONE ? undefined : hdrAssets.find((a) => a.name === name)?.id,
                    )
                  }
                />
              </FieldRow>
            )}
          </CollapsibleSection>
        </>
      )}
    </>
  );
}
