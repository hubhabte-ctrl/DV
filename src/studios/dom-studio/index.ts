/**
 * DOM Studio   " the document layout instrument (Plan 06   3.2).
 * Public surface consumed by the shell studio registry.
 * Target folder per Plan 06   3.2 (`studios/dom-studio/**`).
 */
import './styles/DOMStudio.css';

export { DOMViewport } from './components/viewport/DOMViewport';
;
export { DOMFlowStrip } from './components/panels/DOMFlowStrip';
export { DOMProfileBar } from './components/toolbar/DOMProfileBar';
export * from './components/viewport';

import './DOMRegistration';
