# DOM Studio UI/UX Audit Report

**Audit Date:** 2026-08-06  
**Scope:** `frontend/src/studios/dom-studio/**` (46 files, 13,783 lines)  
**Objective:** Identify UI/UX inconsistencies, legacy patterns, accessibility gaps, dead code, and architecture issues preventing the DOM Studio from meeting enterprise SaaS standards.

---

## Executive Summary

The DOM Studio is **functionally complete** but presents as a collection of disjointed panels rather than a unified professional application. Key findings:

- **23% of CSS selectors are dead code** (66 of 292 class selectors unreferenced)
- **Zero responsive behavior** (no `@media` queries in 3,023 lines of studio CSS)
- **~420 hardcoded values** (41 raw `oklch()`, ~361 raw `px`, 13 `rgba()`, 59 inline `style={{}}`)
- **Multiple WCAG violations** (missing focus traps, no keyboard navigation in Tree/ContextMenu, inaccessible interactive elements)
- **Two confirmed defects** (undefined CSS token causing invisible color picker, blocking `window.prompt()` in Box Model editor)
- **Architectural debt** (495-line component branch, duplicate clipboards, cross-studio coupling, command-engine bypass)

This report provides measured evidence for each finding and corrects inaccuracies in the prior audit document.

---

## 1. Scale & Structure

### 1.1 File Inventory
```
DOMStudio.css         861 lines
LeftRail.css        1,353 lines
Inspector.css         715 lines
CanvasChrome.css       94 lines
─────────────────────────────
Total CSS           3,023 lines

DOMStudioRoot.tsx     132 lines (shell)
DOMSidebar.tsx        495 lines (four-way branch)
DOMInspector.tsx    1,310 lines (monolithic inspector)
DOMTopBar.tsx         546 lines (toolbar + menus)
+ 42 additional component files
─────────────────────────────
Total DOM Studio   13,783 lines
```

### 1.2 Design Token Compliance
**SSOT location:** `frontend/src/app/ui/tokens/tokens.css` (695 lines)

**Token drift in DOM Studio CSS:**
- 41 raw `oklch()` literals (DOMStudio.css: 26, CanvasChrome.css: 10, Inspector.css: 4, LeftRail.css: 1)
- ~361 raw `px` values (DOMStudio: 150, LeftRail: 102, Inspector: 86, CanvasChrome: 23)
- 13 raw `rgba()` declarations
- 0 hex color literals (✓ good)
- 59 inline `style={{}}` blocks across 19 TSX files

**Studio identity bypasses SSOT palette:**
```css
/* DOMStudio.css uses indigo (hue 258) vs SSOT petrol/teal */
[data-studio='dom'] {
  --studio-accent:      oklch(0.55 0.16 258);
  --studio-accent-soft: oklch(0.55 0.16 258 / 0.12);
  --studio-accent-hi:   oklch(0.72 0.14 258);
  --studio-accent-lo:   oklch(0.78 0.10 258);
}
```

---

## 2. Dead Code Analysis

### 2.1 Unreferenced CSS Classes
**66 of 292 CSS class selectors (23%) are never used** in `src/`.

**Complete dead-code inventory:**

#### DOMStudio.css (26 dead selectors)
```
.bs-selection-frame, .bs-selection-frame__handle, .bs-selection-frame--locked,
.bs-selection-frame__lockbadge, .bs-selection-frame__handle--nw/ne/sw/se/n/s/e/w
.bs-profile-bar, .bs-profile-bar__left, .bs-profile-bar__center, .bs-profile-bar__right
.bs-wp-card, .bs-wp-card__head, .bs-wp-card__body, .bs-wp-card__foot
.bs-guide--center, .bs-guide--third
.bs-dom-canvas, .bs-dom-canvas--grid, .bs-dom-label, .bs-dom-hover
.icon-group
```

**Correction to prior audit:** The previous `docs/audit_report.md` recommended fixing `.bs-selection-frame` handles—these classes are entirely unreferenced. The **live** selection frame uses `.bs-selframe*` (note spelling difference). Similarly, `.bs-profile-bar` is dead; the live component uses `.bs-canvas-profile-bar`.

