/**
 * AnimateKeyframeInspector   " Animation Studio right-panel property editor.
 *
 * Design language: identical to DOMInspector (Doc 05   3).
 * Primitives used:
 *   - CollapsibleSection with Title Case titles
 *   - field-row > field > label + f-input / f-select
 *   - NumberField (axisLabel) for scrub-enabled numeric fields
 *   - SelectField for easing
 *   - TextField for name / target
 *   - toggle-row / tgl for boolean options
 *   - InspectorObjectHeader for the identity block
 *
 * All writes go through the command engine (IL-1).
 */
import {
  deleteKeyframe,
  getKeyframeName,
  getManifest,
  renameKeyframe,
  setTrackKeyframes,
  updateKeyframe,
  type Keyframe,
  type Track,
} from '@bs/engine';
import { getProgress, setProgress } from '../../../../engine/progress';
import { setUIState, useUIState } from '@bs/engine';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { FieldRow, NumberField, SelectField, TextField } from '../common/Fields';
import { toast } from '../../../../app/ui/Toast';
import { InspectorObjectHeader } from './InspectorObjectHeader';
import { Icons } from '../../../../app/ui/Icons';

/*  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  */

export function AnimateKeyframeInspector({ subTab = 'timing' }: { subTab?: string }) {
  const m = getManifest();
  const selTrackId = useUIState((s) => s.selectedTrackId);
  const selKeyframeT = useUIState((s) => s.selectedKeyframeT);
  const progress = getProgress();

  const track: Track | undefined = m.tracks.find((t) => t.id === selTrackId) ?? m.tracks[0];

  if (!track) {
    return (
      <div className="bs-p-24 bs-text-center bs-text-sm bs-text-muted bs-leading-loose">
        No animation track selected.
        <br />
        Click a track or keyframe in the timeline below.
      </div>
    );
  }

  const sortedKeys = [...track.keyframes].sort((a, b) => a.t - b.t);
  const activeKey: Keyframe | undefined =
    selKeyframeT !== null
      ? sortedKeys.find((k) => Math.abs(k.t - selKeyframeT) < 1e-5)
      : sortedKeys.find((k) => Math.abs(k.t - progress) < 0.05) ?? sortedKeys[0];

  const keyIndex = activeKey ? sortedKeys.findIndex((k) => k.t === activeKey.t) : -1;

  const isTimingTab = subTab === 'timing' || subTab === 'layout';
  const isCurvesTab = subTab === 'curves' || subTab === 'style';
  const isTriggersTab = subTab === 'triggers';
  const isBindingTab = subTab === 'binding';

  /* helper: update a single v[idx] */
  const setVal = (idx: number, nVal: number) => {
    if (!activeKey) return;
    const newV = [...activeKey.v];
    newV[idx] = nVal;
    updateKeyframe(track.id, activeKey.t, { v: newV });
  };

  return (
    <div>
      {/*  "  "  Object Identity  "  "  */}
      <InspectorObjectHeader
        icon={Icons.clock}
        kind={`track · ${track.id}`}
        name={`${track.target} · ${track.channel}`}
      />

      {/*                                      TAB 1   " KEYFRAMES                                      */}
      {isTimingTab && (
        <>
          {/* TRACK */}
          <CollapsibleSection title="Track">
            <div className="field-row">
              <div className="field">
                <label>Target</label>
                <input className="f-input" type="text" value={track.target} readOnly />
              </div>
              <div className="field">
                <label>Channel</label>
                <input className="f-input" type="text" value={track.channel} readOnly />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Keyframes</label>
                <input className="f-input" type="text" value={`${track.keyframes.length} keys · span 0–1`} readOnly />
              </div>
            </div>
          </CollapsibleSection>

          {/* SELECTED KEYFRAME */}
          {activeKey ? (
            <CollapsibleSection title={`Keyframe ${keyIndex + 1} of ${sortedKeys.length}`}>
              {/* Name */}
              <FieldRow label="Name">
                <TextField
                  value={getKeyframeName(track, activeKey, keyIndex)}
                  onChange={(v) => renameKeyframe(track.id, activeKey.t, v)}
                />
              </FieldRow>

              {/* Time */}
              <FieldRow label="Time">
                <NumberField
                  value={activeKey.t}
                  min={0}
                  max={1}
                  step={0.01}
                  unit=""
                  onChange={(newT) => {
                    const updatedT = Math.max(0, Math.min(1, newT));
                    updateKeyframe(track.id, activeKey.t, { t: updatedT });
                    setUIState({ selectedKeyframeT: updatedT });
                    setProgress(updatedT);
                  }}
                  onScrub={(newT) => {
                    const updatedT = Math.max(0, Math.min(1, newT));
                    updateKeyframe(track.id, activeKey.t, { t: updatedT });
                    setUIState({ selectedKeyframeT: updatedT });
                    setProgress(updatedT);
                  }}
                />
              </FieldRow>

              {/* Easing */}
              <FieldRow label="Easing">
                <SelectField
                  value={activeKey.ease ?? 'linear'}
                  options={['linear', 'smooth', 'bezier']}
                  onChange={(eVal) =>
                    updateKeyframe(track.id, activeKey.t, { ease: eVal as 'linear' | 'smooth' | 'bezier' })
                  }
                />
              </FieldRow>

              {/* Animated values   " XYZ axis inputs */}
              {activeKey.v.length > 0 && (
                <div className="field-row">
                  {(['X', 'Y', 'Z', 'W'] as const).slice(0, activeKey.v.length).map((axis, idx) => (
                    <div className="field" key={idx}>
                      <label>{axis}</label>
                      <NumberField
                        axisLabel={axis}
                        value={activeKey.v[idx] ?? 0}
                        step={0.01}
                        onChange={(v) => setVal(idx, v)}
                        onScrub={(v) => setVal(idx, v)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="bs-flex-row bs-gap-sm bs-mt-sm">
                <button
                  className="uk-btn uk-btn--secondary uk-btn--sm"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                  onClick={() => {
                    setProgress(activeKey.t);
                    setUIState({ selectedKeyframeT: activeKey.t });
                    toast(`Jumped playhead to t = ${activeKey.t.toFixed(2)}`);
                  }}
                >
                  {Icons.navigation}
                  Jump Playhead
                </button>
                {track.keyframes.length > 1 && (
                  <button
                    className="uk-btn uk-btn--danger uk-btn--sm"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                    onClick={() => {
                      deleteKeyframe(track.id, activeKey.t);
                      setUIState({ selectedKeyframeT: null });
                      toast(`Deleted keyframe '${getKeyframeName(track, activeKey)}'`);
                    }}
                  >
                    {Icons.trash}
                    Delete
                  </button>
                )}
              </div>
            </CollapsibleSection>
          ) : (
            <CollapsibleSection title="Keyframe">
              <div className="bs-muted bs-insp-hint">
                No keyframe at current playhead position.
              </div>
            </CollapsibleSection>
          )}

          {/* KEYFRAME SEQUENCE */}
          <CollapsibleSection title={`Keyframe Sequence · ${track.keyframes.length}`}>
            {sortedKeys.map((k, idx) => {
              const isSel = activeKey && Math.abs(k.t - activeKey.t) < 1e-5;
              const kName = getKeyframeName(track, k, idx);
              return (
                <div
                  key={k.t}
                  onClick={() => {
                    setUIState({ selectedKeyframeT: k.t });
                    setProgress(k.t);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 0',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    cursor: 'pointer',
                    background: isSel ? 'var(--accent-wash-s)' : 'transparent',
                    paddingLeft: isSel ? 6 : 0,
                    borderLeft: isSel ? '2px solid var(--accent-br)' : '2px solid transparent',
                    transition: 'background 0.12s',
                  }}
                >
                  {/* Diamond marker */}
                  <div style={{
                    width: 8,
                    height: 8,
                    border: `1.5px solid ${isSel ? 'var(--accent-br)' : 'var(--color-text-tertiary)'}`,
                    background: isSel ? 'var(--accent-br)' : 'transparent',
                    transform: 'rotate(45deg)',
                    flexShrink: 0,
                    borderRadius: 1,
                  }} />
                  {/* Name + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12,
                      fontWeight: isSel ? 600 : 500,
                      color: isSel ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {kName}
                    </div>
                    <div className="bs-text-mono bs-text-xs bs-text-muted bs-mt-sm">
                      {k.ease ?? 'linear'}
                    </div>
                  </div>
                  {/* t value */}
                  <span style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 'var(--text-label)',
                    color: isSel ? 'var(--accent-br)' : 'var(--color-text-tertiary)',
                    flexShrink: 0,
                  }}>
                    {k.t.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </CollapsibleSection>
        </>
      )}

      {/*                                      TAB 2   " CURVES                                      */}
      {isCurvesTab && (
        <CollapsibleSection title="Easing">
          {activeKey ? (
            <>
              <FieldRow label="Interpolation">
                <SelectField
                  value={activeKey.ease ?? 'smooth'}
                  options={['smooth', 'linear', 'bezier']}
                  onChange={(eVal) =>
                    updateKeyframe(track.id, activeKey.t, { ease: eVal as 'linear' | 'smooth' | 'bezier' })
                  }
                />
              </FieldRow>

              {activeKey.ease === 'bezier' && (
                <>
                  <div className="field-row">
                    <div className="field">
                      <label>P1 X</label>
                      <NumberField
                        axisLabel="x"
                        value={activeKey.bezier?.[0] ?? 0.4}
                        min={0} max={1} step={0.05}
                        onChange={(x) => updateKeyframe(track.id, activeKey.t, {
                          bezier: [x, activeKey.bezier?.[1] ?? 0, activeKey.bezier?.[2] ?? 0.2, activeKey.bezier?.[3] ?? 1],
                        })}
                        onScrub={(x) => updateKeyframe(track.id, activeKey.t, {
                          bezier: [x, activeKey.bezier?.[1] ?? 0, activeKey.bezier?.[2] ?? 0.2, activeKey.bezier?.[3] ?? 1],
                        })}
                      />
                    </div>
                    <div className="field">
                      <label>P1 Y</label>
                      <NumberField
                        axisLabel="y"
                        value={activeKey.bezier?.[1] ?? 0}
                        min={-1} max={2} step={0.05}
                        onChange={(y) => updateKeyframe(track.id, activeKey.t, {
                          bezier: [activeKey.bezier?.[0] ?? 0.4, y, activeKey.bezier?.[2] ?? 0.2, activeKey.bezier?.[3] ?? 1],
                        })}
                        onScrub={(y) => updateKeyframe(track.id, activeKey.t, {
                          bezier: [activeKey.bezier?.[0] ?? 0.4, y, activeKey.bezier?.[2] ?? 0.2, activeKey.bezier?.[3] ?? 1],
                        })}
                      />
                    </div>
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>P2 X</label>
                      <NumberField
                        axisLabel="x"
                        value={activeKey.bezier?.[2] ?? 0.2}
                        min={0} max={1} step={0.05}
                        onChange={(x2) => updateKeyframe(track.id, activeKey.t, {
                          bezier: [activeKey.bezier?.[0] ?? 0.4, activeKey.bezier?.[1] ?? 0, x2, activeKey.bezier?.[3] ?? 1],
                        })}
                        onScrub={(x2) => updateKeyframe(track.id, activeKey.t, {
                          bezier: [activeKey.bezier?.[0] ?? 0.4, activeKey.bezier?.[1] ?? 0, x2, activeKey.bezier?.[3] ?? 1],
                        })}
                      />
                    </div>
                    <div className="field">
                      <label>P2 Y</label>
                      <NumberField
                        axisLabel="y"
                        value={activeKey.bezier?.[3] ?? 1}
                        min={-1} max={2} step={0.05}
                        onChange={(y2) => updateKeyframe(track.id, activeKey.t, {
                          bezier: [activeKey.bezier?.[0] ?? 0.4, activeKey.bezier?.[1] ?? 0, activeKey.bezier?.[2] ?? 0.2, y2],
                        })}
                        onScrub={(y2) => updateKeyframe(track.id, activeKey.t, {
                          bezier: [activeKey.bezier?.[0] ?? 0.4, activeKey.bezier?.[1] ?? 0, activeKey.bezier?.[2] ?? 0.2, y2],
                        })}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="bs-muted bs-insp-hint">
                Interpolation governs the scroll-driven acceleration profile between keyframes [0, 1].
              </div>
            </>
          ) : (
            <div className="bs-muted bs-insp-hint">Select a keyframe to edit its curve.</div>
          )}
        </CollapsibleSection>
      )}

      {/*                                      TAB 3   " TRIGGERS                                      */}
      {isTriggersTab && (
        <CollapsibleSection title="Scroll Triggers">
          <div className="field-row">
            <div className="field">
              <label>Start</label>
              <NumberField
                value={sortedKeys[0]?.t ?? 0}
                min={0} max={1} step={0.05}
                onChange={(t) => setProgress(t)}
                onScrub={(t) => setProgress(t)}
              />
            </div>
            <div className="field">
              <label>End</label>
              <NumberField
                value={sortedKeys[sortedKeys.length - 1]?.t ?? 1}
                min={0} max={1} step={0.05}
                onChange={(t) => setProgress(t)}
                onScrub={(t) => setProgress(t)}
              />
            </div>
          </div>
          <div className="bs-muted bs-insp-hint">
            Track executes continuously on the shared scroll clock [0, 1]. Base values; timeline
            tracks compose on top at runtime.
          </div>
        </CollapsibleSection>
      )}

      {/*                                      TAB 4   " BINDING                                      */}
      {isBindingTab && (
        <CollapsibleSection title="Target Binding">
          <div className="field-row">
            <div className="field">
              <label>Node ID</label>
              <input className="f-input" type="text" value={track.target} readOnly />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Channel</label>
              <input className="f-input" type="text" value={track.channel} readOnly />
            </div>
          </div>
          <div className="bs-muted bs-insp-hint">
            Target binding is set when the track is authored via the timeline. Edit it from the
            timeline instead.
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
