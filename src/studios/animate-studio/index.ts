/**
 * Animation Studio   " the motion instrument (Spec 07   5, stage R2).
 * Public surface consumed by the shell registry and App.tsx's global keymap.
 * Target folder per Plan 06   3.2 (`studios/animate-studio/**`).
 *
 * Plan 06   3.4   " per-studio stylesheet colocated with the studio code.
 * Vite chunks it as `animate-studio-*.css`.
 */
import './styles/AnimateStudio.css';

export { AnimateViewport } from './components/viewport/AnimateViewport';
export { AnimateTimelinePanel } from './components/panels/AnimateTimelinePanel';
export {
  addKeyframeAtPlayhead,
  copySelectedKeyframes,
  deleteSelectedKeyframes,
  pasteKeyframesAtPlayhead,
} from './utils/animateKeyOps';
;

import './AnimateRegistration';
