/**
 * DOMProfileBar (Doc 05   3): compact icon-only device profile switcher.
 * Shows Desktop / Tablet / Mobile as icon buttons with tooltip on hover.
 * No dark overlay   " sits inline above the canvas, fully transparent background.
 * Only rendered in DOM and Preview modes.
 */
import { useEffect, useState } from 'react';
import { getManifest, subscribeManifest } from '@bs/engine';
import { setCanvasZoom, setUIState, useUIState, type DeviceProfile } from '@bs/engine';
import { Icons } from '../../../../app/ui/Icons';

const PROFILE_META: Record<DeviceProfile, { icon: React.ReactNode; label: string }> = {
  desktop: { icon: Icons.desktop, label: 'Desktop (Base)' },
  tablet: { icon: Icons.tablet, label: 'Tablet' },
  mobile: { icon: Icons.mobile, label: 'Mobile' },
};

export function DOMProfileBar() {
  const profile = useUIState((s) => s.profile);
  const zoom = useUIState((s) => s.canvasZoom);
  const [breakpoints, setBreakpoints] = useState(getManifest().breakpoints);

  useEffect(() => subscribeManifest(() => setBreakpoints(getManifest().breakpoints)), []);

  const profiles = Object.keys(breakpoints) as DeviceProfile[];

  return (
    <div className="bs-canvas-profile-bar" role="toolbar" aria-label="Canvas controls">
      {/* Zoom controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <button
          className="bs-canvas-profile-pill"
          title="Zoom out"
          onClick={() => setCanvasZoom(zoom / 1.25)}
        >
          {Icons.minus}
        </button>

        <span
          title="Reset zoom (Ctrl+0)"
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            padding: '0 6px',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
          onClick={() => setCanvasZoom(1)}
        >
          {Math.round(zoom * 100)}%
        </span>

        <button
          className="bs-canvas-profile-pill"
          title="Zoom in"
          onClick={() => setCanvasZoom(zoom * 1.25)}
        >
          {Icons.plus}
        </button>
      </div>

      <div className="bs-canvas-profile-bar__sep" />

      {/* Device profile switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {profiles.map((p) => {
          const meta = PROFILE_META[p];
          return (
            <button
              key={p}
              className={`bs-canvas-profile-pill ${profile === p ? 'bs-canvas-profile-pill--active' : ''}`}
              title={`${meta.label} — ${breakpoints[p].canvasWidth}px`}
              aria-label={`${meta.label} (${breakpoints[p].canvasWidth}px)`}
              aria-pressed={profile === p}
              onClick={() => setUIState({ profile: p })}
            >
              {meta.icon}
            </button>
          );
        })}
      </div>
    </div>
  );
}
