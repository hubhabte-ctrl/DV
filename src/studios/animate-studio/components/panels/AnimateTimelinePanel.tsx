/**
 * AnimateTimelinePanel   " Animation Studio's HERO work surface (Spec 07   5, stage R2).
 * The layout inversion: this panel is the primary surface (default 40% of the
 * viewport, resizable to 70% via the shell splitter); the viewport above is
 * the monitor. Replaces the shared shell/TimelineBar.tsx (Spec 07   9.2).
 *
 *    * Left column   " track stack: rows grouped per target (camera / scene /
 *     materials / DOM / audio), mute  * solo  * lock  * rename  * duplicate,
 *     per-track value readout at the playhead (04 TimelineEditor   2).
 *    * Right   " dope sheet: [0,1] ruler (shared ProgressRuler primitive) with
 *     section bands + markers, keyframe glyphs per interpolation, marquee and
 *     shift multi-select, drag with snapping (grid / section bounds / markers
 *     / sibling keys), copy/paste (animateKeyOps).
 *    * Graph mode (toggle `G`) replaces the dope sheet in place (AnimateGraphEditor).
 *    * Transport: play/pause/loop, honest 0.000  "1.000 readout from the ONE
 *     clock, zoom-to-selection, add-key `K`, + Track authoring.
 *
 * IL-1: every mutation dispatches commands. IL-2/PRD-INV-01: binds to the
 * canonical @bs/runtime progress clock   " no local clocks. FR-123: zoom,
 * column width, marquee and mode are transient UI state.
 */
import { useEffect, useRef, useState } from 'react';
import { Icons } from '../../../../app/ui/Icons';
import { ProgressRuler } from '../common/ProgressRuler';
import { toast } from '../../../../app/ui/Toast';
import {
  addMarker,
  addTrack,
  duplicateTrack,
  getManifest,
  getTrack,
  newNodeId,
  removeMarker,
  removeTrack,
  renameTrack,
  setMarkerProp,
  setTrackKeyframes,
  setTrackLocked,
  subscribeManifest,
  type Keyframe,
  type Manifest,
  type Track,
} from '@bs/engine';
import { sampleKeyframes } from '@bs/engine';
import {
  getProgress,
  isLooping,
  isPlaying,
  pause,
  play,
  setLoop,
  setProgress,
  subscribeLoop,
  subscribePlaying,
  subscribeProgress,
} from '../../../../engine/progress';
import { setUIState, toggleTrackMute, toggleTrackSolo, useUIState } from '@bs/engine';
import { AnimateGraphEditor } from './AnimateGraphEditor';
import { getClipColor, getTrackColor } from '../../constants/animateTrackColors';
import {
  getSelectedKeys,
  isKeySelected,
  setSelectedKeys,
  toggleKeySelected,
  useSelectedKeys,
  type KeyRef,
} from '../../utils/animateKeySelection';
import { addKeyframeAtPlayhead, snapKeyT } from '../../utils/animateKeyOps';

const EPS = 1e-6;
const GROUP_H = 22;
const ROW_H = 30;
const round4 = (t: number) => Math.round(t * 10000) / 10000;

/* ---------------- Track grouping (Spec 07   5: rows grouped per target) ---------------- */

interface TrackGroup {
  name: string;
  tracks: Track[];
}

const GROUP_ORDER = ['Camera', 'Scene', 'Materials', 'DOM', 'Audio', 'Other'];

function trackGroupName(m: Manifest, t: Track): string {
  const sn = m.sceneNodes[t.target];
  if (sn) return sn.type === 'camera' ? 'Camera' : 'Scene';
  if (m.materials[t.target]) return 'Materials';
  if (m.domNodes[t.target]) return 'DOM';
  const lbl = t.label.toLowerCase();
  if (lbl.includes('audio') || lbl.includes('sound')) return 'Audio';
  return 'Other';
}

function groupTracks(m: Manifest): TrackGroup[] {
  const byName = new Map<string, Track[]>();
  for (const t of m.tracks) {
    const g = trackGroupName(m, t);
    byName.set(g, [...(byName.get(g) ?? []), t]);
  }
  return GROUP_ORDER.filter((name) => byName.has(name)).map((name) => ({
    name,
    tracks: byName.get(name)!,
  }));
}

