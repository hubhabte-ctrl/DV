import { useState, type CSSProperties } from 'react';
import {
  addMaterial,
  dispatch,
  getManifest,
  setMaterialMap,
  setMaterialProp,
  setMaterialUv,
  MATERIAL_MAP_SLOTS,
  type Material,
  type SceneNode,
  type MaterialMapSlot,
} from '@bs/engine';
import { setUIState, useUIState } from '@bs/engine';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { FieldRow, NumberField, SelectField } from '../common/Fields';
import { Icons } from '../../../../app/ui/Icons';
import { SegmentedControl } from '../common/SegmentedControl';
import { toast } from '../../../../app/ui/Toast';
import { PBRSliderRow } from '../common/PBRSliderRow';

//  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 
//  Types
//  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 

interface ShaderPreset {
  id: string;
  name: string;
  resTag: string;
  baseColor: string;
  metallic: number;
  roughness: number;
  emissive?: string;
  emissiveIntensity?: number;
  category: 'sensor core' | 'mounting' | 'truck body' | 'wheels' | 'scene materials';
}

/**
 * Extended material type for properties not yet in the typed `Material`
 * interface. Persisted via dispatch() and read back with this cast.
 */
type ExtMaterial = Material & {
  normalScale?: number;
  aoIntensity?: number;
  thickness?: number;
  attenuationColor?: string;
  attenuationDistance?: number;
  cullMode?: 'back' | 'front' | 'none';
  renderOrder?: number;
};

//  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 
//  Constants
//  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 

const PRESET_MATERIALS: ShaderPreset[] = [
  { id: 'head',    name: 'head',    resTag: 'fuel_head',   baseColor: '#2f333e', metallic: 0.80, roughness: 0.30, category: 'sensor core' },
  { id: 'cover',   name: 'cover',   resTag: 'fuel_cover',  baseColor: '#f02d3c', metallic: 0.20, roughness: 0.40, category: 'sensor core' },
  { id: 'harness', name: 'harness', resTag: 'main_harness',baseColor: '#2d3c52', metallic: 0.40, roughness: 0.50, category: 'sensor core' },
  { id: 'probe',   name: 'probe',   resTag: 'ss_probe',    baseColor: '#d5d9e2', metallic: 0.95, roughness: 0.10, category: 'sensor core' },
  { id: 'filter',  name: 'filter',  resTag: 'mesh_flt',    baseColor: '#6a7282', metallic: 0.90, roughness: 0.20, category: 'sensor core' },
  { id: 'wire',    name: 'wire',    resTag: 'wire_frame',  baseColor: '#9ca3af', metallic: 0.85, roughness: 0.25, category: 'sensor core' },
  { id: 'tank',    name: 'tank',    resTag: 'fuel_tank',   baseColor: '#374151', metallic: 0.70, roughness: 0.35, category: 'sensor core' },
  { id: 'led',     name: 'led',     resTag: 'led_ind',     baseColor: '#ffb400', metallic: 0.10, roughness: 0.20, emissive: '#ffb400', emissiveIntensity: 2.0, category: 'sensor core' },
  { id: 'bracket', name: 'bracket', resTag: 'mnt_brk', baseColor: '#4b5563', metallic: 0.85, roughness: 0.30, category: 'mounting' },
  { id: 'gasket',  name: 'gasket',  resTag: 'rub_gsk', baseColor: '#111827', metallic: 0.05, roughness: 0.85, category: 'mounting' },
  { id: 'chrome',  name: 'chrome',  resTag: 'chrm_trm', baseColor: '#ffffff', metallic: 1.00, roughness: 0.05, category: 'truck body' },
  { id: 'amber',   name: 'amber',   resTag: 'amb_refl', baseColor: '#f59e0b', metallic: 0.30, roughness: 0.20, category: 'truck body' },
  { id: 'tire',    name: 'tire',    resTag: 'trd_rbr', baseColor: '#030712', metallic: 0.00, roughness: 0.90, category: 'wheels' },
  { id: 'rim',     name: 'rim',     resTag: 'all_rim', baseColor: '#e5e7eb', metallic: 0.90, roughness: 0.15, category: 'wheels' },
];

const CATEGORIES = ['sensor core', 'mounting', 'truck body', 'wheels', 'scene materials'] as const;
const QUICK_SWATCHES = ['#f02d3c', '#4c86ff', '#ffb400', '#10b981', '#1e222d'];
const NONE = '(none)';

const SLOT_LABELS: Record<MaterialMapSlot, string> = {
  map:          'Base Color',
  normalMap:    'Normal Map',
  roughnessMap: 'Roughness',
  metalnessMap: 'Metalness',
  aoMap:        'Ambient OCC.',
  emissiveMap:  'Emissive',
};

