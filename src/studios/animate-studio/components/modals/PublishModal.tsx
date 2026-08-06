/**
 * Publish modal (Phase 2.9   " audit U-3; 12_PublishStudio UI contract).
 * MVP scope: the UI contract only   " version summary, immutability notice and
 * the smoke-test gate (IL-4/IL-5: versions are immutable; the production
 * pointer flips only after a smoke test). "Record version" writes a REAL
 * immutable snapshot entry into the manifest via the command engine (IL-1);
 * the deploy pipeline itself is post-MVP (Doc 01   6) and stays out of scope.
 */
import { useState } from 'react';
import { Icons } from '../../../../app/ui/Icons';
import { toast } from '../../../../app/ui/Toast';
import { dispatch, getManifest } from '@bs/engine';

const SMOKE_CHECKS = [
  'Scroll 0 -> 1: DOM, 3D, materials and camera stay in sync (Rule 3/6)',
  'All sections reachable; no missing-asset error states in the page',
  'Preview mode renders the full narrative without console errors',
] as const;

export function PublishModal({ onClose }: { onClose: () => void }) {
  const m = getManifest();
  const [checks, setChecks] = useState<boolean[]>(SMOKE_CHECKS.map(() => false));
  const allChecked = checks.every(Boolean);
  const nextVersion = (m.publishedVersions[m.publishedVersions.length - 1]?.version ?? 0) + 1;
  const summary =
    `${m.sections.length} sections · ${Object.keys(m.domNodes).length} DOM nodes · ` +
    `${Object.keys(m.sceneNodes).length} scene nodes · ${m.tracks.length} tracks · ` +
    `${m.assets.length} assets · ${Object.keys(m.materials).length} materials`;

  const publish = () => {
    dispatch({
      type: 'set',
      path: 'publishedVersions',
      value: [...m.publishedVersions, { version: nextVersion, at: new Date().toISOString(), summary }],
    });
    toast(`Version v${nextVersion} recorded — immutable snapshot`);
    onClose();
  };

  return (
    <div className="uk-palette__backdrop" role="presentation" onClick={onClose}>
      <div
        className="bs-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Publish version"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="bs-modal__head">
          <strong>Publish · Version v{nextVersion}</strong>
          <button className="uk-iconbtn" aria-label="Close" data-tooltip="Close" onClick={onClose}>
            {Icons.close}
          </button>
        </header>
        <div className="bs-modal__body">
          <p className="bs-muted bs-modal__note">
            Published versions are <b>immutable</b>; the production pointer flips only after the smoke test
            passes (Iron Laws IL-4/IL-5).
          </p>
          <div className="bs-modal__summary bs-mono">{summary}</div>
          <span className="bs-group-label">Smoke test</span>
          {SMOKE_CHECKS.map((label, i) => (
            <label key={label} className="bs-modal__check">
              <input
                type="checkbox"
                checked={checks[i]}
                onChange={() => setChecks((c) => c.map((v, j) => (j === i ? !v : v)))}
              />
              <span>{label}</span>
            </label>
          ))}
          {m.publishedVersions.length > 0 && (
            <>
              <span className="bs-group-label">Version history</span>
              {m.publishedVersions.map((v) => (
                <div key={v.version} className="bs-modal__version bs-mono">
                  v{v.version} · {new Date(v.at).toLocaleString()} · {v.summary}
                </div>
              ))}
            </>
          )}
        </div>
        <footer className="bs-modal__foot">
          <button className="uk-btn uk-btn--secondary uk-btn--sm" onClick={onClose}>
            Cancel
          </button>
          <button
            className="uk-btn uk-btn--primary uk-btn--sm"
            disabled={!allChecked}
            title={
              allChecked ? 'Record the immutable version snapshot' : 'Complete the smoke test first (IL-5)'
            }
            onClick={publish}
          >
            Record version v{nextVersion}
          </button>
        </footer>
      </div>
    </div>
  );
}