/* ---------------- Track authoring (moved from TimelineBar   " FR-151, audit T-1) ---------------- */

interface TargetOption {
  id: string;
  label: string;
  group: string;
}

function targetOptions(): TargetOption[] {
  const m = getManifest();
  return [
    ...Object.values(m.sceneNodes).map((n) => ({ id: n.id, label: n.label, group: '3D Scene' })),
    ...Object.values(m.materials).map((mat) => ({ id: mat.id, label: mat.name, group: 'Materials' })),
    ...Object.values(m.domNodes).map((n) => ({ id: n.id, label: n.label, group: 'DOM' })),
  ];
}

/** #rrggbb   ' [r, g, b] in 0..1 (baseColor tracks animate as vectors   " M-6). */
function hexToRgb01(hex: string): number[] {
  const h = hex.replace('#', '');
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  );
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Channels the runtime bridges can actually evaluate for this target. */
function channelsFor(targetId: string): string[] {
  const m = getManifest();
  if (m.materials[targetId]) {
    return ['emissiveIntensity', 'baseColor', 'roughness', 'metallic', 'opacity'];
  }
  const sn = m.sceneNodes[targetId];
  if (sn) {
    if (sn.type === 'camera') return ['position', 'target'];
    if (sn.type === 'light') return ['intensity'];
    return ['position', 'rotation', 'visible'];
  }
  if (m.domNodes[targetId]) {
    return ['opacity', 'translateY', 'translateX', 'scale', 'rotate', 'blur'];
  }
  return [];
}

/** First keyframe value = the target's CURRENT state at the playhead. */
function initialValueFor(targetId: string, channel: string): number[] {
  const m = getManifest();
  const sn = m.sceneNodes[targetId];
  if (sn) {
    if (channel === 'position') return [...sn.transform.position];
    if (channel === 'rotation') return [...sn.transform.rotation];
    if (channel === 'visible') return [sn.visible ? 1 : 0];
    if (channel === 'intensity') return [Number(sn.props?.intensity ?? 1)];
    if (channel === 'target') return [0, 0.5, 0];
  }
  const mat = m.materials[targetId];
  if (mat) {
    if (channel === 'emissiveIntensity') return [mat.emissiveIntensity];
    if (channel === 'baseColor') return hexToRgb01(mat.baseColor);
    if (channel === 'roughness') return [mat.roughness];
    if (channel === 'metallic') return [mat.metallic];
    if (channel === 'opacity') return [mat.opacity];
  }
  if (channel === 'opacity') return [1];
  if (channel === 'scale') return [1];
  // translateX / translateY / rotate / blur all rest at 0
  return [0];
}

/** "+ Track" popover: pick target   ' channel   ' creates the track with one
 *  keyframe at the playhead sampling the current value (audit T-1 acceptance). */