#### Inspector.css (~30 dead selectors — an entire legacy generation)
```
.bs-insp, .bs-insp-head, .bs-insp-body, .bs-insp-sec, .bs-insp-sec__head,
.bs-insp-sec__body, .bs-insp-row, .bs-insp-lbl, .bs-insp-tabs, .bs-insp-tab,
.bs-val, .bs-val--num, .bs-val--text, .bs-swatch, .bs-swatch__chip,
.bs-field, .bs-field__label, .bs-field__control, .uk-fieldrow__content, ...
```
These hardcode literals (`12.5px`, `9.5px`, `11.5px`, `oklch(18% 0.03 210)`, `oklch(63% 0.15 44)`) that predate the SSOT layer.

**Notable consequence:** Inspector.css contains a ~30-line commented explanation of a `.uk-fieldrow__content .uk-seg` scoping mechanism. Because `uk-fieldrow__content` is **never rendered**, that entire override is inert.

### 2.2 Duplicate Files
- `src/studios/dom-studio/utils/domCanvasHelpers.ts` (237 lines) **and** `src/engine/domCanvasHelpers.ts` — two same-named modules in different layers. `DOMViewportControls.tsx` imports from the *engine* copy while the studio copy also exists.

### 2.3 Misplaced Code
~2,000 lines of **material and 3D inspectors physically live inside `dom-studio/`**, violating the per-studio isolation model:
- `MaterialInspector.tsx` (~426+ lines referenced in Inspector.css)
- `DOMScene3DInspector.tsx` (~398+ lines referenced in Inspector.css)

### 2.4 Cross-Studio Coupling
```tsx
// DOMViewportControls.tsx:9 — DOM Studio imports from Scene3D Studio
import { Scene3DViewport } from '../../../scene3d-studio/components/viewport/Scene3DViewport';

// preview-studio/components/dom-viewport/DOMViewport.tsx:58 — reverse dependency
} from '../../../dom-studio/components/viewport';
```
A bidirectional dependency exists between DOM ↔ Scene3D ↔ Preview studios at the UI layer.

---

## 3. Confirmed Defects

### 3.1 Invisible Color Picker (`var(--surface-1)` undefined)
**File:** `components/common/Fields.tsx:304`

```tsx
<div style={{
  position: 'absolute', top: 26, left: 0, zIndex: 100,
  background: 'var(--surface-1)',   // ← TOKEN DOES NOT EXIST ANYWHERE IN REPO
  padding: 12, borderRadius: 8,
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  border: '1px solid var(--border)', ... }}>
```

**Verification:** `tokens.css` defines bridge aliases `--surface`, `--surface-2`, `--surface-3` — but **no `--surface-1`**. Repo-wide grep confirms zero definitions. The color-picker popover therefore renders with a transparent background over the canvas.

**Severity:** High — visible visual defect on a primary interaction.

### 3.2 Blocking `window.prompt()` in Box Model Editor
**File:** `components/inspector/DOMInspector.tsx:92`

```tsx
const handleEdit = (key: string, current: number) => {
  const val = window.prompt(`Enter ${key}`, String(current));
  if (val !== null && !isNaN(Number(val))) sv(node.id, profile, key, Number(val));
};
...
<span className="bm-num t" onClick={() => handleEdit('marginTop', numVal('marginTop'))}>
  {numVal('marginTop')}
</span>
```

This is the **only** affordance for editing margin/padding via the box model diagram, and the **only** `window.prompt|alert|confirm` in the entire DOM Studio. It blocks the main thread, cannot be styled, is not keyboard-navigable in a consistent way, and breaks the design language entirely.

**Severity:** High — blocking native dialog in a professional design tool.

### 3.3 Command Engine Bypass (IL-1 violation)
**File:** `components/toolbar/DOMTopBar.tsx` — "Group in Container"

```tsx
parent.children[idx] = container.id;
manifest.domNodes[container.id] = container;
```

Direct manifest mutation bypasses `dispatch`/`dispatchBatch`. **The operation is not undoable** and will desynchronize the undo stack. Every other mutation in the studio correctly routes through the command engine.

**Severity:** High — data-integrity risk.

### 3.4 Dual, Non-Shared Clipboards
```tsx
// components/common/DOMContextMenu.tsx — module scope
let domClipboard: DomNode | null = null;

// components/toolbar/DOMTopBar.tsx — React state
const [clipboardNode, setClipboardNode] = useState<DomNode | null>(null);
```
Copying from the top bar and pasting from the context menu (or vice versa) silently fails. Two independent buffers for one user-facing concept.

**Severity:** Medium — silent functional failure.

