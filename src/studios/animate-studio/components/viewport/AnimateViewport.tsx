/**
 * AnimateViewport   " Animation Studio's center surface (Spec 07   5): with the
 * Timeline Panel as the hero below, the viewport above is the *monitor*.
 * Reuses the shared imperative Three.js viewport (IL-3   " no R3F) and adds the
 * monitor toolbar: preview quality, safe-area toggle, and shot-camera follow
 * (navigation 'track': the camera comes only from evaluated tracks).
 *
 * FR-155 camera-path *editing* stays in 3D Studio; the read-only path overlay
 * toggle is deferred pending a viewport overlay API (Plan 06 log).
 */
import { useState } from 'react';
import { Platform3DCanvas } from '../../../../app/ui/components/Platform3DCanvas';
import { setUIState, useUIState } from '@bs/engine';
import { IconButton } from '../common/Button';
import { Icons } from '../../../../app/ui/Icons';
import { SegmentedControl } from '../common/SegmentedControl';

const QUALITY_LEVELS = ['High', 'Medium', 'Low'] as const;

export function AnimateViewport() {
  const quality = useUIState((s) => s.qualityLevel);
  /* transient monitor options (FR-123) */
  const [safeArea, setSafeArea] = useState(false);
  const [followCam, setFollowCam] = useState(false);

  return (
    <div className="bs-monitor">
      <Platform3DCanvas navigation={followCam ? 'track' : 'editor'} />
      {safeArea && (
        <div className="bs-monitor__safe" aria-hidden="true">
          <div className="bs-monitor__safe-frame" />
        </div>
      )}
      <div className="bs-monitor__toolbar" role="toolbar" aria-label="Monitor options">
        <SegmentedControl
          aria-label="Preview quality"
          options={[
            { value: 'High', label: 'High' },
            { value: 'Medium', label: 'Med' },
            { value: 'Low', label: 'Low' },
          ]}
          value={quality}
          onChange={(val) => setUIState({ qualityLevel: val })}
        />
        <span className="bs-viewport__toolbar-sep" style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        <IconButton
          tooltip="Safe area guides"
          active={safeArea}
          onClick={() => setSafeArea((v) => !v)}
        >
          {Icons.frame}
        </IconButton>
        <IconButton
          tooltip="Preview through shot camera"
          active={followCam}
          onClick={() => setFollowCam((v) => !v)}
        >
          {Icons.video}
        </IconButton>
      </div>
    </div>
  );
}
