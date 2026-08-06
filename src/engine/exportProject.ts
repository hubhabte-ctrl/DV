/**
 * Project export (manifest   ' JSON download).
 *
 * Lifted out of `shared/TopBar.tsx` so the Left Rail settings popover can offer
 * the same action without duplicating the implementation (CLAUDE.md   6.2 step 6)
 * and without importing TopBar   " `TopBar.tsx:57` already imports from
 * `LeftRail.tsx`, so a rail   ' TopBar import would close an import cycle.
 */
import { toast } from '../app/ui/Toast';
import { getManifest } from '@bs/engine';

export function exportProjectJson(): void {
  const m = getManifest();
  const blob = new Blob([JSON.stringify(m, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${m.projectName.replace(/[^\w-]+/g, '_')}.manifest.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Project manifest exported as JSON file', 'ok', 'Export Complete');
}
