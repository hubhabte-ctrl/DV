/**
 * @bs/runtime — canonical [0,1] progress clock (WS2-1b, Doc 04 §1, ADR-001, IL-2).
 *
 * Phase 1 of the WS2-1b extraction: the progress clock is the only truly
 * standalone piece — it has zero dependencies on engine/viewport/React and can
 * be extracted cleanly. createViewport and handleRegistry move here in the
 * next phase once the viewport's engine imports are also packaged.
 */
export {
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
} from './progress';

export { acquirePooledTarget, type PooledTarget } from './viewport/embedPool';
/* NOTE (Plan 06 Phase 2, RC-5): the viewport handle registry intentionally does NOT
   live here yet. The canonical singleton is `frontend/src/viewport/handleRegistry.ts`
   (used by ViewportHost/App/CommandPalette/ViewportToolbar). A premature duplicate
   here created a second, always-null singleton and has been removed. The registry
   moves here with the WS2 physical extraction (Plan 06 Phase 3). */

