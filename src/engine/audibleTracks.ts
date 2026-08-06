/**
 * Transient track audibility filter (04 TimelineEditor   2: "mute   " evaluation
 * skips"; solo wins). Applied wherever an evaluator is built from
 * `manifest.tracks` (viewport runtime, embed viewer, DOM canvas), so a muted
 * track releases its channels back to manifest base values everywhere.
 *
 * Mute/solo live in the UI store only (04 TimelineEditor   6/AC-2   " never in
 * the manifest); consumers that cache evaluators must include this filter's
 * output in their trackSignature comparison so toggles rebuild them.
 */
import type { Track } from '@bs/engine';
import { isTrackAudible } from '@bs/engine';

export function audibleTracks(tracks: Track[]): Track[] {
  return tracks.filter((t) => isTrackAudible(t.id));
}