function AddTrackPopover({ onClose }: { onClose: () => void }) {
  const options = targetOptions();
  const sceneAnchor = useUIState((s) => s.selectedSceneNodeId);
  const domAnchor = useUIState((s) => s.selectedDomNodeId);
  const selAnchor = sceneAnchor ?? domAnchor;
  const [target, setTarget] = useState<string>(
    selAnchor && channelsFor(selAnchor).length ? selAnchor : (options[0]?.id ?? ''),
  );
  const channels = channelsFor(target);
  const [channel, setChannel] = useState<string>(channels[0] ?? '');
  const effectiveChannel = channels.includes(channel) ? channel : (channels[0] ?? '');
  const groups = [...new Set(options.map((o) => o.group))];

  const create = () => {
    if (!target || !effectiveChannel) return;
    const label = options.find((o) => o.id === target)?.label ?? target;
    const track: Track = {
      id: newNodeId('trk'),
      label: `${label}  * ${effectiveChannel}`,
      target,
      channel: effectiveChannel,
      keyframes: [
        { t: snapKeyT(getProgress()), v: initialValueFor(target, effectiveChannel), ease: 'smooth' },
      ],
    };
    addTrack(track);
    setSelectedKeys([{ trackId: track.id, t: track.keyframes[0].t }]);
    toast('Track created — press K to add keyframes along the scroll range', 'ok', 'Track Created');
    onClose();
  };

  return (
    <div className="tl-addtrack" role="dialog" aria-label="Add animation track">
      <label className="tl-addtrack__field">
        <span>Target</span>
        <select className="uk-input" value={target} onChange={(e) => setTarget(e.target.value)}>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {options
                .filter((o) => o.group === g)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="tl-addtrack__field">
        <span>Channel</span>
        <select className="uk-input" value={effectiveChannel} onChange={(e) => setChannel(e.target.value)}>
          {channels.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <div className="tl-addtrack__actions">
        <button className="uk-filterchip" onClick={onClose}>
          Cancel
        </button>
        <button
          className="uk-filterchip uk-filterchip--on"
          onClick={create}
          disabled={!target || !effectiveChannel}
        >
          Add track
        </button>
      </div>
    </div>
  );
}

/* ---------------- Track stack row (left column) ---------------- */

function formatReadout(track: Track, p: number): string {
  const v = sampleKeyframes(track.keyframes, p);
  return v
    .slice(0, 3)
    .map((n) => n.toFixed(2))
    .join(', ');
}

function TrackNameRow({
  track,
  prog,
  renaming,
  onRenameStart,
  onRenameEnd,
}: {
  track: Track;
  prog: number;
  renaming: boolean;
  onRenameStart: () => void;
  onRenameEnd: () => void;
}) {
  const selTrack = useUIState((s) => s.selectedTrackId);
  const muted = useUIState((s) => s.mutedTrackIds).includes(track.id);
  const solo = useUIState((s) => s.soloTrackIds).includes(track.id);
  const locked = track.locked === true;

  return (
    <div
      className={`bs-tl-name bs-tlp-name ${selTrack === track.id ? 'bs-tl-name--active' : ''} ${muted ? 'bs-tlp-name--muted' : ''}`}
      onClick={() => setUIState({ selectedTrackId: track.id })}
      onDoubleClick={onRenameStart}
    >
      <span className="bs-tl-dot" style={{ background: getTrackColor(track.label) }} />
      {renaming ? (
        <input
          className="uk-input tl-track-name__rename"
          defaultValue={track.label}
          autoFocus
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== track.label) renameTrack(track.id, v);
            onRenameEnd();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            else if (e.key === 'Escape') onRenameEnd();
            e.stopPropagation();
          }}
        />
      ) : (
        <div className="bs-tlp-name__labels">
          <span className="bs-tlp-name__label">{track.label}</span>
          <span className="bs-tl-channel-badge">{track.channel}</span>
          {/* per-track value readout at the playhead (Spec 07   5) */}
          <span className="bs-tlp-readout bs-mono" title="Evaluated value at the playhead">
            {formatReadout(track, prog)}
          </span>
        </div>
      )}
      {/* mute  * solo  * lock (04 TimelineEditor   2: mute/solo transient, lock persisted) */}
      <span className="bs-tlp-rowbtns">
        <button
          className={`bs-tlp-rowbtn ${muted ? 'bs-tlp-rowbtn--on' : ''}`}
          title={muted ? 'Unmute track (evaluation resumes)' : 'Mute track (evaluation skips)'}
          aria-pressed={muted}
          onClick={(e) => {
            e.stopPropagation();
            toggleTrackMute(track.id);
          }}
        >
          {muted ? Icons.eyeOff : Icons.eye}
        </button>
        <button
          className={`bs-tlp-rowbtn bs-tlp-rowbtn--solo ${solo ? 'bs-tlp-rowbtn--on' : ''}`}
          title={solo ? 'Unsolo track' : 'Solo track (only soloed tracks evaluate)'}
          aria-pressed={solo}
          onClick={(e) => {
            e.stopPropagation();
            toggleTrackSolo(track.id);
          }}
        >
          S
        </button>
        <button
          className={`bs-tlp-rowbtn ${locked ? 'bs-tlp-rowbtn--on' : ''}`}
          title={locked ? 'Unlock track' : 'Lock track (keyframes become read-only)'}
          aria-pressed={locked}
          onClick={(e) => {
            e.stopPropagation();
            setTrackLocked(track.id, !locked);
          }}
        >
          {locked ? Icons.lock : Icons.unlock}
        </button>
        <button
          className="bs-tlp-rowbtn"
          title="Duplicate track"
          onClick={(e) => {
            e.stopPropagation();
            const id = duplicateTrack(track.id);
            if (id) {
              setUIState({ selectedTrackId: id });
              toast('Track duplicated — retarget or edit its keys (validation flags same-property overlaps)');
            }
          }}
        >
          {Icons.duplicate}
        </button>
        <button
          className="tl-track-name__delete"
          title="Delete track"
          onClick={(e) => {
            e.stopPropagation();
            removeTrack(track.id);
            toast(`Track '${track.label}' deleted — Ctrl+Z restores it`);
          }}
        >
           -
        </button>
      </span>
    </div>
  );
}