const IOR_PRESETS = [
  { label: 'Air',     value: 1.000 },
  { label: 'Water',   value: 1.333 },
  { label: 'Glass',   value: 1.500 },
  { label: 'Diamond', value: 2.417 },
];

//  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 
//  Pure utilities
//  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 

function adjustBrightness(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const num = parseInt(h, 16);
  if (Number.isNaN(num)) return hex;
  const r = Math.max(0, Math.min(255, ((num >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((num >>  8) & 255) + amount));
  const b = Math.max(0, Math.min(255,  (num        & 255) + amount));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function fillVars(color: string, darken = -40): CSSProperties {
  return { '--fill-from': color, '--fill-to': adjustBrightness(color, darken) } as CSSProperties;
}

//  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 
//  Sub-components
//  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 

/** Texture map slot: SelectField + per-slot clear button. */
function TextureSlotRow({
  label, slot, materialId, maps, texAssets, isProtected,
}: {
  label: string; slot: MaterialMapSlot; materialId: string;
  maps?: Material['maps']; texAssets: { id: string; name: string }[]; isProtected: boolean;
}) {
  const currentId = maps?.[slot];
  const current   = currentId ? texAssets.find((a) => a.id === currentId) : undefined;
  const display   = current?.name ?? (currentId ? '(missing)' : NONE);
  return (
    <FieldRow label={label}>
      <div className="mslot-tex-slot">
        <SelectField
          value={display}
          options={[NONE, ...texAssets.map((a) => a.name)]}
          onChange={(name) =>
            !isProtected &&
            setMaterialMap(materialId, slot,
              name === NONE ? undefined : texAssets.find((a) => a.name === name)?.id)
          }
        />
        {currentId && !isProtected && (
          <button type="button" className="mslot-tex-clear" aria-label={`Clear ${label}`} title="Clear texture"
            onClick={() => setMaterialMap(materialId, slot, undefined)}>
             -
          </button>
        )}
      </div>
    </FieldRow>
  );
}

/** Material preset / scene-material card. */
function MaterialCard({
  color, name, metallic, roughness, isEmissive, isActive, isApplied,
  isImported, badgeLabel, onSelect,
}: {
  color: string; name: string; metallic: number; roughness: number;
  isEmissive?: boolean; isActive: boolean; isApplied?: boolean;
  isImported?: boolean; badgeLabel?: string; onSelect: () => void;
}) {
  return (
    <button type="button"
      className={`mslot-card ${isActive ? 'active' : ''} ${isApplied ? 'mat-is-applied' : ''}`}
      aria-pressed={isActive} onClick={onSelect}>
      <span className="mslot-tile u-fill-material" style={fillVars(color)}>
        {isImported && <span className="mat-default-badge" title="GLB source material">{Icons.lock}</span>}
        {isApplied  && <span className="mat-applied-badge" aria-hidden="true">  "</span>}
        {badgeLabel && !isImported && !isApplied && <span className="mat-custom-badge">{badgeLabel}</span>}
      </span>
      <span className="mslot-name">{name}</span>
      <span className="mslot-meta-chip-row">
        <span className="mat-meta-chip">M {Math.round(metallic * 100)}%</span>
        <span className="mat-meta-chip">R {Math.round(roughness * 100)}%</span>
        {isEmissive && <span className="mat-meta-chip mat-meta-chip--emis">E</span>}
      </span>
      <span className={`mslot-apply-btn ${isApplied ? 'applied' : ''}`}>
        {isApplied ? 'Applied' : 'Apply to Mesh'}
      </span>
    </button>
  );
}

/** Read-only property row for the Preview tab. */
function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mslot-pprop-row">
      <span className="mslot-pprop-label">{label}</span>
      <span className="mslot-pprop-val">{children}</span>
    </div>
  );
}

//  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 
//  Main component
//  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 

/**
 * Material Inspector Panel.
 *
 * Routes content by the `subTab` prop from InspectorPanel:
 *   'channels'   ' Base Color  * Surface  * Emission  * Opacity & Alpha  * Actions
 *   'maps'       ' Texture Maps (6 slots)
 *   'shader'     ' Library  * Clearcoat  * Transmission  * UV  * Advanced
 *   'preview'    ' Property summary  * Mesh Usage
 *
 * The InspectorPanel already renders the panel header ("Material Architect /
 * Pro Shader Engine") so no additional header is rendered inside this component.
 */
export function MaterialInspector({
  query,
  subTab = 'channels',
}: {
  query: string;
  subTab?: string;
}) {
  const selMaterial = useUIState((s) => s.selectedMaterialId);
  const selScene    = useUIState((s) => s.selectedSceneNodeId);

  const [activeTab,         setActiveTab        ] = useState<string>('sensor core');
  const [activePreset,      setActivePreset      ] = useState<ShaderPreset>(PRESET_MATERIALS[0]);
  const [customizeUnlocked, setCustomizeUnlocked ] = useState(false);

  //  "  "  Manifest  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 
  const m                 = getManifest();
  const manifestMaterials = Object.values(m.materials);
  const meshNodes         = Object.values(m.sceneNodes).filter((n) => n.type === 'mesh');

  const sceneId       = typeof selScene === 'string' ? selScene : null;
  const selectedMesh: SceneNode | null =
    sceneId ? m.sceneNodes[sceneId] ?? null : meshNodes[0] ?? null;

  const matIdStr          = typeof selMaterial === 'string' ? selMaterial : '';
  const selectedMeshMatId =
    typeof selectedMesh?.props?.materialId === 'string' ? selectedMesh.props.materialId : '';
  const activeMatId =
    matIdStr || selectedMeshMatId || manifestMaterials[0]?.id || '';
  const activeMat: Material | null =
    (activeMatId ? m.materials[activeMatId] : null) ?? manifestMaterials[0] ?? null;
  const extMat = activeMat as ExtMaterial | null;

  //  "  "  PBR reads  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 
  const baseColor      = String(activeMat?.baseColor         ?? activePreset.baseColor);
  const metallic       = Number(activeMat?.metallic           ?? activePreset.metallic);
  const roughness      = Number(activeMat?.roughness          ?? activePreset.roughness);
  const emissiveColor  = String(activeMat?.emissive           ?? activePreset.emissive ?? '#000000');
  const emissivePower  = Number(activeMat?.emissiveIntensity  ?? activePreset.emissiveIntensity ?? 0);
  const opacity        = Number(activeMat?.opacity            ?? 1);
  const clearcoat      = Number(activeMat?.clearcoat          ?? 0);
  const ccRough        = Number(activeMat?.clearcoatRoughness ?? 0);
  const transmission   = Number(activeMat?.transmission       ?? 0);
  const ior            = Number(activeMat?.ior                ?? 1.5);
  const normalScale         = Number(extMat?.normalScale         ?? 1);
  const aoIntensity         = Number(extMat?.aoIntensity         ?? 1);
  const thickness           = Number(extMat?.thickness           ?? 0);
  const attenuationColor    = String(extMat?.attenuationColor    ?? '#ffffff');
  const attenuationDistance = Number(extMat?.attenuationDistance ?? 0);
  const cullMode            = String(extMat?.cullMode            ?? 'back');
  const renderOrder         = Number(extMat?.renderOrder         ?? 0);
  const uv                  = activeMat?.uv;

  //  "  "  Derived  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 
  const isTransmissive = activeMat?.alphaMode === 'blend' || transmission > 0;
  const isImported     = activeMat?.imported === true;
  const isProtected    = isImported && !customizeUnlocked;
  const texAssets      = m.assets.filter(
    (a) => a.url && (a.category === 'Images' || a.category === 'Textures'));

  //  "  "  Helpers  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 
  function cleanMatName(name: string): string {
    const s = name
      .replace(/M_[a-f0-9_\-]+_/gi, '')
      .replace(/Material[\s_]*\d*\s* *?\s*/gi, '')
      .replace(/fallback\s*(Material)?\s* *?\s*/gi, '')
      .replace(/_Ref_Point_\d+/gi, '')
      .replace(/_/g, ' ')
      .toLowerCase().trim();
    const MAP: [string | RegExp, string][] = [
      ['head cover', 'cover'], ['probe', 'probe'], ['harness', 'harness'],
      ['head', 'head'], [/wireframe|wire/, 'wire'], ['filter', 'filter'],
      ['glass', 'glass'], ['housing', 'housing'],
      [/emissive|signal/, 'led'], ['tank', 'tank'], ['belt', 'belt'],
      ['light', 'light'], ['chrome', 'chrome'], ['logo', 'logo'],
      ['text', 'text'], ['base', 'base'], ['bracket', 'bracket'],
      ['gasket', 'gasket'], ['rim', 'rim'], [/tire|rubber/, 'tire'],
    ];
    for (const [test, out] of MAP) {
      if (typeof test === 'string' ? s.includes(test) : test.test(s)) return out;
    }
    const parts = s.split(/\s+/);
    return parts[parts.length - 1] || s || 'mat';
  }

  const updateProp = (key: keyof Material, val: unknown) => {
    if (!activeMat) return;
    setMaterialProp(activeMat.id, key, val as never, true);
  };

  const updateExtProp = (key: string, val: string | number, coalesce = false) => {
    if (!activeMat) return;
    const path = `materials.${activeMat.id}.${key}`;
    dispatch({ type: 'set', path, value: val, coalesceKey: coalesce ? path : undefined });
  };

  const selectPreset = (preset: ShaderPreset) => {
    setActivePreset(preset);
    let targetMat = manifestMaterials.find(
      (mat) => mat.name.toLowerCase() === preset.name.toLowerCase());
    if (!targetMat) {
      const newId = addMaterial();
      dispatch({ type: 'set', path: `materials.${newId}.name`,      value: preset.name });
      dispatch({ type: 'set', path: `materials.${newId}.baseColor`, value: preset.baseColor });
      dispatch({ type: 'set', path: `materials.${newId}.metallic`,  value: preset.metallic });
      dispatch({ type: 'set', path: `materials.${newId}.roughness`, value: preset.roughness });
      if (preset.emissive)
        dispatch({ type: 'set', path: `materials.${newId}.emissive`, value: preset.emissive });
      targetMat = getManifest().materials[newId];
    }
    if (targetMat && selectedMesh) {
      dispatch({ type: 'set', path: `sceneNodes.${selectedMesh.id}.props.materialId`, value: targetMat.id });
      setUIState({ selectedMaterialId: targetMat.id });
      toast(`Material applied: '${preset.name}'`);
    }
  };

  const selectManifestMaterial = (mat: Material) => {
    if (selectedMesh) {
      dispatch({ type: 'set', path: `sceneNodes.${selectedMesh.id}.props.materialId`, value: mat.id });
      setUIState({ selectedMaterialId: mat.id });
      toast(`Material applied: '${mat.name}'`);
    }
  };

  const handleFullReset = () => {
    if (!activeMat) return;
    const preset = PRESET_MATERIALS.find(
      (p) => p.name.toLowerCase() === cleanMatName(activeMat.name));
    updateProp('baseColor',          preset?.baseColor         ?? '#8a96b0');
    updateProp('metallic',           preset?.metallic          ?? 0);
    updateProp('roughness',          preset?.roughness         ?? 0.5);
    updateProp('emissive',           preset?.emissive          ?? '#000000');
    updateProp('emissiveIntensity',  preset?.emissiveIntensity ?? 0);
    updateProp('opacity',            1);
    updateProp('clearcoat',          0);
    updateProp('clearcoatRoughness', 0);
    updateProp('transmission',       0);
    updateProp('ior',                1.5);
    updateProp('alphaMode',          'opaque');
    updateExtProp('normalScale',         1);
    updateExtProp('aoIntensity',         1);
    updateExtProp('thickness',           0);
    updateExtProp('attenuationDistance', 0);
    updateExtProp('attenuationColor',    '#ffffff');
    updateExtProp('cullMode',            'back');
    updateExtProp('renderOrder',         0);
    toast('Material reset to defaults');
  };

  //  "  "  Protection banner  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 
  const ProtectionBanner = isProtected ? (
    <div className="mat-protect-banner">
      {Icons.lock}
      <div>
        <b>Platform default material</b>
        <span>Imported from GLB. Customizing forks it for this scene.</span>
      </div>
      <button type="button" className="mat-customize-btn" onClick={() => setCustomizeUnlocked(true)}>
        Customize
      </button>
    </div>
  ) : isImported ? (
    <div className="mat-custom-active-bar">
      <span>Editing <b>{cleanMatName(activeMat?.name ?? '')}</b></span>
      <button type="button" className="mat-resetdef-btn" onClick={() => setCustomizeUnlocked(false)}>Lock</button>
    </div>
  ) : null;

  //  "  "  Library data  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 
  const filteredPresets = PRESET_MATERIALS.filter(
    (p) => p.category === activeTab &&
      (!query || p.name.toLowerCase().includes(query.toLowerCase())));

  const manifestCards = manifestMaterials.filter((mat) => {
    const name = mat.name || '';
    if (/ref[\s_]?point/i.test(name) || /fallback/i.test(name)) return false;
    const cleaned = cleanMatName(name);
    return !query || cleaned.toLowerCase().includes(query.toLowerCase());
  });

  const cardCount =
    activeTab === 'scene materials' ? manifestCards.length : filteredPresets.length;

  //                                                                                                                                                                                           
  //  TAB: PBR Channels
  //  Core everyday surface properties only.
  //  Clearcoat + Transmission moved to Shader Presets tab to keep
  //  this tab focused and uncluttered.
  //                                                                                                                                                                                           
  if (subTab === 'channels') {
    return (
      <div className="mslot-wrap">
        {ProtectionBanner}

        {/* 1  "  "  Base Color  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */}
        <CollapsibleSection title="Base Color">
          <div className="swatch-row" title="Click to open color picker">
            <span className="swatch u-fill" style={{ '--fill': baseColor } as CSSProperties} />
            <span className="swatch-hex">{baseColor}</span>
            <span className="swatch-opacity">{Math.round(opacity * 100)}%</span>
            <input type="color" className="swatch-color-picker" value={baseColor}
              disabled={isProtected} aria-label="Base color"
              onChange={(e) => updateProp('baseColor', e.target.value)} />
          </div>
          <div className="mslot-swatches">
            {QUICK_SWATCHES.map((hex) => (
              <button key={hex} type="button" className="swatch u-fill"
                style={{ '--fill': hex } as CSSProperties} title={hex}
                aria-label={`Set base color ${hex}`} disabled={isProtected}
                onClick={() => updateProp('baseColor', hex)} />
            ))}
          </div>
        </CollapsibleSection>

        {/* 2  "  "  Surface  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */}
        <CollapsibleSection title="Surface">
          <PBRSliderRow label="Metallic"     value={metallic}    min={0} max={1} step={0.05} scale={100} unit="%" disabled={isProtected} onChange={(v) => updateProp('metallic', v)}               onScrub={(v) => updateProp('metallic', v)} />
          <PBRSliderRow label="Roughness"    value={roughness}   min={0} max={1} step={0.05} scale={100} unit="%" disabled={isProtected} onChange={(v) => updateProp('roughness', v)}              onScrub={(v) => updateProp('roughness', v)} />
          <PBRSliderRow label="Normal Scale"    value={normalScale} min={0} max={2} step={0.05}             disabled={isProtected} onChange={(v) => updateExtProp('normalScale', v)} onScrub={(v) => updateExtProp('normalScale', v, true)} />
        </CollapsibleSection>

        {/* 3  "  "  Emission  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */}
        <CollapsibleSection title="Emission">
          <div className="swatch-row" title="Click to open emissive color picker">
            <span className="swatch u-fill" style={{ '--fill': emissiveColor } as CSSProperties} />
            <span className="swatch-hex">{emissiveColor}</span>
            <input type="color" className="swatch-color-picker" value={emissiveColor}
              disabled={isProtected} aria-label="Emissive color"
              onChange={(e) => updateProp('emissive', e.target.value)} />
          </div>
          <PBRSliderRow label="Intensity" value={emissivePower} min={0} max={10} step={0.1}
            disabled={isProtected}
            onChange={(v) => updateProp('emissiveIntensity', v)}
            onScrub={(v)  => updateProp('emissiveIntensity', v)} />
        </CollapsibleSection>

        {/* 4  "  "  Opacity & Alpha  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */}
        <CollapsibleSection title="Opacity">
          <PBRSliderRow label="Opacity" value={opacity}     min={0} max={1} step={0.05} scale={100} unit="%" disabled={isProtected} onChange={(v) => updateProp('opacity', v)}              onScrub={(v) => updateProp('opacity', v)} />
          <PBRSliderRow label="AO"      value={aoIntensity} min={0} max={1} step={0.05} scale={100} unit="%" disabled={isProtected} onChange={(v) => updateExtProp('aoIntensity', v)} onScrub={(v) => updateExtProp('aoIntensity', v, true)} />
          <FieldRow label="Alpha Mode">
            <SegmentedControl
              aria-label="Alpha Mode"
              accent="blue"
              options={[
                { value: 'opaque', label: 'Opaque' },
                { value: 'blend',  label: 'Blend'  },
                { value: 'clip',   label: 'Clip'   },
              ]}
              value={activeMat?.alphaMode ?? 'opaque'}
              onChange={(v) => updateProp('alphaMode', v)}
            />
          </FieldRow>
        </CollapsibleSection>

        {/* 5  "  "  Actions  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */}
        <CollapsibleSection title="Actions">
          <div className="mslot-actions">
            <button type="button" className="mslot-btn primary"
              disabled={!activeMat || !selectedMesh}
              onClick={() => activeMat && selectManifestMaterial(activeMat)}>
              Apply to Mesh
            </button>
            <button type="button" className="mslot-btn"
              disabled={!activeMat} onClick={handleFullReset}>
              Reset
            </button>
          </div>
        </CollapsibleSection>
      </div>
    );
  }

  //                                                                                                                                                                                           
  //  TAB: Texture Maps
  //  Six texture slots only. UV Transform lives in Shader Presets
  //  tab so this panel stays clean and focused.
  //                                                                                                                                                                                           
  if (subTab === 'maps') {
    return (
      <div className="mslot-wrap">
        {ProtectionBanner}

        <CollapsibleSection title="Textures">
          {activeMat ? (
            MATERIAL_MAP_SLOTS.map((slot) => (
              <TextureSlotRow
                key={slot}
                label={SLOT_LABELS[slot]}
                slot={slot}
                materialId={activeMat.id}
                maps={activeMat.maps}
                texAssets={texAssets}
                isProtected={isProtected}
              />
            ))
          ) : (
            <div className="bs-muted">No material selected.</div>
          )}
          {texAssets.length === 0 && (
            <div className="mslot-maps-empty-hint">
              No texture assets yet. Import images or HDR files in the Asset Studio, then select them here.
            </div>
          )}
        </CollapsibleSection>
      </div>
    );
  }

  //                                                                                                                                                                                           
  //  TAB: Shader Presets
  //  Library grid + secondary surface effects (Clearcoat,
  //  Transmission) + UV Transform + Advanced settings.
  //  These are grouped here because they are less frequently
  //  used and would clutter the main PBR Channels tab.
  //                                                                                                                                                                                           
  if (subTab === 'shader') {
    return (
      <div className="mslot-wrap">
        {ProtectionBanner}

        {/* Library  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */}
        <div className="mslot-head">
          <span className="mslot-title">Material Library</span>
          <span className="mslot-count">
            {cardCount} {cardCount === 1 ? 'material' : 'materials'}
          </span>
        </div>

        <div className="mslot-tabs" role="tablist" aria-label="Material categories">
          {CATEGORIES.map((cat) => (
            <button key={cat} type="button" role="tab"
              id={`mslot-tab-${cat.replace(/\s/g, '-')}`}
              aria-selected={activeTab === cat}
              aria-controls="mslot-grid-panel"
              className={`mslot-tab ${activeTab === cat ? 'active' : ''}`}
              onClick={() => setActiveTab(cat)}>
              {cat}
            </button>
          ))}
        </div>

        <div className="mslot-grid" id="mslot-grid-panel" role="tabpanel"
          aria-labelledby={`mslot-tab-${activeTab.replace(/\s/g, '-')}`}>
          {activeTab === 'scene materials'
            ? manifestCards.length > 0
              ? manifestCards.map((mat) => (
                  <MaterialCard key={mat.id}
                    color={String(mat.baseColor ?? '#8a96a8')}
                    name={cleanMatName(mat.name)}
                    metallic={Number(mat.metallic ?? 0)}
                    roughness={Number(mat.roughness ?? 0)}
                    isEmissive={Number(mat.emissiveIntensity ?? 0) > 0}
                    isActive={activeMat?.id === mat.id}
                    isApplied={selectedMeshMatId === mat.id}
                    isImported={mat.imported}
                    onSelect={() => selectManifestMaterial(mat)}
                  />
                ))
              : <div className="mslot-library-empty">No scene materials yet.<br/>Pick a preset to create one.</div>
            : filteredPresets.length > 0
              ? filteredPresets.map((preset) => (
                  <MaterialCard key={preset.id}
                    color={preset.baseColor}
                    name={cleanMatName(preset.name)}
                    metallic={preset.metallic}
                    roughness={preset.roughness}
                    isEmissive={!!preset.emissive}
                    isActive={activePreset.id === preset.id}
                    badgeLabel="C"
                    onSelect={() => selectPreset(preset)}
                  />
                ))
              : <div className="mslot-library-empty">No presets match "{query}".</div>
          }
        </div>

        <hr className="mslot-section-divider" />

        {/* Clearcoat  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */}
        <CollapsibleSection title="Clearcoat">
          <PBRSliderRow label="Clearcoat"  value={clearcoat} min={0} max={1} step={0.05} scale={100} unit="%" disabled={isProtected} onChange={(v) => updateProp('clearcoat', v)}          onScrub={(v) => updateProp('clearcoat', v)} />
          <PBRSliderRow label="Clearcoat Roughness"   value={ccRough}   min={0} max={1} step={0.05} scale={100} unit="%" disabled={isProtected} onChange={(v) => updateProp('clearcoatRoughness', v)} onScrub={(v) => updateProp('clearcoatRoughness', v)} />
        </CollapsibleSection>

        {/* Transmission  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */}
        <CollapsibleSection title="Transmission">
          {!isTransmissive && (
            <div className="mslot-transmission-gate" role="note">
              Set <b>Alpha Mode   ' Blend</b> or raise <b>Transmission</b> above 0 to enable.
            </div>
          )}
          <PBRSliderRow label="Transmission"  value={transmission} min={0} max={1} step={0.05} scale={100} unit="%" disabled={isProtected} onChange={(v) => updateProp('transmission', v)} onScrub={(v) => updateProp('transmission', v)} />
          <PBRSliderRow label="IOR"       value={ior}          min={1} max={2.333} step={0.01} disabled={isProtected || !isTransmissive} onChange={(v) => updateProp('ior', v)} onScrub={(v) => updateProp('ior', v)} />
          {isTransmissive && (
            <div className="mslot-ior-presets">
              {IOR_PRESETS.map((p) => (
                <button key={p.label} type="button"
                  className={`mslot-ior-preset-btn ${Math.abs(ior - p.value) < 0.01 ? 'active' : ''}`}
                  onClick={() => updateProp('ior', p.value)}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <PBRSliderRow label="Thickness"  value={thickness}           min={0} max={10} step={0.1} disabled={isProtected || !isTransmissive} onChange={(v) => updateExtProp('thickness', v)}           onScrub={(v) => updateExtProp('thickness', v, true)} />
          <div className={`mslot-atten-color-row${!isTransmissive ? ' mslot-atten-color-row--inactive' : ''}`}>
            <div className="mslot-field-label">Attenuation Color</div>
            <div className="swatch-row" title="Attenuation color">
              <span className="swatch u-fill" style={{ '--fill': attenuationColor } as CSSProperties} />
              <span className="swatch-hex">{attenuationColor}</span>
              <input type="color" className="swatch-color-picker" value={attenuationColor}
                disabled={isProtected || !isTransmissive} aria-label="Attenuation color"
                onChange={(e) => updateExtProp('attenuationColor', e.target.value)} />
            </div>
          </div>
          <PBRSliderRow label="Attenuation Distance" value={attenuationDistance} min={0} max={10} step={0.1} disabled={isProtected || !isTransmissive} onChange={(v) => updateExtProp('attenuationDistance', v)} onScrub={(v) => updateExtProp('attenuationDistance', v, true)} />
        </CollapsibleSection>

        {/* UV Transform  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */}
        {/* Uses stacked FieldRow+NumberField pairs instead of the
            side-by-side vector layout, which truncates in narrow panels. */}
        {activeMat && (
          <CollapsibleSection title="Texture Placement">
            <div className="mslot-uv-grid">
              <FieldRow label="Tiling X">
                <NumberField value={uv?.tiling?.[0] ?? 1} step={0.25}
                  onChange={(x) => setMaterialUv(activeMat.id, 'tiling', [x, uv?.tiling?.[1] ?? 1])}
                  onScrub={(x)  => setMaterialUv(activeMat.id, 'tiling', [x, uv?.tiling?.[1] ?? 1], true)} />
              </FieldRow>
              <FieldRow label="Tiling Y">
                <NumberField value={uv?.tiling?.[1] ?? 1} step={0.25}
                  onChange={(y) => setMaterialUv(activeMat.id, 'tiling', [uv?.tiling?.[0] ?? 1, y])}
                  onScrub={(y)  => setMaterialUv(activeMat.id, 'tiling', [uv?.tiling?.[0] ?? 1, y], true)} />
              </FieldRow>
              <FieldRow label="Offset X">
                <NumberField value={uv?.offset?.[0] ?? 0} step={0.05}
                  onChange={(x) => setMaterialUv(activeMat.id, 'offset', [x, uv?.offset?.[1] ?? 0])}
                  onScrub={(x)  => setMaterialUv(activeMat.id, 'offset', [x, uv?.offset?.[1] ?? 0], true)} />
              </FieldRow>
              <FieldRow label="Offset Y">
                <NumberField value={uv?.offset?.[1] ?? 0} step={0.05}
                  onChange={(y) => setMaterialUv(activeMat.id, 'offset', [uv?.offset?.[0] ?? 0, y])}
                  onScrub={(y)  => setMaterialUv(activeMat.id, 'offset', [uv?.offset?.[0] ?? 0, y], true)} />
              </FieldRow>
            </div>
            {/* Rotation in radians 0  "2   (audit fix: was 0  "100 arbitrary). */}
            <PBRSliderRow label="Rotation" value={uv?.rotation ?? 0}
              min={0} max={6.2832} step={0.01} unit=" rad"
              onChange={(v) => setMaterialUv(activeMat.id, 'rotation', v)}
              onScrub={(v)  => setMaterialUv(activeMat.id, 'rotation', v, true)} />
          </CollapsibleSection>
        )}

        {/* Advanced  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */}
        {activeMat && (
          <CollapsibleSection title="Advanced">
            <div className="field-row">
              <div className="field">
                <label htmlFor="matShaderId">Shader ID</label>
                <input id="matShaderId" className="f-input" value={activeMat.id} disabled readOnly />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="matShaderSource">Source</label>
                <input id="matShaderSource" className="f-input"
                  value={isImported ? 'GLB import' : 'Platform library'} disabled readOnly />
              </div>
            </div>
            <FieldRow label="Cull Mode">
              <SelectField value={cullMode} options={['back', 'front', 'none']}
                onChange={(v) => !isProtected && updateExtProp('cullMode', v)} />
            </FieldRow>
            <FieldRow label="Render Order">
              <NumberField value={renderOrder} step={1}
                onChange={(v)  => !isProtected && updateExtProp('renderOrder', Math.round(v))}
                onScrub={(v)   => !isProtected && updateExtProp('renderOrder', Math.round(v), true)} />
            </FieldRow>
          </CollapsibleSection>
        )}
      </div>
    );
  }

  //                                                                                                                                                                                           
  //  TAB: Preview
  //  Read-only material summary + mesh usage list.
  //  No extra sphere here   " InspectorPanel already renders the
  //  palette icon + "Material Architect" identity in its header.
  //                                                                                                                                                                                           
  if (subTab === 'preview') {
    const linkedMeshes = activeMat
      ? Object.values(m.sceneNodes).filter(
          (n) => n.type === 'mesh' && n.props?.materialId === activeMat.id)
      : [];

    return (
      <div className="mslot-wrap">
        {ProtectionBanner}

        {/* Live property summary  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */}
        {activeMat ? (
          <CollapsibleSection title="Properties">
            <div className="mslot-pprop-list">
              <PropRow label="Base Color">
                <span className="swatch u-fill swatch--sm" style={{ '--fill': baseColor } as CSSProperties} />
                <span className="bs-mono">{baseColor}</span>
              </PropRow>
              <PropRow label="Metallic">
                <span className="bs-mono">{Math.round(metallic * 100)}%</span>
              </PropRow>
              <PropRow label="Roughness">
                <span className="bs-mono">{Math.round(roughness * 100)}%</span>
              </PropRow>
              <PropRow label="Normal Scale">
                <span className="bs-mono">{normalScale.toFixed(2)}</span>
              </PropRow>
              <PropRow label="Opacity">
                <span className="bs-mono">{Math.round(opacity * 100)}%</span>
              </PropRow>
              <PropRow label="Alpha Mode">
                <span className="mat-meta-chip">{activeMat.alphaMode ?? 'opaque'}</span>
              </PropRow>
              {emissivePower > 0 && (
                <PropRow label="Emission">
                  <span className="swatch u-fill swatch--sm" style={{ '--fill': emissiveColor } as CSSProperties} />
                  <span className="bs-mono">{emissivePower.toFixed(1)} -</span>
                </PropRow>
              )}
              {clearcoat > 0 && (
                <PropRow label="Clearcoat">
                  <span className="bs-mono">{Math.round(clearcoat * 100)}%</span>
                </PropRow>
              )}
              {transmission > 0 && (
                <>
                  <PropRow label="Transmission">
                    <span className="bs-mono">{Math.round(transmission * 100)}%</span>
                  </PropRow>
                  <PropRow label="IOR">
                    <span className="bs-mono">{ior.toFixed(3)}</span>
                  </PropRow>
                </>
              )}
              {(uv?.tiling?.[0] !== undefined || uv?.tiling?.[1] !== undefined) && (
                <PropRow label="UV Tiling">
                  <span className="bs-mono">
                    {(uv?.tiling?.[0] ?? 1).toFixed(2)}  - {(uv?.tiling?.[1] ?? 1).toFixed(2)}
                  </span>
                </PropRow>
              )}
            </div>
          </CollapsibleSection>
        ) : (
          <div className="bs-muted bs-insp-body-pad">No material selected.</div>
        )}

        {/* Mesh usage  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */}
        <CollapsibleSection title={`Mesh Usage · ${linkedMeshes.length}`}>
          {linkedMeshes.length > 0 ? (
            <div className="mslot-mesh-list">
              {linkedMeshes.map((n) => (
                <button key={n.id} type="button"
                  className={`mslot-mesh-item ${n.id === sceneId ? 'active' : ''}`}
                  onClick={() => setUIState({ selectedSceneNodeId: n.id })}>
                  {Icons.cube}
                  <span>{n.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mslot-mesh-empty">
              This material is not applied to any mesh.<br/>
              Use <b>Apply to Mesh</b> in the PBR Channels tab.
            </div>
          )}
        </CollapsibleSection>
      </div>
    );
  }

  return null;
}
