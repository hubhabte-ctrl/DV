/**
 * Standalone Runtime Build Target (WS2-5, PRD-AC-04).
 * Consumes an exported manifest (golden-manifest.json) and renders it using
 * the PreviewMode bridge, with ZERO editor UI imports. Vite tree-shaking
 * ensures that the shell components (Inspector, AssetWorkspace, Timeline) are
 * entirely excluded from this build target.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { hydrateManifest } from '@bs/engine';
import { applyTokens } from './app/ui/tokens/applyTokens';;
import { PreviewMode } from './studios/preview-studio';
import './app/ui/tokens/global.css';

async function boot() {
  applyTokens();
  try {
    const res = await fetch('/golden-manifest.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const doc = await res.json();
    if (!doc.manifest) throw new Error('Invalid interchange document');
    
    // Hydrate the engine directly from the exported JSON
    hydrateManifest(doc.manifest);
  } catch (err) {
    console.error('[runtime] Failed to load /golden-manifest.json', err);
    document.body.innerHTML = '<div style="color:white;padding:20px;font-family:sans-serif">Failed to load golden-manifest.json (see console)</div>';
    return;
  }

  // Render the scroll-driven preview stage (zero authoring chrome)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <PreviewMode />
    </StrictMode>,
  );
}

boot();