/* ---------------- The panel ---------------- */

interface MarqueeRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function AnimateTimelinePanel() {
  const graphMode = useUIState((s) => s.timelineGraphMode);
  const selTrack = useUIState((s) => s.selectedTrackId);
  const selKeyT = useUIState((s) => s.selectedKeyframeT);
  const selectedKeys = useSelectedKeys();
  const [prog, setProg] = useState(getProgress());
  const [playing, setPlaying] = useState(isPlaying());
  const [looping, setLooping] = useState(isLooping());
  const [addOpen, setAddOpen] = useState(false);
  const [renamingTrackId, setRenamingTrackId] = useState<string | null>(null);
  const [trackColW, setTrackColW] = useState(280);
  /* horizontal magnification of the lanes (audit T-6); pan = native scroll.
     Transient UI state (FR-123). */
  const [tlZoom, setTlZoom] = useState(1);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const [, force] = useState(0);

  useEffect(() => subscribeManifest(() => force((n) => n + 1)), []);
  useEffect(() => subscribeLoop(setLooping), []);
  useEffect(() => subscribePlaying(setPlaying), []);
  useEffect(() => subscribeProgress(setProg), []);

  const trackNamesRef = useRef<HTMLDivElement>(null);
  const lanesWrapRef = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const keyDrag = useRef<{ anchorTrackId: string; anchorT: number; keys: Map<string, number[]> } | null>(
    null,
  );
  const markerDrag = useRef<{ markerId: string } | null>(null);
  const marqueeStart = useRef<{ x: number; y: number; shift: boolean } | null>(null);

  const m = getManifest();
  const groups = groupTracks(m);

