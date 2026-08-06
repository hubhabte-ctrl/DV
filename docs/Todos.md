# UI Copy Cleanup — Task List

**Version:** 1.0 · 2026-08-06
**Governing document:** [ui_terminology_standard.md](./ui_terminology_standard.md)
**Scope:** visible interface text only — wording, casing, terminology. No layout, behavior, or logic changes.

---

## Status

| # | Task | Status |
|---|---|---|
| 1 | Inventory visible UI text across all studios (section titles, labels, placeholders, tooltips, empty states) | ✅ Complete |
| 2 | Define a single terminology standard covering shared concepts across studios | ✅ Complete |
| 3 | Write terminology standard to `frontend/docs` | ✅ Complete |
| 4 | Apply copy cleanup to DOM Studio | ✅ Complete |
| 5 | Apply copy cleanup to shared `app/` layer (PanelSplitter, Icons, Toast, tokens, UIKit.css, global styles) | ✅ Complete |
| 6 | Align shared duplicated components across all 6 studios (Fields, SearchInput, command palettes, Dock search, TopBarModals, PublishModal) | ✅ Complete |
| 7 | Apply copy cleanup to 3D (Scene3D) Studio | ✅ Complete |
| 8 | Apply copy cleanup to Material Studio | ✅ Complete |
| 9 | Apply copy cleanup to Animation Studio | ✅ Complete |
| 10 | Apply copy cleanup to Asset + Preview Studio | ✅ Complete |
| 11 | Verify: typecheck, lint, and confirm no logic changed | ✅ Complete |

---

## 1–3. Standard

Inventory and standard authored. See [ui_terminology_standard.md](./ui_terminology_standard.md) for the
12-section governing document (core rules, canonical terms, abbreviations, placeholders, units, empty
states, tooltips, encoding corruption map, cross-studio consistency).

---

## 4. DOM Studio

**Files changed**

- `components/panels/DOMAssetPanel.tsx` — em dashes in 3 toasts; dropped `(soft-delete law)` and `(FR-183)` from tooltips
- `components/viewport/DOMViewport.tsx` — 3 toasts
- `components/viewport/DOMNodeView.tsx` — 4 visible strings (toasts, empty states, missing-asset messages)
- `components/common/Fields.tsx` — scrub-handle glyph
- `components/inspector/DOMScene3DInspector.tsx` — largest batch (section titles, field labels, units, helper text)
- `DOMRegistration.tsx` — `FOV` → `Field of View`; `unit="  "` → `unit="°"`
- `components/inspector/MaterialInspector.tsx` — `Texture Maps` → `Textures`, `Opacity & Alpha` → `Opacity`, `UV Transform` → `Texture Placement`
- `components/common/DOMContextMenu.tsx` — `·` and `›` glyphs
- `components/sidebar/DOMDock.tsx` — search placeholder ellipsis

**Section titles renamed**

`3D Transform` → `Transform` · `Snap Settings` → `Snapping` · `Shape` → `Size` ·
`Mesh & Geometry` → `Geometry` · `Camera Settings` → `Camera` · `Light Intensity` → `Light` ·
`Environment & IBL` → `Lighting` · `Model Transform (3D)` → `Transform` ·
`2D Canvas Bounds` → `Canvas Bounds` · `3D Asset Model` → `3D Model` ·
`Mesh Geometry & Shadows` → `Rendering`

**Field labels renamed**

`Pos X/Y/Z` → `Position X/Y/Z` · `Rot X/Y/Z` → `Rotation X/Y/Z` · `Size X/Y` → `Width`/`Height` ·
`Subdivisions` → `Segments` · `Corner` → `Corner Radius` · `Extrusion` → `Depth` ·
`Bevel Sides` → `Bevel Segments` · `FOV` → `Field of View` · `HDR Env` → `Environment Image` ·
`BG Color` → `Background Color` · `Env Power` → `Environment Intensity` · `GLB Asset` → `3D Model` ·
`Z-Index` → `Stacking Order` · `W`/`H` → `Width`/`Height`

---

## 5. Shared `app/` Layer

