/**
 * DOMInspector   " context-aware DOM node property editor (Doc 05   3, FR-124).
 *
 * Replaces the previous schema-driven renderer that gated fields on pre-existing
 * manifest keys. Every property group is always offered; the user authors new
 * style values from zero. All writes go through setStyleValue / dispatch /
 * dispatchBatch (IL-1). Override dots and profile-responsive sparse patches
 * follow Doc 05   4 exactly via hasOverride / clearOverride.
 *
 * Sub-panels:
 *   LayoutTab    " Position, Size, Spacing, Layout (flex/grid), Z/Overflow, Layer
 *   StyleTab     " Content, Typography, Background, Border, Shadow, Appearance,
 *                Transform, Accessibility, Component
 *   AnimTab      " Timeline Bindings (unchanged from parent)
 */
import { useState } from 'react';
import {
  clearOverride,
  componentInstances,
  createComponentFromNode,
  detachComponentInstance,
  dispatch,
  dispatchBatch,
  findDomParent,
  getManifest,
  hasOverride,
  resolveStyle,
  setStyleValue,
  updateComponentFromInstance,
  type Command,
  type DomNode,
} from '@bs/engine';
import { setUIState, type DeviceProfile } from '@bs/engine';
import { ColorField, FieldRow, NumberField, SelectField, TextField } from '../common/Fields';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { Icons } from '../../../../app/ui/Icons';
import { SegmentedControl } from '../common/SegmentedControl';
import { toast } from '../../../../app/ui/Toast';
import { DOMScene3DInspector as Scene3DInspector } from './DOMScene3DInspector';

/** Element types that bear text content and show typography controls. */
const TEXT_TYPES = new Set(['text', 'heading', 'button', 'link', 'p']);


/*  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  helpers  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */

/** Convenience: emit one style command, profile-aware, coalesced. */
function sv(
  nodeId: string,
  profile: DeviceProfile,
  key: string,
  value: string | number,
  coalesce = true,
) {
  setStyleValue(nodeId, profile, key, value, coalesce);
}

/** Convenience: read resolved style or fall back to a default. */
function rs(style: Record<string, string | number>, key: string, fallback: string | number = '') {
  const v = style[key];
  return v !== undefined ? v : fallback;
}

/** Override dot props factory   " keeps every FieldRow DRY. */
function od(node: DomNode, profile: DeviceProfile, key: string) {
  const m = getManifest();
  return {
    overridden: hasOverride(node, profile, key),
    overrideProfileLabel: m.breakpoints[profile]?.label,
    onClearOverride: () => clearOverride(node.id, profile, key),
  };
}

/*  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  Box Model  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */

