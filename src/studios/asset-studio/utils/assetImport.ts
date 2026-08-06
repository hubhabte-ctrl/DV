/**
 * Tray-aware import entry (Spec 07   7). Wraps the existing universal import
 * (`shell/LeftRail.importAssetFiles`, which owns GLB scene extraction + the
 * `assetIngest.ingestFiles` batch command   " IL-1) with the transient AssetIngestTray
 * progress affordance (assetIngestQueue.ts, FR-123).
 *
 * The record creation is unchanged and still authoritative; this only animates
 * per-file scan   ' compress   ' thumbnail rows in front of it, then lets the tray
 * auto-dismiss with a toast summary. Rejected (unsupported) files surface as
 * rejected rows instead of silently dropping.
 */
import { createRoot } from 'react-dom/client';
import { Icons } from '../../../app/ui/Icons';
import { toast } from '../../../app/ui/Toast';
import { categoryForFile } from '../../../engine/assetIngest';
import { importAssetFiles } from '../components/panels/AssetLibraryPanel';
import { MIME_ASSET } from './dnd';
import { enqueueIngest, rejectIngest, runIngestPipeline } from '../state/assetIngestQueue';

export function importFilesWithTray(files: File[]): void {
  if (files.length === 0) return;

  const accepted: File[] = [];
  const rejectedRows: string[] = [];

  for (const file of files) {
    const id = enqueueIngest(file.name, file.size);
    if (categoryForFile(file.name)) {
      accepted.push(file);
      // drive the row's progress; the tray toasts + dismisses when all settle
      void runIngestPipeline(id);
    } else {
      rejectIngest(id, 'Unsupported type');
      rejectedRows.push(file.name);
    }
  }

  // Hand the accepted files to the existing authoritative importer (records +
  // GLB extraction + persisted blobs). Its own success toast is superseded by
  // the tray summary, but the underlying command dispatch is what matters.
  if (accepted.length > 0) importAssetFiles(accepted);
}
