/**
 * AssetIngestTray   " Asset Studio's transient bottom surface (Spec 07   7).
 * "Slides up only during drag-drop/import; per-file rows with resumable
 * progress and processing stages (scan   ' compress   ' thumbnail); auto-dismisses
 * on completion (toast summary). Replaces nothing   " new affordance."
 *
 * Reads the transient ingest queue (assetIngestQueue.ts, FR-123). It renders nothing
 * when the queue is empty, so it is safe to mount unconditionally by the shell.
 */
import { useEffect, useRef } from 'react';
import { Icons } from '../../../../app/ui/Icons';
import { toast } from '../../../../app/ui/Toast';
import {
  clearFinishedIngest,
  ingestActiveCount,
  useIngestRows,
  type IngestStage,
} from '../../state/assetIngestQueue';

const STAGE_LABEL: Record<IngestStage, string> = {
  queued: 'Queued',
  scan: 'Scanning',
  compress: 'Compressing',
  thumbnail: 'Thumbnailing',
  done: 'Done',
  rejected: 'Rejected',
};

const PIPELINE: IngestStage[] = ['scan', 'compress', 'thumbnail'];

function rowFraction(stage: IngestStage, progress: number): number {
  if (stage === 'done' || stage === 'rejected') return 1;
  if (stage === 'queued') return 0;
  const idx = PIPELINE.indexOf(stage);
  return (idx + progress) / PIPELINE.length;
}

function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function AssetIngestTray() {
  const rows = useIngestRows();
  const active = ingestActiveCount();
  /** auto-dismiss once every row settled   " toast the summary (Spec 07   7) */
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const summarized = useRef(false);

  useEffect(() => {
    if (rows.length === 0) {
      summarized.current = false;
      return;
    }
    if (active === 0 && !summarized.current) {
      summarized.current = true;
      const done = rows.filter((r) => r.stage === 'done').length;
      const rejected = rows.filter((r) => r.stage === 'rejected').length;
      if (done) toast(`${done} asset(s) imported`, 'ok');
      if (rejected) toast(`${rejected} file(s) skipped — unsupported type`, 'err');
      dismissTimer.current = setTimeout(clearFinishedIngest, 1400);
    }
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [rows, active]);

  if (rows.length === 0) return null;

  return (
    <div className="bs-ingesttray" role="status" aria-live="polite" aria-label="Asset import progress">
      <div className="bs-ingesttray__head">
        <span className="bs-ingesttray__title">
          {active > 0 ? `Importing ${active} file${active === 1 ? '' : 's'}   ` : 'Import complete'}
        </span>
        <button
          className="bs-ingesttray__close"
          title="Dismiss"
          aria-label="Dismiss import tray"
          onClick={clearFinishedIngest}
        >
          {Icons.close}
        </button>
      </div>
      <div className="bs-ingesttray__rows">
        {rows.map((r) => {
          const frac = rowFraction(r.stage, r.progress);
          const settled = r.stage === 'done' || r.stage === 'rejected';
          return (
            <div key={r.id} className={`bs-ingestrow bs-ingestrow--${r.stage}`}>
              <span className="bs-ingestrow__name" title={r.name}>
                {r.name}
              </span>
              <span className="bs-ingestrow__size bs-mono">{sizeLabel(r.size)}</span>
              <span className="bs-ingestrow__stage">
                {r.stage === 'rejected' ? (r.reason ?? STAGE_LABEL.rejected) : STAGE_LABEL[r.stage]}
              </span>
              <span className="bs-ingestrow__bar" aria-hidden="true">
                {!settled && (
                  <span className="bs-ingestrow__fill" style={{ width: `${Math.round(frac * 100)}%` }} />
                )}
                {r.stage === 'done' && <span className="bs-ingestrow__done">{Icons.check}</span>}
                {r.stage === 'rejected' && <span className="bs-ingestrow__err">{Icons.close}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
