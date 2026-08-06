/**
 * Asset Studio   " the library instrument (Spec 07   7, stage R4).
 * Public surface consumed by the shell studio registry.
 * Target folder per Plan 06   3.2 (`studios/asset-studio/**`).
 *
 * The AssetWorkspace grid itself still lives in `shell/AssetWorkspace.tsx` (its
 * folder move is a later IL-11 pure-move batch); R4 adds the transient
 * AssetIngestTray affordance and the tray-aware import entry.
 *
 * Plan 06   3.4   " per-studio stylesheet colocated with the studio code.
 * Vite chunks it as `asset-studio-*.css`.
 */
import './styles/AssetStudio.css';

export { AssetIngestTray } from './components/panels/AssetIngestTray';
export { importFilesWithTray } from './utils/assetImport';
export { AssetWorkspace } from './components/viewport/AssetWorkspace';
;

import './AssetRegistration';
