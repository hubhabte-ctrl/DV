import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { applyTokens } from './app/ui/tokens/applyTokens';
import { toast } from './app/ui/Toast';
import { hydrateManifest } from '@bs/engine';
import { loadProject, persistNow, registerDraftSync, registerStorageHooks } from './engine/storage';
import { initData, registerConflictHandler, syncDraft } from '@bs/services';
/* Plan 06   3.1 step 2   " static token layer first; cascade is correct;
   HMR propagates token edits without re-running applyTokens(). */
import "./app/ui/tokens/tokens.css";
import "./app/ui/tokens/global.css";
/* Plan 06   3.4   " Modular shell stylesheets have been moved into individual studios */
import { setUIState } from '@bs/engine';

import { initCloudStatusMonitor, setCloudMode } from './engine/cloudStatus';

// Plan 06   3.4   " register shell-level persistence hooks with the engine
// *before* any dispatch can occur (IndexedDB + asset-blob store).
registerStorageHooks();

applyTokens();

function render(): void {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

/* Boot order (WS1   " ADR-005/FR-115, FR-113 offline posture), all before React
   mounts so every consumer including the imperative viewport sees final state:
     1. PostgreSQL bootstrap (source of truth)   " draft manifest + registries.
     2. Offline fallback: IndexedDB autosave buffer, then bundled seed.
   Imported asset binaries always rehydrate from the local blob cache. */
async function boot(): Promise<void> {
  const [data, saved] = await Promise.all([
    initData(),
    loadProject().catch((err) => {
      console.warn('[storage] local buffer unavailable', err);
      return null;
    }),
  ]);
  if (data.source === 'postgresql') {
    setCloudMode('postgresql');
    hydrateManifest(data.manifest as Record<string, unknown>, saved?.blobUrls);
    void persistNow(() => data.manifest); // sync local IndexedDB buffer with PostgreSQL canonical draft (ADR-005)
    registerDraftSync(syncDraft); // autosaves flow back to PostgreSQL (FR-112)
    // FR-103 conflicts surface non-blocking (WS1-R5): local copy is kept
    registerConflictHandler((serverVersion) => {
      setUIState({ conflictVersion: serverVersion ?? 0 });
      toast(
        `The server draft changed elsewhere${serverVersion ? ` (now v${serverVersion})` : ''}. ` +
          'Your local copy is kept. Choose how to resolve in the conflict dialog.',
        'err',
        'Draft conflict',
      );
    });
  } else if (saved?.manifest) {
    setCloudMode('offline');
    hydrateManifest(saved.manifest, saved.blobUrls); // offline: local buffer wins
  } else if (data.manifest) {
    setCloudMode('offline');
    hydrateManifest(data.manifest as Record<string, unknown>);
  }

  // Initialize real-time cloud connection health monitor
  initCloudStatusMonitor();
}


boot()
  .catch((err) => console.warn('[boot] hydration skipped', err))
  .finally(render);
