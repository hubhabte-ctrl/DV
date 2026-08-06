/**
 * Shared PBR channel editor (WS2-3a, FR-140..142).
 * Used by Material Studio inspector and 3D Studio mesh inspector.
 * Pure move from InspectorPanel.tsx (IL-11 behavior-identical).
 */
import { ColorField, FieldRow, NumberField, SelectField } from '../../components/common/Fields';
import { PBRSliderRow } from '../common/PBRSliderRow';
import {
  getManifest,
  setMaterialMap,
  setMaterialProp,
  setMaterialUv,
  MATERIAL_MAP_SLOTS,
  type MaterialMapSlot,
} from '@bs/engine';

export function MaterialChannels({ materialId, query }: { materialId: string; query: string }) {
  const rec = getManifest().materials[materialId];
  if (!rec) return null;
  const matches = (label: string) => !query || label.toLowerCase().includes(query.toLowerCase());
  const channels: {
    key:
      | 'baseColor'
      | 'metallic'
      | 'roughness'
      | 'emissive'
      | 'emissiveIntensity'
      | 'opacity'
      | 'clearcoat'
      | 'clearcoatRoughness'
      | 'transmission'
      | 'ior';
    label: string;
    kind: 'color' | 'number';
    min?: number;
    max?: number;
    step?: number;
    fallback?: number;
    /** model   ' display multiplier; `100` renders a 0   1 factor as a percentage */
    scale?: number;
    unit?: string;
  }[] = [
    { key: 'baseColor', label: 'Base Color', kind: 'color' },
    { key: 'metallic', label: 'Metallic', kind: 'number', min: 0, max: 1, step: 0.05, scale: 100, unit: '%' },
    { key: 'roughness', label: 'Roughness', kind: 'number', min: 0, max: 1, step: 0.05, scale: 100, unit: '%' },
    { key: 'emissive', label: 'Emissive', kind: 'color' },
    /* An absolute multiplier (0  "5 -), not a 0   1 factor   " stays in model units. */
    { key: 'emissiveIntensity', label: 'Emis. Power', kind: 'number', min: 0, max: 5, step: 0.1 },
    { key: 'opacity', label: 'Opacity', kind: 'number', min: 0, max: 1, step: 0.05, scale: 100, unit: '%' },
    /* advanced shading (Phase 3   " audit M-7, 03 Inspector/{ClearCoat,Refraction}) */
    { key: 'clearcoat', label: 'Clearcoat', kind: 'number', min: 0, max: 1, step: 0.05, fallback: 0, scale: 100, unit: '%' },
    {
      key: 'clearcoatRoughness',
      label: 'CC Rough.',
      kind: 'number',
      min: 0,
      max: 1,
      step: 0.05,
      fallback: 0,
      scale: 100,
      unit: '%',
    },
    { key: 'transmission', label: 'Transmission', kind: 'number', min: 0, max: 1, step: 0.05, fallback: 0, scale: 100, unit: '%' },
    /* A physical refractive index, not a factor   " model units, two decimals. */
    { key: 'ior', label: 'IOR', kind: 'number', min: 1, max: 2.333, step: 0.01, fallback: 1.5 },
  ];

  const NONE = '(none)';
  const SLOT_LABEL: Record<MaterialMapSlot, string> = {
    map: 'Base Map',
    normalMap: 'Normal Map',
    roughnessMap: 'Rough. Map',
    metalnessMap: 'Metal. Map',
    aoMap: 'AO Map',
    emissiveMap: 'Emis. Map',
  };
  const texAssets = getManifest().assets.filter(
    (a) => a.url && (a.category === 'Images' || a.category === 'Textures'),
  );
  const uv = rec.uv;

  return (
    <>
      {channels
        .filter((c) => matches(c.label))
        .map((c) =>
          c.kind === 'color' ? (
            <FieldRow key={c.key} label={c.label}>
              <ColorField
                value={String(rec[c.key])}
                onChange={(v: any) => setMaterialProp(rec.id, c.key, v, true)}
              />
            </FieldRow>
          ) : (
            /* SSOT `.slider-row` (`App.ts:615`)   " see `shared/PBRSliderRow`. It
               carries its own label, so it replaces the `FieldRow` wrapper
               rather than nesting inside one. */
            <PBRSliderRow
              key={c.key}
              label={c.label}
              value={Number(rec[c.key] ?? c.fallback ?? 0)}
              min={c.min}
              max={c.max}
              step={c.step}
              scale={c.scale}
              unit={c.unit}
              onChange={(v: any) => setMaterialProp(rec.id, c.key, v)}
              onScrub={(v: any) => setMaterialProp(rec.id, c.key, v, true)}
            />
          ),
        )}
      {/* transparency mode (Phase 3   " audit M-7): blend / alpha-clip */}
      {matches('Alpha Mode') && (
        <FieldRow label="Alpha Mode">
          <SelectField
            value={rec.alphaMode ?? 'opaque'}
            options={['opaque', 'blend', 'clip']}
            onChange={(v: any) => setMaterialProp(rec.id, 'alphaMode', v)}
          />
        </FieldRow>
      )}
      {MATERIAL_MAP_SLOTS.filter((slot) => matches(SLOT_LABEL[slot])).map((slot) => {
        const currentId = rec.maps?.[slot];
        const current = currentId ? getManifest().assets.find((a) => a.id === currentId) : undefined;
        return (
          <FieldRow key={slot} label={SLOT_LABEL[slot]}>
            <SelectField
              value={current?.name ?? (currentId ? '(missing asset)' : NONE)}
              options={[NONE, ...texAssets.map((a) => a.name)]}
              onChange={(name) =>
                setMaterialMap(
                  rec.id,
                  slot,
                  name === NONE ? undefined : texAssets.find((a) => a.name === name)?.id,
                )
              }
            />
          </FieldRow>
        );
      })}
      {matches('tiling') && (
        <FieldRow label="UV Tiling">
          <span className="uk-vec3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <NumberField
              value={uv?.tiling?.[0] ?? 1}
              step={0.25}
              onChange={(x) => setMaterialUv(rec.id, 'tiling', [x, uv?.tiling?.[1] ?? 1])}
              onScrub={(x) => setMaterialUv(rec.id, 'tiling', [x, uv?.tiling?.[1] ?? 1], true)}
            />
            <NumberField
              value={uv?.tiling?.[1] ?? 1}
              step={0.25}
              onChange={(y) => setMaterialUv(rec.id, 'tiling', [uv?.tiling?.[0] ?? 1, y])}
              onScrub={(y) => setMaterialUv(rec.id, 'tiling', [uv?.tiling?.[0] ?? 1, y], true)}
            />
          </span>
        </FieldRow>
      )}
      {matches('offset') && (
        <FieldRow label="UV Offset">
          <span className="uk-vec3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <NumberField
              value={uv?.offset?.[0] ?? 0}
              step={0.05}
              onChange={(x) => setMaterialUv(rec.id, 'offset', [x, uv?.offset?.[1] ?? 0])}
              onScrub={(x) => setMaterialUv(rec.id, 'offset', [x, uv?.offset?.[1] ?? 0], true)}
            />
            <NumberField
              value={uv?.offset?.[1] ?? 0}
              step={0.05}
              onChange={(y) => setMaterialUv(rec.id, 'offset', [uv?.offset?.[0] ?? 0, y])}
              onScrub={(y) => setMaterialUv(rec.id, 'offset', [uv?.offset?.[0] ?? 0, y], true)}
            />
          </span>
        </FieldRow>
      )}
      {matches('rotation') && (
        <FieldRow label="UV Rotation">
          <NumberField
            value={uv?.rotation ?? 0}
            step={0.05}
            unit="rad"
            onChange={(v: any) => setMaterialUv(rec.id, 'rotation', v)}
            onScrub={(v: any) => setMaterialUv(rec.id, 'rotation', v, true)}
          />
        </FieldRow>
      )}
    </>
  );
}