- `PanelSplitter.tsx` — both tooltips now read `Drag … to resize · double-click to collapse`
  (this was §10's cited bad example)
- CSS verified clean: all 30 `content:` declarations across every stylesheet are `content: '';`
  (empty decorative pseudo-elements — no text defects)

---

## 6. Shared Duplicated Components

Each studio carries its own verbatim copy of these files. A defect in one existed in all six.

| Component | Fix applied |
|---|---|
| `components/palette/*CommandPalette.tsx` (×6) | `placeholder="Type a command or node name…"` |
| `components/common/Fields.tsx` (×6) | scrub-handle glyph `↔` |
| `components/sidebar/*Dock.tsx` (×5) | search placeholder ellipsis `…` |
| `components/viewport/AssetWorkspace.tsx` | `"Search name or #tag..."` → `"Search name or #tag…"` |
| `components/modals/TopBarModals.tsx` (×6) | `·` in About subtitle and Active Manifest line |
| `components/modals/PublishModal.tsx` (×6) | `·` in summary, version header, history rows |

---

## 7. 3D (Scene3D) Studio

- `Scene3DRegistration.tsx` — `Environment  * IBL` → `Lighting`; `scene · environment` identity line;
  removed `(goal.md § 3)` from the environment hint; `HDR Env`/`BG Color`/`Env Power` labels expanded
- `components/inspector/Scene3DInspector.tsx` — full section-title and field-label pass matching DOM Studio;
  `unit="  "` → `unit="°"` at both FOV sites; `Material  * PBR` → `Material`; `Environment  * HDR` → `Environment`
- `components/panels/Scene3DAssetPanel.tsx` — import/replace tooltips; `·` in version/stats lines;
  removed `(FR-183)`
- `components/statusbar/Scene3DStatusBar.tsx` — `·` between DOM and 3D node counts

---

## 8. Material Studio

**Files changed**

- `components/panels/MaterialSceneTree.tsx` — 3 toasts with em dashes
- `components/modals/PublishModal.tsx` — toast with em dash
- `components/toolbar/MaterialTopBar.tsx` — cloud status tooltip
- `components/common/MaterialContextMenu.tsx` — Active Camera label
- `components/inspector/MaterialInspector.tsx` — section titles: `Texture Maps` → `Textures`, `Opacity & Alpha` → `Opacity`, `UV Transform` → `Texture Placement`, `Mesh Usage` separator; field labels: `Nrm Scale` → `Normal Scale`, `CC Rough` → `Clearcoat Roughness`, `Transmit` → `Transmission`, `Atten Dist` → `Attenuation Distance`

---

## 9. Animation Studio

**Files changed**

- `components/panels/AnimateTimelinePanel.tsx` — 8 toasts with em dashes; `TRACKS & CHANNELS` → `Tracks & Channels`; `No tracks yet` empty state
- `utils/animateKeyOps.ts` — 6 toasts with em dashes
- `components/panels/AnimateGraphEditor.tsx` — 1 toast with em dash
- `components/inspector/AnimateKeyframeInspector.tsx` — all section titles converted from ALL CAPS to Title Case: `TRACK` → `Track`, `TARGET` → `Target`, `CHANNEL` → `Channel`, `KEYFRAMES` → `Keyframes`, `KEYFRAME` → `Keyframe`, `NAME` → `Name`, `TIME (t)` → `Time`, `EASING` → `Easing`, `KEYFRAME SEQUENCE` → `Keyframe Sequence`, `EASING & CURVES` → `Easing`, `INTERPOLATION` → `Interpolation`, `SCROLL TRIGGERS` → `Scroll Triggers`, `START` → `Start`, `END` → `End`, `TARGET BINDING` → `Target Binding`, `NODE ID` → `Node ID`; keyframe identity separator; removed internal reference from hint text

---

## 10. Asset + Preview Studios

**Files changed (Asset Studio)**

- `components/panels/AssetLibraryPanel.tsx` — 4 toasts with em dashes; version tooltip separator; removed `(soft-delete law)` reference
- `components/panels/AssetIngestTray.tsx` — 1 toast with em dash
- `components/inspector/AssetInspector.tsx` — 1 toast with em dash
- `components/viewport/AssetWorkspace.tsx` — 4 toasts with em dashes; removed `(soft-delete law)` reference
- `components/toolbar/AssetTopBar.tsx` — cloud status tooltip

**Files changed (Preview Studio)**

- `components/dom-viewport/DOMViewport.tsx` — 3 toasts with em dashes
- `components/dom-viewport/DOMNodeView.tsx` — 4 visible strings with em dashes (toasts, empty states, missing-asset messages)
- `components/toolbar/PreviewTopBar.tsx` — cloud status tooltip

---

## 11. Verification — Passed

```bash
npm run typecheck   # tsc --noEmit → clean, 0 errors
npm run lint        # eslint . → clean; check-boundaries.mjs → all invariants clean
```

Both pass. No logic changed: every edit in this pass was a string literal or a JSX text node.

---

## 12. Screenshot Audit — ALL CAPS Is CSS, Not Copy

Four screenshots showed `MATERIAL LIBRARY`, `SCENE LIGHTS, CAMERAS & HDR`, `LIGHTING`,
`ENVIRONMENT IMAGE`, `BACKGROUND COLOR`, `ENVIRONMENT INTENSITY` rendering in ALL CAPS.

**Every one of those strings is already Title Case in the source.** The uppercasing is applied at
render time by `text-transform: uppercase` in the stylesheets. A `grep` for ALL CAPS string literals
across `studios/**/*.tsx` now returns only code comments — zero visible strings.

The uppercasing selectors (duplicated verbatim per studio):

| Selector | File | What it uppercases |
|---|---|---|
| `.grp-title` | `styles/Inspector.css:140` | inspector section titles |
| `.field label` | `styles/Inspector.css:658` | field labels |
| `.slider-row label` | `styles/Inspector.css:508` | slider labels |
| `.insp-obj-head .kind` | `styles/Inspector.css:105` | object-kind line |
| `.bs-insp-grp__head` | `styles/Inspector.css:272` | group headers |
| `.mslot-section` / `.mslot-title` / `.mslot-field-label` / `.mslot-preview-label` | `material-studio/styles/MaterialStudio.css:379, 476, 1044, 899` | material slot panel |
| `.rail-*` | `styles/LeftRail.css:740, 891, 1117` | left rail section labels |

Standard §3 requires Title Case, never ALL CAPS. Satisfying it visually means removing these
declarations — a **stylesheet change**, outside the "visible text only" scope of this pass.
Tracked as a separate task; needs a decision because `letter-spacing: var(--tracking-section)` is
tuned for uppercase and would need retuning.

**One genuine copy defect found and fixed:** `Atten. Color` → `Attenuation Color` in all three
`MaterialInspector.tsx` copies (dom, material, scene3d), line 613. It was the last abbreviation
still violating standard §5.

---

## Open Items

### Scrub-handle glyph is a reconstruction, not a recovery

The original character in `components/common/Fields.tsx` (~line 116) was destroyed by the encoding
corruption and could not be recovered — git history was unreachable and no uncorrupted copy exists in the
archives. `↔` (U+2194) was inferred from two signals:

- `UIKit.css:496-503` sets `cursor: ew-resize` on `.uk-numfield__scrub`
- the element's own tooltip reads `title="Drag to scrub"`

Confirm this matches the intended design before shipping.

### Code comments still carry corrupted punctuation

Out of scope for this pass per standard §2 and §11. The `  *` and `   "` sequences remain in file headers
and inline comments across ~35 files. Tracked as a separate cleanup.

### Parser strings deliberately left untouched

These are parsed, not displayed. Changing them would alter behavior:

- `Scene3DInspector.tsx:251` — `name.indexOf('  * ')` parses corrupted GLB material names
- Inspector search-filter keys — `matches('fov')`, `matches('visible')`, `matches('cast shadow')`.
  Verified safe: `matches` takes hardcoded lowercase keys, not the display labels, so renaming labels
  does not affect filtering.

---

**End of Task List · Version 1.0**
