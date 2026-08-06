/**
 * Draft Conflict Resolution Modal (FR-103 / FR-113).
 * Surfaces when a 409 Conflict is returned by the PostgreSQL backend.
 * Provides clear interactive choices:
 *  1. Keep local changes & overwrite server draft
 *  2. Reload server version
 *  3. Export local manifest JSON then reload server version
 */
import { useState } from 'react';
import { Button } from '../common/Button';
import { Icons } from '../../../../app/ui/Icons';
import { toast } from '../../../../app/ui/Toast'
import { forceSyncLocalDraft, initData } from '@bs/services';
import { getManifest, hydrateManifest } from '@bs/engine';
import { persistNow } from '../../../../engine/storage';

export function ConflictModal({
  serverVersion,
  onClose,
}: {
  serverVersion?: number;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const exportLocalCopy = () => {
    const m = getManifest();
    const blob = new Blob([JSON.stringify(m, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${m.projectName.replace(/[^\w-]+/g, '_')}_backup_v${serverVersion ?? 'conflict'}.manifest.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Local manifest backup exported as JSON file', 'ok', 'Backup Created');
  };

  const handleKeepLocal = async () => {
    if (!serverVersion) return;
    setLoading(true);
    try {
      const res = await forceSyncLocalDraft(getManifest(), serverVersion);
      if (res) {
        toast(`Local draft saved to database as v${res.draftVersion}`, 'ok', 'Conflict Resolved');
      } else {
        toast('Failed to overwrite server draft', 'err', 'Conflict Error');
      }
    } catch (err) {
      toast(`Failed to resolve conflict: ${String(err)}`, 'err', 'Conflict Error');
    } finally {
      setLoading(false);
      onClose();
    }
  };

  const handleReloadServer = async () => {
    setLoading(true);
    try {
      const data = await initData();
      if (data.manifest) {
        hydrateManifest(data.manifest as Record<string, unknown>);
        await persistNow(() => data.manifest);
        toast(`Reloaded server draft (v${data.project.draftVersion})`, 'ok', 'Server Draft Loaded');
      }
    } catch (err) {
      toast(`Failed to reload server draft: ${String(err)}`, 'err', 'Reload Failed');
    } finally {
      setLoading(false);
      onClose();
    }
  };

  const handleExportAndReload = async () => {
    exportLocalCopy();
    await handleReloadServer();
  };

  return (
    <div className="uk-palette__backdrop" role="presentation" onClick={onClose}>
      <div
        className="bs-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Draft version conflict"
        style={{ maxWidth: 520 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="bs-modal__head" style={{ borderColor: 'var(--bs-color-danger-border)' }}>
          <strong style={{ color: 'var(--bs-color-danger-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {Icons.warning ?? '      '} Draft Version Conflict (FR-103)
          </strong>
          <button className="uk-iconbtn" aria-label="Close" onClick={onClose}>
            {Icons.close}
          </button>
        </header>
        <div className="bs-modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p className="bs-muted bs-m-0 bs-leading-loose">
            The project draft on the server was updated elsewhere
            {serverVersion ? <b> (now v{serverVersion})</b> : ''}. Your local edits are safely preserved in browser memory.
          </p>

          <div
            style={{
              padding: 12,
              borderRadius: 6,
              background: 'var(--bs-color-bg-secondary)',
              border: '1px solid var(--border)',
              fontSize: 13,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <strong>Choose how to resolve this conflict:</strong>
            <ul className="bs-m-0 bs-pl-xl bs-flex-col bs-gap-xs">
              <li><b>Keep Local Changes:</b> Overwrite the server draft with your local copy.</li>
              <li><b>Reload Server Version:</b> Discard local unsaved changes and load the latest server copy.</li>
              <li><b>Export & Reload:</b> Backup your local edits to JSON first, then load the server copy.</li>
            </ul>
          </div>

          <div className="bs-flex-col bs-gap-md bs-mt-md">
            <Button variant="primary" disabled={loading} onClick={handleKeepLocal}>
              Keep Local Changes & Overwrite Server
            </Button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button className="bs-flex-1" variant="secondary" disabled={loading} onClick={handleReloadServer}>
                Reload Server Draft
              </Button>
              <Button className="bs-flex-1" variant="secondary" disabled={loading} onClick={handleExportAndReload}>
                Export Backup & Reload
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