function BoxModelSection({
  node,
  profile,
  query,
}: {
  node: DomNode;
  profile: DeviceProfile;
  query: string;
}) {
  const style = resolveStyle(node, profile);
  const matches = (label: string) => !query || label.toLowerCase().includes(query.toLowerCase());
  if (!matches('padding') && !matches('margin') && !matches('box model')) return null;

  const numVal = (key: string) => Number(rs(style, key, 0));

  const handleEdit = (key: string, current: number) => {
    const val = window.prompt(`Enter ${key}`, String(current));
    if (val !== null && !isNaN(Number(val))) {
      sv(node.id, profile, key, Number(val));
    }
  };

  return (
    <CollapsibleSection title="Box Model">
      <div className="boxmodel">
        <div className="bm-label">box</div>
        <div className="bm-margin">
          <span className="bm-label">margin</span>
          <span className="bm-num t" onClick={() => handleEdit('marginTop', numVal('marginTop'))}>{numVal('marginTop')}</span>
          <span className="bm-num b" onClick={() => handleEdit('marginBottom', numVal('marginBottom'))}>{numVal('marginBottom')}</span>
          <span className="bm-num l" onClick={() => handleEdit('marginLeft', numVal('marginLeft'))}>{numVal('marginLeft')}</span>
          <span className="bm-num r" onClick={() => handleEdit('marginRight', numVal('marginRight'))}>{numVal('marginRight')}</span>
          <div className="bm-padding">
            <span className="bm-label">padding</span>
            <span className="bm-num t" onClick={() => handleEdit('paddingTop', numVal('paddingTop'))}>{numVal('paddingTop')}</span>
            <span className="bm-num b" onClick={() => handleEdit('paddingBottom', numVal('paddingBottom'))}>{numVal('paddingBottom')}</span>
            <span className="bm-num l" onClick={() => handleEdit('paddingLeft', numVal('paddingLeft'))}>{numVal('paddingLeft')}</span>
            <span className="bm-num r" onClick={() => handleEdit('paddingRight', numVal('paddingRight'))}>{numVal('paddingRight')}</span>
            <div className="bm-content">content</div>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}

/*  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  Shadow rows  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */

interface ShadowDef {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
}

function parseShadows(raw: string | number | undefined): ShadowDef[] {
  if (!raw || raw === 'none' || raw === 0) return [];
  const str = String(raw).trim();
  if (!str || str === 'none') return [];
  // Simple split on top-level commas (ignores commas inside rgba()   " good enough for MVP)
  return str.split(/,(?![^(]*\))/).map((part) => {
    const p = part.trim();
    const inset = p.startsWith('inset');
    const rest = inset ? p.slice(5).trim() : p;
    const tokens = rest.split(/\s+/);
    return {
      x: parseFloat(tokens[0] ?? '0') || 0,
      y: parseFloat(tokens[1] ?? '0') || 0,
      blur: parseFloat(tokens[2] ?? '0') || 0,
      spread: parseFloat(tokens[3] ?? '0') || 0,
      color: tokens.slice(4).join(' ') || '#00000040',
      inset,
    };
  });
}

function stringifyShadows(shadows: ShadowDef[]): string {
  if (shadows.length === 0) return 'none';
  return shadows
    .map(
      ({ x, y, blur, spread, color, inset }) =>
        `${inset ? 'inset ' : ''}${x}px ${y}px ${blur}px ${spread}px ${color}`,
    )
    .join(', ');
}

function ShadowSection({
  node,
  profile,
  query,
}: {
  node: DomNode;
  profile: DeviceProfile;
  query: string;
}) {
  const style = resolveStyle(node, profile);
  const [shadows, setShadows] = useState<ShadowDef[]>(() => parseShadows(style.boxShadow));

  const commit = (next: ShadowDef[]) => {
    setShadows(next);
    sv(node.id, profile, 'boxShadow', stringifyShadows(next));
  };

  const matches = !query || 'shadow'.includes(query.toLowerCase());
  if (!matches) return null;

  return (
    <CollapsibleSection title={`Shadow · ${shadows.length}`}>
      {shadows.map((sh, i) => (
        <div
          key={i}
          style={{
            borderBottom: '1px solid var(--border)',
            padding: '6px 14px 8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 4,
            }}
          >
            <span className="bs-text-xs bs-text-muted bs-font-semibold">
              Shadow {i + 1}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="uk-iconbtn"
                title={sh.inset ? 'Outer shadow' : 'Inner (inset) shadow'}
                onClick={() => commit(shadows.map((s, j) => (j === i ? { ...s, inset: !s.inset } : s)))}
                style={{ opacity: sh.inset ? 1 : 0.4 }}
                aria-label="Toggle inset"
              >
                {Icons.layers}
              </button>
              <button
                className="uk-iconbtn"
                title="Remove shadow"
                onClick={() => commit(shadows.filter((_, j) => j !== i))}
                aria-label="Remove shadow"
              >
                {Icons.trash}
              </button>
            </div>
          </div>
          <div className="bs-grid-2 bs-gap-md">
            <FieldRow label="X Offset">
              <NumberField value={sh.x} step={1} unit="px" onChange={(v) => commit(shadows.map((s, j) => j === i ? { ...s, x: v } : s))} onScrub={(v) => commit(shadows.map((s, j) => j === i ? { ...s, x: v } : s))} />
            </FieldRow>
            <FieldRow label="Y Offset">
              <NumberField value={sh.y} step={1} unit="px" onChange={(v) => commit(shadows.map((s, j) => j === i ? { ...s, y: v } : s))} onScrub={(v) => commit(shadows.map((s, j) => j === i ? { ...s, y: v } : s))} />
            </FieldRow>
          </div>
          <div className="bs-grid-2 bs-gap-md bs-mt-sm">
            <FieldRow label="Blur">
              <NumberField value={sh.blur} min={0} step={1} unit="px" onChange={(v) => commit(shadows.map((s, j) => j === i ? { ...s, blur: v } : s))} onScrub={(v) => commit(shadows.map((s, j) => j === i ? { ...s, blur: v } : s))} />
            </FieldRow>
            <FieldRow label="Spread">
              <NumberField value={sh.spread} step={1} unit="px" onChange={(v) => commit(shadows.map((s, j) => j === i ? { ...s, spread: v } : s))} onScrub={(v) => commit(shadows.map((s, j) => j === i ? { ...s, spread: v } : s))} />
            </FieldRow>
          </div>
          <FieldRow label="Color">
            <ColorField value={sh.color} onChange={(v) => commit(shadows.map((s, j) => j === i ? { ...s, color: v } : s))} />
          </FieldRow>
        </div>
      ))}
      <div className="bs-p-md">
        <button
          className="uk-btn uk-btn--secondary uk-btn--sm"
          onClick={() =>
            commit([
              ...shadows,
              { x: 0, y: 4, blur: 12, spread: 0, color: '#00000033', inset: false },
            ])
          }
        >
          + Add shadow
        </button>
      </div>
    </CollapsibleSection>
  );
}

/*  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  Layout Tab  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */

function LayoutTab({
  node,
  profile,
  query,
  isSectionRoot,
}: {
  node: DomNode;
  profile: DeviceProfile;
  query: string;
  isSectionRoot: boolean;
}) {
  const style = resolveStyle(node, profile);
  const m = getManifest();
  const matches = (label: string) => !query || label.toLowerCase().includes(query.toLowerCase());

  const numVal = (key: string, fallback = 0) => Number(rs(style, key, fallback));
  const strVal = (key: string, fallback = '') => String(rs(style, key, fallback));

  const pos = strVal('position', 'static');
  const isAbs = pos === 'absolute' || pos === 'fixed';
  const display = strVal('display', 'block');

  // Detect if parent is a flex container
  const parentId = findDomParent(node.id);
  const parentStyle = parentId ? resolveStyle(m.domNodes[parentId], profile) : null;
  const isFlexChild = parentStyle?.display === 'flex';

  return (
    <>
      {/*  "  "  Position  "  "  */}
      {(matches('position') || matches('width') || matches('height') || matches('size') || matches('x') || matches('y')) && (
        <CollapsibleSection title="Position">
          <div className="field-row">
            <div className="field">
              <label>X</label>
              <input
                className="f-input"
                value={strVal('left', '0px')}
                onChange={(e) => sv(node.id, profile, 'left', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Y</label>
              <input
                className="f-input"
                value={strVal('top', '0px')}
                onChange={(e) => sv(node.id, profile, 'top', e.target.value)}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Width</label>
              <input
                className="f-input"
                value={strVal('width', 'auto')}
                onChange={(e) => sv(node.id, profile, 'width', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Height</label>
              <input
                className="f-input"
                value={strVal('height', 'auto')}
                onChange={(e) => sv(node.id, profile, 'height', e.target.value)}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Min Width</label>
              <input
                className="f-input"
                value={strVal('minWidth', 'auto')}
                onChange={(e) => sv(node.id, profile, 'minWidth', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Max Width</label>
              <input
                className="f-input"
                value={strVal('maxWidth', '100%')}
                onChange={(e) => sv(node.id, profile, 'maxWidth', e.target.value)}
              />
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/*  "  "  Box Model  "  "  */}
      <BoxModelSection node={node} profile={profile} query={query} />

      {/*  "  "  Display  "  "  */}
      {(matches('layout') || matches('display') || matches('flex') || matches('grid') || matches('gap') || matches('align') || matches('justify')) && (
        <CollapsibleSection title="Display">
          {matches('display') && (
            <div className="f-segmented">
              {['flex', 'grid', 'block', 'inline'].map((opt) => (
                <button
                  key={opt}
                  className={`f-seg-btn ${display === opt ? 'active' : ''}`}
                  onClick={() => sv(node.id, profile, 'display', opt, false)}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
          )}

          {display === 'flex' && (
            <>
              <div className="field-row">
                <div className="field">
                  <label>Direction</label>
                  <select
                    className="f-select"
                    value={strVal('flexDirection', 'Row')}
                    onChange={(e) => sv(node.id, profile, 'flexDirection', e.target.value, false)}
                  >
                    {['Row', 'Column', 'Row Reverse', 'Column Reverse'].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Wrap</label>
                  <select
                    className="f-select"
                    value={strVal('flexWrap', 'Wrap')}
                    onChange={(e) => sv(node.id, profile, 'flexWrap', e.target.value, false)}
                  >
                    {['Wrap', 'No Wrap', 'Wrap Reverse'].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Align</label>
                  <select
                    className="f-select"
                    value={strVal('alignItems', 'Center')}
                    onChange={(e) => sv(node.id, profile, 'alignItems', e.target.value, false)}
                  >
                    {['Center', 'Flex Start', 'Flex End', 'Stretch', 'Baseline'].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Justify</label>
                  <select
                    className="f-select"
                    value={strVal('justifyContent', 'Space Between')}
                    onChange={(e) => sv(node.id, profile, 'justifyContent', e.target.value, false)}
                  >
                    {['Space Between', 'Flex Start', 'Center', 'Flex End', 'Space Around', 'Space Evenly'].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>GAP</label>
                  <input
                    className="f-input"
                    value={strVal('gap', '0px')}
                    onChange={(e) => sv(node.id, profile, 'gap', e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {display === 'grid' && (
            <>
              <div className="field-row">
                <div className="field">
                  <label>Columns</label>
                  <input
                    className="f-input"
                    value={strVal('gridTemplateColumns', '1fr 1fr')}
                    onChange={(e) => sv(node.id, profile, 'gridTemplateColumns', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>ROWS</label>
                  <input
                    className="f-input"
                    value={strVal('gridTemplateRows', 'auto')}
                    onChange={(e) => sv(node.id, profile, 'gridTemplateRows', e.target.value)}
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>GAP</label>
                  <input
                    className="f-input"
                    value={strVal('gap', '0px')}
                    onChange={(e) => sv(node.id, profile, 'gap', e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </CollapsibleSection>
      )}

      {/*  "  "  Responsive  "  "  */}
      {matches('responsive') && (
        <CollapsibleSection title="Responsive">
          <div className="toggle-row">
            <span>Fluid width</span>
            <div
              className={`tgl ${strVal('fluidWidth', 'true') === 'true' ? 'on' : ''}`}
              onClick={() =>
                sv(
                  node.id,
                  profile,
                  'fluidWidth',
                  strVal('fluidWidth', 'true') === 'true' ? 'false' : 'true',
                )
              }
            >
              <span className="kn" />
            </div>
          </div>
          <div className="toggle-row">
            <span>Stack on mobile</span>
            <div
              className={`tgl ${strVal('stackMobile', 'true') === 'true' ? 'on' : ''}`}
              onClick={() =>
                sv(
                  node.id,
                  profile,
                  'stackMobile',
                  strVal('stackMobile', 'true') === 'true' ? 'false' : 'true',
                )
              }
            >
              <span className="kn" />
            </div>
          </div>
          <div className="toggle-row">
            <span>Hide on mobile</span>
            <div
              className={`tgl ${strVal('hideMobile', 'false') === 'true' ? 'on' : ''}`}
              onClick={() =>
                sv(
                  node.id,
                  profile,
                  'hideMobile',
                  strVal('hideMobile', 'false') === 'true' ? 'false' : 'true',
                )
              }
            >
              <span className="kn" />
            </div>
          </div>
        </CollapsibleSection>
      )}
    </>
  );
}

/*  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  Style Tab  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */

function StyleTab({
  node,
  profile,
  query,
  isSectionRoot,
}: {
  node: DomNode;
  profile: DeviceProfile;
  query: string;
  isSectionRoot: boolean;
}) {
  const style = resolveStyle(node, profile);
  const m = getManifest();
  const matches = (label: string) => !query || label.toLowerCase().includes(query.toLowerCase());
  const isText = TEXT_TYPES.has(node.type);

  const numVal = (key: string, fallback = 0) => Number(rs(style, key, fallback));
  const strVal = (key: string, fallback = '') => String(rs(style, key, fallback));

  /*  "  "  Border radius state  "  "  */
  const [radiusLinked, setRadiusLinked] = useState(true);

  /*  "  "  corner radii  "  "  */
  const setRadius = (corners: string[], value: number) => {
    if (corners.length === 1) {
      sv(node.id, profile, corners[0], value);
    } else {
      dispatchBatch(
        corners.map(
          (c): Command => ({
            type: 'set',
            path:
              profile === 'desktop'
                ? `domNodes.${node.id}.style.${c}`
                : `domNodes.${node.id}.overrides.${profile}.${c}`,
            value,
          }),
        ),
      );
    }
  };

  return (
    <>
      {/*  "  "  Fill  "  "  */}
      {(matches('fill') || matches('background') || matches('color')) && (
        <CollapsibleSection title="Fill">
          {matches('background') && (
            <FieldRow label="Color" {...od(node, profile, 'background')}>
              <ColorField
                value={strVal('background', '#F3F1EC')}
                onChange={(v) => sv(node.id, profile, 'background', v)}
              />
            </FieldRow>
          )}
          {matches('background image') && (
            <div className="field-row">
              <div className="field">
                <label>Background Image</label>
                <input
                  className="f-input"
                  value={strVal('backgroundImage', 'none')}
                  onChange={(e) => sv(node.id, profile, 'backgroundImage', e.target.value)}
                />
              </div>
            </div>
          )}
          {(matches('background size') || matches('background position')) && (
            <div className="field-row">
              <div className="field">
                <label>Background Size</label>
                <select
                  className="f-select"
                  value={strVal('backgroundSize', 'auto')}
                  onChange={(e) => sv(node.id, profile, 'backgroundSize', e.target.value, false)}
                >
                  {['auto', 'cover', 'contain'].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Background Position</label>
                <select
                  className="f-select"
                  value={strVal('backgroundPosition', 'center')}
                  onChange={(e) => sv(node.id, profile, 'backgroundPosition', e.target.value, false)}
                >
                  {['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right'].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/*  "  "  Border  "  "  */}
      {(matches('border') || matches('radius') || matches('outline')) && (
        <CollapsibleSection title="Border">
          {matches('border') && (
            <>
              <FieldRow label="Width" {...od(node, profile, 'borderWidth')}>
                <NumberField
                  value={numVal('borderWidth', 0)}
                  min={0}
                  step={1}
                  unit="px"
                  onChange={(v) => sv(node.id, profile, 'borderWidth', v, false)}
                  onScrub={(v) => sv(node.id, profile, 'borderWidth', v)}
                />
              </FieldRow>
              <FieldRow label="Style" {...od(node, profile, 'borderStyle')}>
                <SegmentedControl
                  aria-label="Border style"
                  accent="blue"
                  options={[
                    { value: 'solid', label: 'Solid' },
                    { value: 'dashed', label: 'Dashed' },
                    { value: 'dotted', label: 'Dotted' },
                    { value: 'double', label: 'Double' },
                    { value: 'none', label: 'None' },
                  ]}
                  value={strVal('borderStyle', 'solid')}
                  onChange={(v) => sv(node.id, profile, 'borderStyle', v, false)}
                />
              </FieldRow>
              <FieldRow label="Color" {...od(node, profile, 'borderColor')}>
                <ColorField
                  value={strVal('borderColor', '#000000')}
                  onChange={(v) => sv(node.id, profile, 'borderColor', v)}
                />
              </FieldRow>
            </>
          )}
          {/* Border radius */}
          {matches('radius') && (
            <div className="bs-p-md">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <span className="bs-text-xs bs-text-muted bs-font-semibold">
                  Radius
                </span>
                <button
                  className="uk-iconbtn"
                  title={radiusLinked ? 'Per corner' : 'Link all corners'}
                  onClick={() => setRadiusLinked((v) => !v)}
                  style={{ opacity: radiusLinked ? 1 : 0.5 }}
                  aria-label="Toggle radius link"
                >
                  {Icons.link}
                </button>
              </div>
              {radiusLinked ? (
                <FieldRow label="All" {...od(node, profile, 'borderRadius')}>
                  <NumberField
                    value={numVal('borderRadius', 0)}
                    min={0}
                    step={1}
                    unit="px"
                    onChange={(v) =>
                      setRadius(
                        ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'],
                        v,
                      )
                    }
                    onScrub={(v) =>
                      setRadius(
                        ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'],
                        v,
                      )
                    }
                  />
                </FieldRow>
              ) : (
                <div className="bs-spacing-grid">
                  {(
                    [
                      ['borderTopLeftRadius', 'TL'],
                      ['borderTopRightRadius', 'TR'],
                      ['borderBottomRightRadius', 'BR'],
                      ['borderBottomLeftRadius', 'BL'],
                    ] as const
                  ).map(([key, label]) => (
                    <FieldRow key={key} label={label} {...od(node, profile, key)}>
                      <NumberField
                        value={numVal(key, 0)}
                        min={0}
                        step={1}
                        unit="px"
                        onChange={(v) => setRadius([key], v)}
                        onScrub={(v) => setRadius([key], v)}
                      />
                    </FieldRow>
                  ))}
                </div>
              )}
            </div>
          )}
          {matches('outline') && (
            <>
              <div className="field-row">
                <div className="field">
                  <label>Outline Width</label>
                  <input
                    className="f-input"
                    value={strVal('outlineWidth', '0px')}
                    onChange={(e) => sv(node.id, profile, 'outlineWidth', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Outline Color</label>
                  <input
                    className="f-input"
                    value={strVal('outlineColor', '#0066ff')}
                    onChange={(e) => sv(node.id, profile, 'outlineColor', e.target.value)}
                  />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Outline Offset</label>
                  <input
                    className="f-input"
                    value={strVal('outlineOffset', '0px')}
                    onChange={(e) => sv(node.id, profile, 'outlineOffset', e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </CollapsibleSection>
      )}

      {/*  "  "  Effects  "  "  */}
      <CollapsibleSection title="Effects">
        <div className="toggle-row">
          <span>Drop shadow</span>
          <div
            className={`tgl ${strVal('dropShadow', 'false') === 'true' ? 'on' : ''}`}
            onClick={() =>
              sv(
                node.id,
                profile,
                'dropShadow',
                strVal('dropShadow', 'false') === 'true' ? 'false' : 'true',
              )
            }
          >
            <span className="kn" />
          </div>
        </div>
        <div className="toggle-row">
          <span>Inner glow</span>
          <div
            className={`tgl ${strVal('innerGlow', 'false') === 'true' ? 'on' : ''}`}
            onClick={() =>
              sv(
                node.id,
                profile,
                'innerGlow',
                strVal('innerGlow', 'false') === 'true' ? 'false' : 'true',
              )
            }
          >
            <span className="kn" />
          </div>
        </div>
        <div className="toggle-row">
          <span>Blur</span>
          <div
            className={`tgl ${strVal('blurEffect', 'false') === 'true' ? 'on' : ''}`}
            onClick={() =>
              sv(
                node.id,
                profile,
                'blurEffect',
                strVal('blurEffect', 'false') === 'true' ? 'false' : 'true',
              )
            }
          >
            <span className="kn" />
          </div>
        </div>
      </CollapsibleSection>

      {/*  "  "  Opacity & Blend  "  "  */}
      {(matches('opacity') || matches('blend') || matches('visibility')) && (
        <CollapsibleSection title="Opacity">
          <div className="field-row">
            <div className="field">
              <label>Opacity</label>
              <input
                className="f-input"
                value={`${Math.round(numVal('opacity', 1) * 100)}%`}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 100;
                  sv(node.id, profile, 'opacity', val / 100);
                }}
              />
            </div>
            <div className="field">
              <label>Blend Mode</label>
              <select
                className="f-select"
                value={strVal('mixBlendMode', 'Normal')}
                onChange={(e) => sv(node.id, profile, 'mixBlendMode', e.target.value, false)}
              >
                {['Normal', 'Multiply', 'Screen', 'Overlay'].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>

          {matches('opacity') && (
            <div className="slider-row">
              <label>Opacity</label>
              <input
                type="range"
                className="slider"
                min="0"
                max="100"
                value={numVal('opacity', 1) * 100}
                onChange={(e) => sv(node.id, profile, 'opacity', Number(e.target.value) / 100)}
              />
              <span className="slider-val">{Math.round(numVal('opacity', 1) * 100)}%</span>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/*  "  "  Transform  "  "  */}
      {(matches('transform') || matches('translate') || matches('rotate') || matches('scale') || matches('skew') || matches('origin')) && (
        <CollapsibleSection title="Transform">
          {(matches('translate') || matches('transform')) && (
            <div className="field-row">
              <div className="field">
                <label>Translate X</label>
                <input
                  className="f-input"
                  value={`${numVal('translateX', 0)}px`}
                  onChange={(e) => sv(node.id, profile, 'translateX', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="field">
                <label>Translate Y</label>
                <input
                  className="f-input"
                  value={`${numVal('translateY', 0)}px`}
                  onChange={(e) => sv(node.id, profile, 'translateY', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          )}

          {(matches('rotate') || matches('origin')) && (
            <div className="field-row">
              <div className="field">
                <label>Rotate</label>
                <input
                  className="f-input"
                  value={`${numVal('rotate', 0)}°`}
                  onChange={(e) => sv(node.id, profile, 'rotate', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="field">
                <label>Transform Origin</label>
                <select
                  className="f-select"
                  value={strVal('transformOrigin', 'center center')}
                  onChange={(e) => sv(node.id, profile, 'transformOrigin', e.target.value, false)}
                >
                  {['center center', 'top left', 'top center', 'top right', 'center left', 'center right', 'bottom left', 'bottom center', 'bottom right'].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {matches('scale') && (
            <div className="field-row">
              <div className="field">
                <label>Scale X</label>
                <input
                  className="f-input"
                  value={numVal('scaleX', 1)}
                  onChange={(e) => sv(node.id, profile, 'scaleX', parseFloat(e.target.value) || 1)}
                />
              </div>
              <div className="field">
                <label>Scale Y</label>
                <input
                  className="f-input"
                  value={numVal('scaleY', 1)}
                  onChange={(e) => sv(node.id, profile, 'scaleY', parseFloat(e.target.value) || 1)}
                />
              </div>
            </div>
          )}

          {matches('skew') && (
            <div className="field-row">
              <div className="field">
                <label>Skew X</label>
                <input
                  className="f-input"
                  value={`${numVal('skewX', 0)}°`}
                  onChange={(e) => sv(node.id, profile, 'skewX', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="field">
                <label>Skew Y</label>
                <input
                  className="f-input"
                  value={`${numVal('skewY', 0)}°`}
                  onChange={(e) => sv(node.id, profile, 'skewY', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          )}

          <div className="bs-muted bs-insp-hint">
            Base values. Timeline tracks compose on top at runtime.
          </div>
        </CollapsibleSection>
      )}

      {/*  "  "  Accessibility  "  "  */}
      {(matches('accessibility') || matches('aria') || matches('alt') || matches('role') || matches('tab')) && (
        <CollapsibleSection title="Accessibility">
          <div className="field-row">
            <div className="field">
              <label>ARIA Label</label>
              <input
                className="f-input"
                value={String((node.style as Record<string, string | number>)['aria-label'] ?? '')}
                onChange={(e) =>
                  dispatch({ type: 'set', path: `domNodes.${node.id}.style.aria-label`, value: e.target.value, coalesceKey: `${node.id}.aria-label` })
                }
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>ARIA Hidden</label>
              <select
                className="f-select"
                value={String((node.style as Record<string, string | number>)['aria-hidden'] ?? 'false')}
                onChange={(e) =>
                  dispatch({ type: 'set', path: `domNodes.${node.id}.style.aria-hidden`, value: e.target.value })
                }
              >
                <option value="false">false</option>
                <option value="true">true</option>
              </select>
            </div>
            <div className="field">
              <label>Role</label>
              <select
                className="f-select"
                value={String((node.style as Record<string, string | number>)['role'] ?? 'none')}
                onChange={(e) =>
                  dispatch({ type: 'set', path: `domNodes.${node.id}.style.role`, value: e.target.value === 'none' ? undefined : e.target.value })
                }
              >
                {['none', 'button', 'link', 'heading', 'region', 'navigation', 'main', 'article', 'section', 'banner', 'contentinfo', 'complementary', 'form', 'search', 'img', 'presentation'].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/*  "  "  Component  "  "  */}
      {!isSectionRoot && (matches('component') || !query) && (
        <CollapsibleSection
          title={node.componentId ? `Component · ${m.components[node.componentId]?.name ?? '(missing)'}` : 'Component'}
        >
          {node.componentId ? (
            <div className="bs-flex-wrap bs-gap-sm bs-p-md">
              <button
                className="uk-btn uk-btn--secondary uk-btn--sm"
                onClick={() => {
                  const n = updateComponentFromInstance(node.id);
                  toast(
                    n > 0
                      ? `Component updated — ${n} other instance(s) synced`
                      : 'Component updated — no other instances yet',
                  );
                }}
              >
                Update component
              </button>
              <button
                className="uk-btn uk-btn--secondary uk-btn--sm"
                onClick={() => {
                  detachComponentInstance(node.id);
                  toast('Instance detached');
                }}
              >
                Detach
              </button>
              <span className="bs-muted bs-text-xs bs-w-full">
                {componentInstances(node.componentId).length} instance(s) in the page
              </span>
            </div>
          ) : (
            <div className="bs-p-md">
              <button
                className="uk-btn uk-btn--secondary uk-btn--sm"
                onClick={() => {
                  if (createComponentFromNode(node.id)) {
                    toast(`'${node.label}' is now a component — find it in Components tab`);
                  }
                }}
              >
                Create component
              </button>
            </div>
          )}
        </CollapsibleSection>
      )}
    </>
  );
}

/*  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  Typography Tab  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */

function TypographyTab({
  node,
  profile,
  query,
}: {
  node: DomNode;
  profile: DeviceProfile;
  query: string;
}) {
  const style = resolveStyle(node, profile);
  const matches = (label: string) => !query || label.toLowerCase().includes(query.toLowerCase());

  const numVal = (key: string, fallback = 0) => Number(rs(style, key, fallback));
  const strVal = (key: string, fallback = '') => String(rs(style, key, fallback));

  return (
    <>
      {(!query || matches('content') || matches('text') || matches('tag')) && (
        <CollapsibleSection title="Content">
          <div className="field-row">
            <div className="field">
              <label>Content</label>
              <input
                className="f-input"
                value={String(node.content ?? '')}
                onChange={(e) =>
                  dispatch({
                    type: 'set',
                    path: `domNodes.${node.id}.content`,
                    value: e.target.value,
                    coalesceKey: `${node.id}.content`,
                  })
                }
              />
            </div>
          </div>
          {node.type === 'heading' && (
            <div className="field-row">
              <div className="field">
                <label>Tag</label>
                <select
                  className="f-select"
                  value={node.tag ?? 'h1'}
                  onChange={(e) =>
                    dispatch({ type: 'set', path: `domNodes.${node.id}.tag`, value: e.target.value })
                  }
                >
                  {['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </CollapsibleSection>
      )}

      <CollapsibleSection title="Typography">
        {(!query || matches('font') || matches('family')) && (
          <div className="field-row">
            <div className="field">
              <label>Font Family</label>
              <select
                className="f-select"
                value={strVal('fontFamily', 'Plus Jakarta Sans')}
                onChange={(e) => sv(node.id, profile, 'fontFamily', e.target.value)}
              >
                {['Plus Jakarta Sans', 'Inter', 'System UI', 'JetBrains Mono'].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Weight</label>
              <select
                className="f-select"
                value={String(rs(style, 'fontWeight', '800'))}
                onChange={(e) => sv(node.id, profile, 'fontWeight', Number(e.target.value), false)}
              >
                {['100', '200', '300', '400', '500', '600', '700', '800', '900'].map((w) => (
                  <option key={w}>{w}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        {(!query || matches('size') || matches('font size')) && (
          <div className="slider-row">
            <label>Size</label>
            <input type="range" className="slider" min="8" max="72" value={numVal('fontSize', 32)} onChange={(e) => sv(node.id, profile, 'fontSize', Number(e.target.value))} />
            <span className="slider-val">{numVal('fontSize', 32)}px</span>
          </div>
        )}
        {(!query || matches('line') || matches('height') || matches('line height')) && (
          <div className="slider-row">
            <label>Line Height</label>
            <input type="range" className="slider" min="1" max="3" step="0.1" value={numVal('lineHeight', 1.2)} onChange={(e) => sv(node.id, profile, 'lineHeight', Number(e.target.value))} />
            <span className="slider-val">{numVal('lineHeight', 1.2)}</span>
          </div>
        )}
        {(!query || matches('letter') || matches('spacing') || matches('tracking')) && (
          <div className="slider-row">
            <label>Letter Spacing</label>
            <input type="range" className="slider" min="-5" max="10" step="0.1" value={numVal('letterSpacing', -0.4)} onChange={(e) => sv(node.id, profile, 'letterSpacing', Number(e.target.value))} />
            <span className="slider-val">{numVal('letterSpacing', -0.4)}px</span>
          </div>
        )}
        <div className="bs-mb-md">
          <div className="f-align-btns">
            <button className={`f-align-btn ${strVal('textAlign', 'left') === 'left' ? 'active' : ''}`} onClick={() => sv(node.id, profile, 'textAlign', 'left')}>{Icons.alignLeft}</button>
            <button className={`f-align-btn ${strVal('textAlign') === 'center' ? 'active' : ''}`} onClick={() => sv(node.id, profile, 'textAlign', 'center')}>{Icons.alignCenterH}</button>
            <button className={`f-align-btn ${strVal('textAlign') === 'right' ? 'active' : ''}`} onClick={() => sv(node.id, profile, 'textAlign', 'right')}>{Icons.alignRight}</button>
          </div>
        </div>
        {(!query || matches('color') || matches('text color')) && (
          <FieldRow label="Color" {...od(node, profile, 'color')}>
            <ColorField
              value={strVal('color', '#ffffff')}
              onChange={(v) => sv(node.id, profile, 'color', v)}
            />
          </FieldRow>
        )}
      </CollapsibleSection>
    </>
  );
}

/*  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  Root export  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */

type DomSubTab = 'layout' | 'design' | 'responsive';

export interface DomInspectorProps {
  node: DomNode;
  profile: DeviceProfile;
  query: string;
  subTab: string;
  isSectionRoot: boolean;
  boundTracks: Array<{ id: string; label: string; channel: string; keyframes: unknown[] }>;
}

export function DOMInspector({
  node,
  profile,
  query,
  subTab,
  isSectionRoot,
  boundTracks,
}: DomInspectorProps) {
  /* scene3d gets its own dedicated inspector (unchanged) */
  if (node.type === 'scene3d') {
    return <Scene3DInspector node={node} query={query} subTab={subTab as any} />;
  }

  if (subTab === 'layout') {
    return (
      <LayoutTab node={node} profile={profile} query={query} isSectionRoot={isSectionRoot} />
    );
  }

  if (subTab === 'design') {
    return (
      <>
        <TypographyTab node={node} profile={profile} query={query} />
        <StyleTab node={node} profile={profile} query={query} isSectionRoot={isSectionRoot} />
      </>
    );
  }

  if (subTab === 'responsive') {
    const m = getManifest();
    const bp = m.breakpoints[profile];
    return (
      <>
        <CollapsibleSection title="Responsive Breakpoints">
          <FieldRow label="Active Profile">
            <SelectField
              value={profile}
              options={['desktop', 'tablet', 'mobile']}
              onChange={(v) => setUIState({ profile: v as DeviceProfile })}
            />
          </FieldRow>

          <FieldRow label="Canvas Width">
            <span className="bs-mono bs-ai-mono-sm">
              {bp?.canvasWidth ?? 1440}px ({bp?.label})
            </span>
          </FieldRow>

          <div className="bs-p-md bs-text-xs bs-muted">
            Styles edited on {profile} create sparse responsive overrides. Base styles fall back to Desktop.
          </div>
        </CollapsibleSection>

        <CollapsibleSection title={`Active Overrides · ${profile}`}>
          <div className="bs-p-md bs-text-xs">
            {Object.keys(node.overrides?.[profile] ?? {}).length > 0 ? (
              Object.entries(node.overrides?.[profile] ?? {}).map(([k, v]) => (
                <div key={k} className="bs-flex-between bs-py-sm">
                  <span className="bs-mono bs-text-accent">{k}</span>
                  <span className="bs-mono">{String(v)}</span>
                </div>
              ))
            ) : (
              <div className="bs-muted">No responsive overrides for {profile} — inheriting Desktop styles.</div>
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title={`Timeline Bindings · ${boundTracks.length}`}>
          {boundTracks.map((t) => (
            <div
              key={t.id}
              className="uk-tree__row bs-insp-track-row"
              onClick={() => setUIState({ mode: 'animate', selectedTrackId: t.id })}
            >
              <span className="uk-tree__label">{t.label}</span>
              <span className="bs-muted bs-mono bs-insp-track-meta">
                {t.channel} · {(t.keyframes as unknown[]).length} keys
              </span>
            </div>
          ))}
          {boundTracks.length === 0 && (
            <div
              className="bs-muted bs-p-md bs-text-xs"
            >
              No scroll animation tracks for this element. Add tracks in the Timeline Bar below.
            </div>
          )}
        </CollapsibleSection>
      </>
    );
  }

  return <StyleTab node={node} profile={profile} query={query} isSectionRoot={isSectionRoot} />;
}