### 3.5 Unreachable Inspector Search
`DOMInspectorPanel.tsx` reads the shared store field:
```tsx
const query = useUIState((s) => s.inspectorSearch);   // read...
```
…but **no search input is ever rendered** in the DOM Studio inspector. `inspectorSearch` is a global field (`packages/engine/src/store.ts:44`, default `''` at `:90`) consumed identically by all five studio inspector panels (animate / dom / scene3d / material / asset, each ~line 18). The DOM property filter is therefore permanently inert, and the field is not namespaced per studio.

### 3.6 Dead & Unreachable UI
| Item | Location | Issue |
|---|---|---|
| `assets` dock tab | `DOMDock.tsx` | Defined in `TAB_LABELS` but omitted from `DOCK_TABS` → never rendered |
| "Add layer" button | `DOMDock.tsx` | `onClick={() => {}}` — no-op |
| Menu shortcuts | `DOMTopBar.tsx` | Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+G, Ctrl+L, Ctrl+0, Shift+1, F11 displayed but **not bound** |

Only **5 shortcuts are actually bound** in `DOMStudioRoot.tsx`: Ctrl+Z, Ctrl+Shift+Z, Ctrl+K, Ctrl+D, Delete/Backspace.

### 3.7 Hardcoded Placeholder Data in Production UI
```tsx
// DOMTopBar.tsx — fake collaborators
<span className="bs-ava bs-ava--a" title="MK">MK</span>
<span className="bs-ava bs-ava--b" title="DV">DV</span>

// DOMSidebar.tsx — fake page + fake counts
<span className="bs-node__lab">Home · Fleet Story</span>
<span className="lbl">Saved Components</span><span className="lbl-count">3</span>
<span className="lbl">Consortium Library</span><span className="lbl-count">12</span>
```

---

## 4. Responsive & Adaptive Behavior

### 4.1 Zero Responsive Support
**Measured: 0 `@media` queries across all 3,023 lines of DOM Studio CSS.**

The shell is a fixed CSS grid with hardcoded panel widths. There is no adaptive panel collapse, no breakpoint-driven layout change, and no minimum-viewport handling. Below ~1280px the inspector, canvas, and dock overlap or clip.

### 4.2 Fixed Layout Dimensions
Layout tokens exist in `tokens.css`:
```css
--topbar-h: 60px;  --rail-w: 64px;  --layers-w: 276px;
--insp-w: 340px;   --dock-h: 46px;  --dock-h-tall: 340px;  --statusbar-h: 24px;
```
…but the studio also hardcodes conflicting values:
```tsx
// DOMStudioRoot.tsx — inline override
style={{ '--bs-size-timelineH': '88px' }}

// DOMTopBar.tsx — "Reset Workspace Layout"
setUIState({ leftRailW: 340, inspectorW: 340, timelineH: 160 });
```
The reset values (340/340/160) do not match the token defaults (276/340/88). Resetting the workspace produces a layout the user never started with.

---

## 5. Accessibility Audit (WCAG 2.1 AA)

### 5.1 Focus Management
**Measured: only 4 `:focus-visible` declarations across 292 CSS selectors.** Most interactive elements have no visible focus indicator — **WCAG 2.4.7 (Focus Visible) failure**.

### 5.2 Dialog & Overlay Failures
| Component | `role` | `aria-modal` | Escape | Focus trap | Initial focus | Focus restore |
|---|---|---|---|---|---|---|
| `DOMCommandPalette` | dialog | ✗ | ✓ | ✗ | `setTimeout(…, 0)` | ✗ |
| `PublishModal` | dialog | ✓ | ✗ | ✗ | ✗ | ✗ |
| `TopBarModals` | — | — | — | ✗ | `autoFocus` (:381) | ✗ |
| `DOMContextMenu` | menu | — | ✓ | ✗ | ✗ | ✗ |

**Violations:** WCAG 2.1.2 (No Keyboard Trap — inverse: focus escapes modals), 2.4.3 (Focus Order). Keyboard and screen-reader users can tab out of every modal into the obscured page behind it, and focus is never returned to the trigger on close.

### 5.3 Keyboard Navigation Gaps

**`Tree.tsx` (347 lines) — layer hierarchy**
```tsx
role="tree" / role="treeitem" / aria-selected / aria-expanded   ✓ present
tabIndex                                                        ✗ missing
Arrow Up/Down/Left/Right, Home, End                             ✗ missing
aria-level                                                      ✗ missing
```
The layer tree is **entirely unreachable by keyboard** — WCAG 2.1.1 (Keyboard) failure on the studio's primary navigation surface.

