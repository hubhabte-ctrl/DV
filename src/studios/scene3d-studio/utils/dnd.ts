/**
 * Drag-and-drop MIME registry for the editor shell (WS2-2 pure move out of
 * DOMViewport.tsx   " broke the DOMViewport   " Scene3DViewport import cycle flagged by
 * the dependency-cruiser gate; behavior-identical, IL-11).
 */
export const MIME_COMPONENT = 'application/x-bs-component';
export const MIME_ASSET = 'application/x-bs-asset';
/** material drag (Phase 2.4   " audit M-5): assign by dropping onto a mesh in the 3D viewport */
export const MIME_MATERIAL = 'application/x-bs-material';
