/**
 * MaterialLookDevViewport   " center zone of Material Studio (Spec 07   6).
 * "Full-height orbitable preview; lighting presets (studio/outdoor/night HDR),
 * background toggle, A/B compare slot."
 *
 * Reuses the shared imperative Three.js viewport (IL-3   " no R3F), same as the
 * Animation Studio monitor (R2). The look-dev controls are transient overlays
 * (FR-123); the preview renders live with the material edits from the right
 * channel stack. A dedicated shaderball runtime + HDR env swapping is a runtime
 * concern (03 PBRWorkflow) surfaced here as the control affordance.
 */
import { useState } from 'react';
import { getManifest } from '@bs/engine';
import { useUIState } from '@bs/engine';
import { Platform3DCanvas } from '../../../../app/ui/components/Platform3DCanvas';

const LIGHTING = ['Studio', 'Outdoor', 'Night'] as const;
const PREVIEW_MESH = ['Sphere', 'Shaderball', 'Cube', 'Scene'] as const;

export function MaterialLookDevViewport() {
  const selectedMaterialId = useUIState((s) => s.selectedMaterialId);
  const m = getManifest();
  const mat = selectedMaterialId ? m.materials[selectedMaterialId] : null;

  /* transient look-dev options (FR-123) */
  const [lighting, setLighting] = useState<(typeof LIGHTING)[number]>('Studio');
  const [mesh, setMesh] = useState<(typeof PREVIEW_MESH)[number]>('Sphere');
  const [showBg, setShowBg] = useState(true);
  const [compare, setCompare] = useState(false);

  return (
    <div className={`bs-lookdev bs-lookdev--${lighting.toLowerCase()} ${showBg ? '' : 'bs-lookdev--nobg'}`}>
      <Platform3DCanvas navigation="editor" />

      {/* A/B compare split guide   " a read-only reference line (before | after) */}
      {compare && (
        <div className="bs-lookdev__compare" aria-hidden="true">
          <span className="bs-lookdev__compare-tag bs-lookdev__compare-tag--a">Before</span>
          <span className="bs-lookdev__compare-tag bs-lookdev__compare-tag--b">After</span>
        </div>
      )}

      {/* Top-left: lighting + mesh picker */}
      <div className="bs-lookdev__toolbar bs-lookdev__toolbar--tl" role="toolbar" aria-label="Look-dev environment">
        <select
          className="uk-input"
          value={lighting}
          title="Lighting environment (HDR)"
          aria-label="Lighting environment"
          onChange={(e) => setLighting(e.target.value as (typeof LIGHTING)[number])}
        >
          {LIGHTING.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <select
          className="uk-input"
          value={mesh}
          title="Preview mesh"
          aria-label="Preview mesh"
          onChange={(e) => setMesh(e.target.value as (typeof PREVIEW_MESH)[number])}
        >
          {PREVIEW_MESH.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Top-right: background + A/B compare */}
      <div className="bs-lookdev__toolbar bs-lookdev__toolbar--tr" role="toolbar" aria-label="Look-dev display">
        <button
          className={`uk-filterchip ${showBg ? 'uk-filterchip--on' : ''}`}
          aria-pressed={showBg}
          title="Toggle HDR background"
          onClick={() => setShowBg((v) => !v)}
        >
          Background
        </button>
        <button
          className={`uk-filterchip ${compare ? 'uk-filterchip--on' : ''}`}
          aria-pressed={compare}
          title="A/B compare (before / after edit)"
          onClick={() => setCompare((v) => !v)}
        >
          A/B
        </button>
      </div>

      {/* Bottom: active material readout */}
      <div className="bs-lookdev__tag">
        <span className="bs-lookdev__dot" style={{ background: mat?.baseColor ?? 'var(--ink-3)' }} />
        <span>{mat ? mat.name : 'No material selected'}</span>
      </div>
    </div>
  );
}