**`DOMContextMenu.tsx` (488 lines)**
```tsx
role="menu"           ✓
role="separator" × 6  ✓
role="menuitem"       ✗ missing on every item
Arrow-key navigation  ✗ missing
Submenus              hover-only (no keyboard path)
```

### 5.4 Non-Interactive Elements with Click Handlers
These are not focusable, not keyboard-operable, and expose no role — WCAG 2.1.1 / 4.1.2 failures:

| Element | File | Purpose |
|---|---|---|
| `<span onClick>` chevron | `Tree.tsx` | Expand/collapse node |
| `<span className="bm-num" onClick>` | `DOMInspector.tsx` | Edit margin/padding |
| `<div onClick>` swatch trigger | `Fields.tsx:277` | Open color picker |
| `<span onClick>` zoom readout | `DOMProfileBar.tsx` | Reset zoom |
| `<span className="tb-cloud-dot" onClick>` | `DOMTopBar.tsx` | Sync status action |
| `<span className="uk-numfield__scrub">` | `Fields.tsx` | Drag-scrub value |
| `<span className="bs-selframe__handle">` | `DOMSelectionFrame.tsx` | Resize (8 handles) |
| Draggable `<div>` rows | `DOMSidebar.tsx` | `comp-item`, `comp-list-row`, `bs-comp-item` |

### 5.5 Labeling & Semantics
- **Position/Size inputs** (`DOMInspector.tsx`): `<label>` elements are not associated with inputs via `htmlFor`/`id` — WCAG 1.3.1 / 3.3.2.
- **Override dot** (`Fields.tsx` `FieldRow`): a `<button>` with only a `title` attribute — no accessible name — WCAG 4.1.2.
- **Align toolbar** (`DOMViewportControls.tsx`): buttons carry `title` only, no `aria-label`.
- **`DOMDock.tsx`**: `aria-label="Layers"` is hardcoded on the `<aside>` regardless of the active tab, so the region is mislabeled for 3 of 4 tabs.
- **`DOMStatusBar.tsx`**: `role="status"` on the entire `<footer>` — all 8 items are re-announced whenever any single value changes. Should scope the live region to the specific changing item.

### 5.6 Inconsistent Tab Semantics
```tsx
// DOMDock.tsx — CORRECT
role="tablist" / role="tab" / aria-selected / aria-controls / role="tabpanel"   ✓

// DOMInspectorPanel.tsx — MISSING ALL OF THE ABOVE
<div className="insp-tabs">
  {TABS.map(t => <button className={subTab===t.key?'active':''} data-tab={t.key} …>)}
```
Two tab implementations in the same studio with opposite accessibility quality.

### 5.7 What Is Done Well
- `ScrollRail` (`DOMViewportControls.tsx`): full `role="slider"` + `aria-valuenow` + Arrow/Home/End keys — this is the correct pattern and should be the template.
- Device profile pills (`DOMProfileBar.tsx`): correct `aria-pressed`.
- `DOMContextMenu`: viewport clamping (12px margins), Escape, outside-pointerdown close.
- `DOMSelectionFrame`: correct undo grouping via `dispatchBatch(cmds, \`resize:${selId}\`)`.

---

## 6. Architecture & Component Design

### 6.1 Shell (`DOMStudioRoot.tsx`, 132 lines)
Imports **6 separate stylesheets** (ShellLayout, LeftRail, Inspector, CanvasChrome, UIKit, DOMStudio) and hard-mounts every region: TopBar, Dock, workspace (ProfileBar + Viewport + 2 PanelSplitters), InspectorPanel, timeline grid area, StatusBar, CommandPalette, ConflictModal.

**Issues:**
- No slot-based composition — regions cannot be swapped, hidden, or reordered per workspace mode.
- Timeline grid area is allocated unconditionally via an inline `--bs-size-timelineH: '88px'`, consuming canvas height whether or not `DOMFlowStrip` has content.
- A single global `keydown` effect handles all shortcuts, with an incomplete input guard:
  ```tsx
  const inField = ['INPUT','SELECT','TEXTAREA'].includes((e.target as HTMLElement).tagName);
  ```
  **`contentEditable` is not guarded** — typing `d` or Delete inside a rich-text node triggers duplicate/delete of the node itself.