  // Sync vertical scroll between names column and lanes
  const handleLanesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (trackNamesRef.current) {
      trackNamesRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  /* Ctrl+wheel timeline zoom (audit T-6); pan = native scroll */
  useEffect(() => {
    const el = lanesWrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setTlZoom((z) => Math.max(1, Math.min(8, z * (e.deltaY < 0 ? 1.2 : 1 / 1.2))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [graphMode]);

  /* Transport: zoom-to-selection (Spec 07   5)   " frames the selected keys
     (fallback: the selected track's full span). */
  const zoomToSelection = () => {
    let ts = getSelectedKeys().map((k) => k.t);
    if (ts.length === 0 && selTrack) {
      ts = getTrack(selTrack)?.keyframes.map((k) => k.t) ?? [];
    }
    if (ts.length === 0) {
      toast('Select keyframes (or a track) to zoom to');
      return;
    }
    const min = Math.min(...ts);
    const max = Math.max(...ts);
    const span = Math.max(max - min, 0.02);
    const zoom = Math.max(1, Math.min(8, 0.8 / span));
    setTlZoom(zoom);
    requestAnimationFrame(() => {
      const wrap = lanesWrapRef.current;
      if (!wrap) return;
      wrap.scrollLeft = ((min + max) / 2) * wrap.clientWidth * zoom - wrap.clientWidth / 2;
    });
  };

  /* ---------------- dope-sheet key drag (multi-aware) ---------------- */

  const beginKeyDrag = (e: React.PointerEvent, track: Track, k: Keyframe) => {
    e.stopPropagation();
    if (e.shiftKey) {
      toggleKeySelected(track.id, k.t);
      return;
    }
    if (!isKeySelected(track.id, k.t)) {
      setSelectedKeys([{ trackId: track.id, t: k.t }]);
    } else {
      // re-anchor on the pressed key without dropping the rest
      setUIState({ selectedTrackId: track.id, selectedKeyframeT: k.t });
    }
    setProgress(k.t);
    if (track.locked) {
      toast('Track is locked — unlock it to move keyframes');
      return;
    }
    const keys = new Map<string, number[]>();
    for (const ref of getSelectedKeys()) {
      if (getTrack(ref.trackId)?.locked) continue;
      keys.set(ref.trackId, [...(keys.get(ref.trackId) ?? []), ref.t]);
    }
    if (keys.size === 0) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    keyDrag.current = { anchorTrackId: track.id, anchorT: k.t, keys };
  };

  const moveKeyDrag = (e: React.PointerEvent) => {
    const drag = keyDrag.current;
    const lanes = lanesRef.current;
    if (!drag || !lanes) return;
    const rect = lanes.getBoundingClientRect();
    const raw = (e.clientX - rect.left) / rect.width;
    const excl = drag.keys.get(drag.anchorTrackId) ?? [];
    const snapped = snapKeyT(raw, drag.anchorTrackId, excl);
    let delta = snapped - drag.anchorT;
    if (Math.abs(delta) < EPS) return;
    // clamp so every selected key stays inside [0,1]
    let minT = Infinity;
    let maxT = -Infinity;
    for (const ts of drag.keys.values()) {
      for (const t of ts) {
        minT = Math.min(minT, t);
        maxT = Math.max(maxT, t);
      }
    }
    delta = Math.max(-minT, Math.min(1 - maxT, delta));
    if (Math.abs(delta) < EPS) return;
    for (const [trackId, ts] of drag.keys) {
      const track = getTrack(trackId);
      if (!track) continue;
      const moved: Keyframe[] = track.keyframes.map((kf) =>
        ts.some((t) => Math.abs(kf.t - t) < EPS) ? { ...kf, t: round4(kf.t + delta) } : kf,
      );
      setTrackKeyframes(trackId, moved, true);
    }
    const nextSel: KeyRef[] = [];
    for (const [trackId, ts] of drag.keys) {
      const nextTs = ts.map((t) => round4(t + delta));
      drag.keys.set(trackId, nextTs);
      for (const t of nextTs) {
        if (!(trackId === drag.anchorTrackId && Math.abs(t - round4(drag.anchorT + delta)) < EPS)) {
          nextSel.push({ trackId, t });
        }
      }
    }
    drag.anchorT = round4(drag.anchorT + delta);
    nextSel.push({ trackId: drag.anchorTrackId, t: drag.anchorT }); // anchor last
    setSelectedKeys(nextSel);
    setProgress(drag.anchorT);
  };

  const endKeyDrag = () => {
    keyDrag.current = null;
  };

  /* ---------------- marquee select (Spec 07   5) ---------------- */

  const beginMarquee = (e: React.PointerEvent<HTMLDivElement>) => {
    // only from empty lane space   " keys/markers stop propagation
    const lanes = lanesRef.current;
    if (!lanes) return;
    const rect = lanes.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    marqueeStart.current = { x, y, shift: e.shiftKey };
    setMarquee({ x0: x, y0: y, x1: x, y1: y });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const moveMarquee = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = marqueeStart.current;
    const lanes = lanesRef.current;
    if (!start || !lanes) return;
    const rect = lanes.getBoundingClientRect();
    setMarquee({ x0: start.x, y0: start.y, x1: e.clientX - rect.left, y1: e.clientY - rect.top });
  };

  const endMarquee = () => {
    const start = marqueeStart.current;
    const lanes = lanesRef.current;
    marqueeStart.current = null;
    if (!start || !lanes || !marquee) {
      setMarquee(null);
      return;
    }
    const rx0 = Math.min(marquee.x0, marquee.x1);
    const rx1 = Math.max(marquee.x0, marquee.x1);
    const ry0 = Math.min(marquee.y0, marquee.y1);
    const ry1 = Math.max(marquee.y0, marquee.y1);
    setMarquee(null);
    if (rx1 - rx0 < 3 && ry1 - ry0 < 3) {
      // click on empty space clears the selection
      if (!start.shift) setSelectedKeys([]);
      return;
    }
    const laneW = lanes.getBoundingClientRect().width;
    const hits: KeyRef[] = [];
    let y = 0;
    for (const g of groups) {
      y += GROUP_H;
      for (const t of g.tracks) {
        const rowTop = y;
        const rowBot = y + ROW_H;
        if (!(rowBot < ry0 || rowTop > ry1) && !t.locked) {
          for (const k of t.keyframes) {
            const x = k.t * laneW;
            if (x >= rx0 && x <= rx1) hits.push({ trackId: t.id, t: k.t });
          }
        }
        y += ROW_H;
      }
    }
    const merged = start.shift
      ? [...getSelectedKeys().filter((s) => !hits.some((h) => h.trackId === s.trackId && Math.abs(h.t - s.t) < EPS)), ...hits]
      : hits;
    setSelectedKeys(merged);
  };

  const zoomStyle = { width: `${tlZoom * 100}%` } as const;

  return (
    <footer className="timeline bs-shell__timeline bs-timeline bs-tlp">
      {/* 1. Mode tabs + transport (Spec 07   5 transport bar) */}
      <div className="tl-tabs bs-tl-head">
        <button
          className={`tl-tab ${!graphMode ? 'on' : ''}`}
          aria-pressed={!graphMode}
          title="1 - 2"
          onClick={() => setUIState({ timelineGraphMode: false })}
        >
          Dope Sheet
        </button>
        <button
          className={`tl-tab ${graphMode ? 'on' : ''}`}
          aria-pressed={graphMode}
          title="1 - 2"
          onClick={() => setUIState({ timelineGraphMode: true })}
        >
          Graph Editor
        </button>

        <div className="tl-transport bs-tl-transport">
          <button title="Start" id="tl-start" onClick={() => setProgress(0)}>
            {Icons.skipBack}
          </button>

          <button
            className={`play ${playing ? 'playing' : ''}`}
            id="tl-play"
            title="Play / Pause (Space)"
            onClick={() => (playing ? pause() : play())}
          >
            {playing ? Icons.pause : Icons.play}
          </button>

          <button title="End" id="tl-end" onClick={() => setProgress(1)}>
            {Icons.skipForward}
          </button>

          <button
            className={looping ? 'tl-toggle--on' : ''}
            title={`Loop playback: ${looping ? 'on' : 'off'}`}
            aria-pressed={looping}
            onClick={() => setLoop(!looping)}
          >
            {Icons.loop}
          </button>

          <button
            title="Add marker at playhead"
            onClick={() => {
              const mk = addMarker(getProgress());
              toast(`${mk.label} added at t=${mk.t.toFixed(2)} — drag to move, double-click to delete`);
            }}
          >
            {Icons.marker}
          </button>

          <button title="Add keyframe at playhead (K)" onClick={() => addKeyframeAtPlayhead(selTrack)}>
            {Icons.diamondPlus}
          </button>

          <button
            title="1 - 2"
            onClick={zoomToSelection}
          >
            {Icons.maximize}
          </button>

          <button
            className="tl-addtrack__toggle"
            title="Add animation track"
            aria-expanded={addOpen}
            onClick={() => setAddOpen((o) => !o)}
          >
            + Track
          </button>

          {/* honest readout   " derived from the ONE [0,1] clock (audit T-5/U-5) */}
          <span className="tl-scrollpos" id="tl-pos">
            {(prog * 100).toFixed(1)}%  * t {prog.toFixed(3)}
          </span>
        </div>
        {addOpen && <AddTrackPopover onClose={() => setAddOpen(false)} />}
      </div>

      {/* 2a. Graph mode   " replaces the dope sheet in place (toggle G) */}
      {graphMode && <AnimateGraphEditor />}

      {/* 2b. Dope sheet */}
      {!graphMode && (
        <div
          className="tl-body bs-tl-rows bs-tlp-body"
          style={{ gridTemplateColumns: `${trackColW}px 1fr` }}
        >
          {/* Left column width resizer */}
          <div
            className="bs-tlp-colresize"
            title="Drag left/right to adjust track column width"
            style={{ left: trackColW - 3 }}
            onPointerDown={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              const startX = e.clientX;
              const startW = trackColW;
              const onMove = (ev: PointerEvent) => {
                setTrackColW(Math.max(180, Math.min(520, startW + (ev.clientX - startX))));
              };
              const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
              };
              window.addEventListener('pointermove', onMove);
              window.addEventListener('pointerup', onUp);
            }}
          />

          {/* Left column   " track stack (Spec 07   5) */}
          <div className="tl-tracks-names bs-tlp-names" id="tl-names" ref={trackNamesRef}>
            <div className="bs-tlp-colhead">Tracks &amp; Channels</div>
            {groups.length === 0 && (
              <div className="bs-tlp-empty bs-muted">No tracks yet — use + Track to start animating.</div>
            )}
            {groups.map((g) => (
              <div key={g.name}>
                <div className="bs-tlp-group" title={`${g.tracks.length} track${g.tracks.length === 1 ? '' : 's'}`}>
                  {g.name}
                  <span className="bs-tlp-group__count">{g.tracks.length}</span>
                </div>
                {g.tracks.map((t) => (
                  <TrackNameRow
                    key={t.id}
                    track={t}
                    prog={prog}
                    renaming={renamingTrackId === t.id}
                    onRenameStart={() => setRenamingTrackId(t.id)}
                    onRenameEnd={() => setRenamingTrackId(null)}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Right column   " ruler + lanes */}
          <div className="tl-lane-wrap" ref={lanesWrapRef} onScroll={handleLanesScroll}>
            {/* Ruler   " shared ProgressRuler primitive (Spec 07   9.2; a11y slider,
                0.001 nudge / Shift  -10 per 04 TimelineEditor   7) */}
            <ProgressRuler
              className="tl-ruler bs-tlp-ruler"
              style={zoomStyle}
              value={prog}
              ariaLabel="Timeline playhead"
              onScrubStart={pause}
              onScrub={setProgress}
            >
              <div className="bs-tlp-ticks" aria-hidden="true">
                {Array.from({ length: 11 }).map((_, i) => (
                  <div key={i} className="bs-tlp-tick" />
                ))}
              </div>

              {m.sections.map((s, idx) => (
                <div
                  key={s.id}
                  className={`bs-rng bs-tlp-band ${idx % 2 === 0 ? 'bs-tlp-band--even' : ''}`}
                  style={{
                    left: `${s.range[0] * 100}%`,
                    width: `${(s.range[1] - s.range[0]) * 100}%`,
                  }}
                >
                  {s.name}
                </div>
              ))}

              {/* markers (audit T-3): drag moves  * double-click deletes */}
              {m.markers.map((mk) => (
                <button
                  key={mk.id}
                  className="tl-marker"
                  style={{ left: `${mk.t * 100}%` }}
                  title={`${mk.label} · t=${mk.t.toFixed(2)} — drag to move, double-click to delete`}
                  aria-label={`Marker ${mk.label} at ${Math.round(mk.t * 100)}%`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    markerDrag.current = { markerId: mk.id };
                    setProgress(mk.t);
                  }}
                  onPointerMove={(e) => {
                    if (markerDrag.current?.markerId !== mk.id) return;
                    const ruler = (e.currentTarget as HTMLElement).parentElement!;
                    const rect = ruler.getBoundingClientRect();
                    const t = snapKeyT((e.clientX - rect.left) / rect.width);
                    setMarkerProp(mk.id, 't', t, true);
                    setProgress(t);
                  }}
                  onPointerUp={() => {
                    markerDrag.current = null;
                  }}
                  onDoubleClick={() => {
                    removeMarker(mk.id);
                    toast(`${mk.label} deleted — Ctrl+Z restores it`);
                  }}
                >
                  {Icons.marker}
                </button>
              ))}
              <div className="bs-tl-playhead" style={{ left: `${prog * 100}%` }} />
            </ProgressRuler>

            {/* Lanes   " dope sheet rows mirroring the track stack */}
            <div
              className="tl-lanes bs-tlp-lanes"
              id="tl-lanes"
              ref={lanesRef}
              style={zoomStyle}
              onPointerDown={beginMarquee}
              onPointerMove={moveMarquee}
              onPointerUp={endMarquee}
              onPointerCancel={endMarquee}
            >
              {groups.map((g) => {
                const groupTs = g.tracks.flatMap((t) => t.keyframes.map((k) => k.t));
                const gMin = groupTs.length ? Math.min(...groupTs) : 0;
                const gMax = groupTs.length ? Math.max(...groupTs) : 0;
                return (
                  <div key={g.name}>
                    {/* group row   " aggregate range (04 TimelineEditor   2) */}
                    <div className="bs-tlp-grouplane" aria-hidden="true">
                      {groupTs.length > 1 && (
                        <div
                          className="bs-tlp-groupspan"
                          style={{ left: `${gMin * 100}%`, width: `${(gMax - gMin) * 100}%` }}
                        />
                      )}
                    </div>
                    {g.tracks.map((t) => {
                      const color = getTrackColor(t.label);
                      const kfTs = t.keyframes.map((k) => k.t);
                      const clipStart = kfTs.length > 0 ? Math.min(...kfTs) : 0;
                      const clipEnd = kfTs.length > 1 ? Math.max(...kfTs) : clipStart;
                      const hasClip = kfTs.length > 1;
                      return (
                        <div
                          key={t.id}
                          className={`bs-tl-track bs-tlp-lane ${t.locked ? 'bs-tlp-lane--locked' : ''}`}
                        >
                          {hasClip && (
                            <div
                              className="bs-tl-clip"
                              style={{
                                left: `${clipStart * 100}%`,
                                width: `${(clipEnd - clipStart) * 100}%`,
                                background: getClipColor(t.label),
                              }}
                            />
                          )}
                          {t.keyframes.map((k, i) => {
                            const isSel =
                              isKeySelected(t.id, k.t) ||
                              (selTrack === t.id && selKeyT !== null && Math.abs(k.t - selKeyT) < EPS);
                            const ease = k.ease ?? 'smooth';
                            return (
                              <span
                                key={`${i}-${k.t}`}
                                className={`bs-kf bs-kf--${ease} ${isSel ? 'bs-kf--sel' : ''}`}
                                style={{ left: `${k.t * 100}%`, color }}
                                title={`t=${k.t}  * ${ease}${t.locked ? '  * locked' : ' - drag to move, Shift+click adds to selection'}`}
                                onPointerDown={(e) => beginKeyDrag(e, t, k)}
                                onPointerMove={moveKeyDrag}
                                onPointerUp={endKeyDrag}
                                onPointerCancel={endKeyDrag}
                              />
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {marquee && (
                <div
                  className="bs-tlp-marquee"
                  style={{
                    left: Math.min(marquee.x0, marquee.x1),
                    top: Math.min(marquee.y0, marquee.y1),
                    width: Math.abs(marquee.x1 - marquee.x0),
                    height: Math.abs(marquee.y1 - marquee.y0),
                  }}
                />
              )}
              <div className="bs-tl-playhead" style={{ left: `${prog * 100}%` }} />
            </div>
          </div>
        </div>
      )}
      {/* keep panel re-render keyed to selection so glyph states stay live */}
      <span className="bs-tlp-selcount" aria-live="polite" data-count={selectedKeys.length} />
    </footer>
  );
}