### 6.2 Left Rail: Conflated Responsibilities
`DOMDock.tsx` (92 lines) renders **both** the global Activity Rail *and* the studio Dock panel — two distinct concerns at different levels of the information architecture. The global rail should be owned by the app shell, not the studio.

`DOMSidebar.tsx` (495 lines) is a **single component branching on `tab` into four unrelated UIs** (pages / layers / components / templates). Each branch has different data shapes, different interaction models, and different (or absent) empty states. This is the primary maintainability hazard in the studio.

**Additional issues:**
- Tab state is `useState` local — **not persisted**, resets on every remount.
- `flattenDom()` injects a synthetic `'__stage__'` row and appends unplaced waypoints at depth 0, mixing three conceptually different node kinds into one flat list without visual distinction.
- Dynamic imports inside event handlers: `import('../../../../engine/progress').then(p => p.setProgress(…))` — a module-load round-trip on every interaction.

### 6.3 Inspector: Monolith + Chrome Split
`DOMInspector.tsx` is **1,310 lines** in a single file. Structural problems:
- `ShadowSection` mirrors manifest state into local `useState` — **state drift** when the manifest changes externally (undo, collaboration, breakpoint switch).
- 6 inline `style={{}}` blocks with raw literals.
- Section titles inconsistently cased: `"POSITION"` vs `"Box Model"` vs `"Shadows · N"` — three different conventions in one panel.
- No collapsible sections; the entire property set is always rendered.

`Fields.tsx` (355 lines) mixes **two class generations in the same file**: SSOT (`.field-row`, `.field`, `.f-input`, `.f-select`) and UI-Kit (`.uk-numfield*`, `.uk-sliderfield*`, `.uk-field-wrapper`, `.uk-colorfield`, `.uk-vec3`, `.uk-input`, `.uk-overridedot`).

### 6.4 Cross-Component Coupling via Custom Events
```tsx
// DOMTopBar.tsx — untyped global event bus with a HARDCODED profile
window.dispatchEvent(new CustomEvent('bs:dom:align', {
  detail: { op: 'left', profile: 'desktop' }   // ← ignores the active DeviceProfile
}));
```
Alignment always writes to the desktop breakpoint regardless of which profile the user is editing.

### 6.5 Command Palette Limitations (`DOMCommandPalette.tsx`, 186 lines)
- Silent `.slice(0, 12)` truncation — no "N more results" indicator.
- No result grouping or categorization.
- Items are `<div onClick/onMouseEnter>` — no `role="option"`, no `aria-activedescendant`.
- Backdrop `<div>` has no `role="presentation"`.

### 6.6 Hardcoded Geometry in TypeScript
`DOMSelectionFrame.tsx` encodes handle geometry in TS rather than tokens:
```tsx
const HANDLE_POS: Record<HandleDir, CSSProperties> = {
  nw: { top: -4, left: -4, cursor: 'nwse-resize' },
  n:  { top: -4, left: '50%', marginLeft: -4, cursor: 'ns-resize' }, … };
```
Minimum resize size is hardcoded `Math.max(24, …)`. `StageLayer` hardcodes `transition: 'opacity 240ms ease'` instead of `var(--duration-*)`.

### 6.7 Z-Index Fragmentation
```css
/* tokens.css SSOT scale */
--z-sticky: 20;  --z-dropdown: 40;  --z-modal: 50;  --z-toast: 60;  --z-tooltip: 70;

/* DOMStudio.css — escapes the scale entirely */
.bs-contextmenu { z-index: 10000; }

/* Fields.tsx — inline, unrelated to the scale */
zIndex: 100
```

---

## 7. Visual Language & Information Hierarchy

### 7.1 Redundant Chrome
`DOMProfileBar` sits between the Top Bar and the canvas, consuming vertical space for zoom / grid / snap / guides. Combined with the 60px top bar, 88px timeline, and 24px status bar, **~172px of vertical space is chrome** before the canvas begins.

### 7.2 Inconsistent Typography Scale
Dead legacy CSS hardcodes `12.5px`, `9.5px`, `11.5px` — half-pixel sizes that render inconsistently. Live code mixes token-based sizing with inline `fontSize: 11`.

### 7.3 Missing States
| State | Coverage |
|---|---|
| Empty (Tree) | Bare `"No matches"` text row — no icon, no guidance, no CTA |
| Empty (other panels) | Absent |
| Loading | Absent throughout |
| Error | Absent throughout |
| Selection (multi) | Partial — store supports `selectedDomNodeIds` but inspector handles single selection |

### 7.4 Duplicated Label Maps
`DOMStatusBar.tsx`'s `MODE_LABEL` duplicates `DOMTopBar.tsx`'s `MODE_TO_STUDIO` — same concept, two definitions, independent drift risk.

---

## 8. Governance Compliance

Repo rules (`CLAUDE.md` §2.1 / §5.1) state: *"a bare `.uk-*` rule may only be declared in `packages/ui-kit/`; app CSS must scope with an ancestor."*

**Status:** DOM Studio consumes `.uk-*` classes extensively from `Fields.tsx`, `DOMCommandPalette.tsx`, and `PublishModal.tsx`. The `.uk-palette__backdrop` class is reused by `PublishModal` as a generic modal scrim — a UI-Kit class repurposed for an unrelated concern. Regression check available: `node scripts/audit-selector-collisions.mjs`.

---

## 9. Prioritized Findings

### P0 — Defects (fix immediately)
1. `var(--surface-1)` undefined → invisible color picker (`Fields.tsx:304`)
2. `window.prompt()` box-model editor (`DOMInspector.tsx:92`)
3. "Group in Container" bypasses command engine, breaks undo (`DOMTopBar.tsx`)
4. `contentEditable` not guarded in global shortcut handler (`DOMStudioRoot.tsx`)

### P1 — Accessibility (WCAG AA blockers)
5. Tree has no keyboard navigation (WCAG 2.1.1)
6. No focus traps / focus restoration in any modal (WCAG 2.4.3)
7. Only 4 `:focus-visible` rules (WCAG 2.4.7)
8. Context menu missing `role="menuitem"` + arrow keys (WCAG 4.1.2)
9. 8 categories of non-interactive elements with click handlers
10. Unassociated labels in Position/Size inputs (WCAG 1.3.1)

### P2 — Architecture
11. `DOMSidebar` four-way branch (495 lines)
12. `DOMInspector` monolith (1,310 lines), no collapsible sections
13. `DOMDock` conflates Activity Rail + Dock
14. Dual clipboards
15. Cross-studio bidirectional coupling
16. Duplicate `domCanvasHelpers`
17. Material/3D inspectors misplaced in dom-studio (~2,000 lines)

### P3 — Design System
18. Zero `@media` queries — no responsive behavior
19. 41 raw `oklch()`, ~361 raw `px`, 13 `rgba()`, 59 inline styles
20. Studio accent bypasses SSOT palette (indigo 258 vs petrol/teal)
21. Z-index fragmentation (`10000`, `100` vs the 20–70 scale)
22. 66 dead CSS selectors (23%)
23. Workspace reset values contradict token defaults

### P4 — Functional Polish
24. Unreachable `inspectorSearch` filter (no input rendered; field not namespaced)
25. Unreachable `assets` tab; no-op "Add layer"
26. 8 advertised-but-unbound shortcuts
27. Hardcoded placeholder data (MK/DV avatars, "Home · Fleet Story", counts 3/12)
28. Panel tab state not persisted
29. Command palette silent 12-result truncation
30. Missing loading / error / empty states

---

## 10. Open Question for Stakeholder Decision

> [!IMPORTANT]
> **`DOMFlowStrip` and the 88px timeline grid area.** The DOM Studio unconditionally allocates a timeline track (`--bs-size-timelineH: '88px'`) for `DOMFlowStrip`. Unlike Animate Studio, DOM design work is not inherently timeline-driven. Three options:
> 1. **Remove** — reclaim 88px of canvas height (largest UX win)
> 2. **Repurpose** — convert to an asset/component bin tray (fills the unreachable `assets` tab gap)
> 3. **Keep, make collapsible** — retain scroll-waypoint editing, default collapsed
>
> The implementation plan assumes **option 3** (collapsible, default collapsed) as the reversible default. Confirm before Phase 2 if a different option is preferred.

---

## Conclusion

The DOM Studio's engine integration and mutation model are sound — the command engine, responsive override system, and imperative frame path are all correctly implemented and must be preserved. The problems are concentrated in the **presentation layer**: two generations of CSS coexisting with 23% dead code, no responsive support, systemic accessibility gaps, and two components (`DOMSidebar`, `DOMInspector`) that have grown past maintainable size.

The redesign should proceed as: **defect fixes → token consolidation → shell recomposition → panel decomposition → accessibility hardening → responsive layer**, with `npm run typecheck` and `npm run lint` gating each phase. See `implementation_plan.md`.

