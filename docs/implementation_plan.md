# DOM Studio Complete Redesign — Implementation Plan

**Plan Date:** 2026-08-06  
**Prerequisite:** `audit_report.md` (same directory)  
**Scope:** `frontend/src/studios/dom-studio/**` + supporting token/UI-kit changes

---

## Guiding Constraints

These are non-negotiable and apply to every phase:

1. **Preserve all functionality and business logic.** No behavioral change to node mutation, undo/redo, responsive overrides, publishing, or the scroll clock.
2. **Presentation layer only**, except where structural refactoring is required to support the new UI architecture (explicitly called out per phase).
3. **All mutations route through the command engine** (`dispatch` / `dispatchBatch` / `setStyleValue`). IL-1 is restored, never further violated.
4. **No hardcoded values.** Every color, size, space, radius, duration, and z-index resolves to a token in `src/app/ui/tokens/tokens.css`.
5. **Single source of truth per concern.** One tab component, one field primitive set, one clipboard, one label map.
6. **Behavior-identical moves (IL-11).** File relocations must not alter rendered output.
7. **Gate every phase** on `npm run typecheck`, `npm run lint`, and `node scripts/audit-selector-collisions.mjs`.

---

## Phase Overview

| Phase | Title | Risk | Blocking |
|---|---|---|---|
| 0 | Defect Remediation | Low | — |
| 1 | Token Consolidation & Dead Code Removal | Low | 0 |
| 2 | Component Primitive Layer | Medium | 1 |
| 3 | Shell & Workspace Architecture | High | 2 |
| 4 | Navigation: Rail, Dock & Hierarchy | High | 3 |
| 5 | Inspector Architecture | High | 2 |
| 6 | Canvas Chrome & Overlays | Medium | 3 |
| 7 | Overlays: Menus, Dialogs, Palette | Medium | 2 |
| 8 | Accessibility Hardening | Medium | 4,5,6,7 |
| 9 | Responsive & Adaptive Layout | Medium | 3,4,5 |
| 10 | States, Polish & Documentation | Low | all |

Phases 4/5 and 6/7 are independently parallelizable once their prerequisites land.

---

## Phase 0 — Defect Remediation

**Goal:** Fix the four P0 defects before any refactoring, so regressions are attributable.

### 0.1 Undefined token → invisible color picker
- `Fields.tsx:304`: replace `background: 'var(--surface-1)'` with `var(--bg-2)` (SSOT) via a new `.uk-colorfield__popover` class; remove the entire inline style block.
- Add `--surface-1` to the bridge alias block in `tokens.css` mapping to `--bg-2`, so any other consumer that appears later resolves correctly. *(Belt and braces — the class fix is the real one.)*

### 0.2 Blocking `window.prompt()` in Box Model
- `DOMInspector.tsx:92`: delete `handleEdit`. Replace each `<span className="bm-num" onClick>` with an inline-editable `NumberField` in `compact` mode, committing through `setStyleValue` (already imported as `sv`).
- The box-model diagram becomes 8 focusable, scrubbable, keyboard-editable fields.

### 0.3 Command engine bypass in "Group in Container"
- `DOMTopBar.tsx`: replace direct `manifest.domNodes[...] = ...` mutation with `dispatchBatch([createNode, reparentChildren…], 'group-in-container')` so the whole operation is one undo step.
- Add a regression test asserting undo restores the pre-group hierarchy.

### 0.4 `contentEditable` shortcut guard
- `DOMStudioRoot.tsx`: extend the input guard:
  ```ts
  const el = e.target as HTMLElement;
  const inField =
    ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable;
  ```

### 0.5 Dual clipboard unification
- Delete module-scope `let domClipboard` from `DOMContextMenu.tsx`.
- Add `domClipboard: DomNode | null` to the shared UI state store (`packages/engine/src/store.ts`), consumed by both the top bar and context menu.

**Exit criteria:** Color picker visible; box model editable without native dialogs; group-in-container undoable; typing in rich text does not trigger shortcuts; copy/paste works across top bar and context menu.

---

## Phase 1 — Token Consolidation & Dead Code Removal

**Goal:** One CSS generation, zero raw literals, zero dead selectors.

### 1.1 Delete dead CSS (66 selectors, 23%)
Remove in this order, running `audit-selector-collisions.mjs` after each file:

**`DOMStudio.css`** — delete `.bs-selection-frame` + its 8 handle variants + `--locked` + `__lockbadge`; the complete `.bs-profile-bar` block; `.bs-wp-card*` (4); `.bs-guide--center`, `.bs-guide--third`; `.bs-dom-canvas`, `.bs-dom-canvas--grid`, `.bs-dom-label`, `.bs-dom-hover`; `.icon-group`.

**`Inspector.css`** — delete the entire legacy generation: `.bs-insp*`, `.bs-val*`, `.bs-swatch*`, `.bs-field*`, and the inert `.uk-fieldrow__content .uk-seg` block **including its ~30-line comment** (it documents a mechanism that never ran).

> The live equivalents are `.bs-selframe*` and `.bs-canvas-profile-bar` — do not touch those.

Also remove the stale ownership comment in `DOMStudio.css` claiming `DOMFlowStrip.tsx` has not yet moved into `studios/dom-studio/**`; it has.

### 1.2 Studio accent → SSOT palette
Replace the raw `oklch` identity block with references to the central palette:
```css
[data-studio='dom'] {
  --studio-accent:      var(--color-accent-dom);
  --studio-accent-soft: var(--color-accent-dom-soft);
  --studio-accent-hi:   var(--color-accent-dom-hi);
  --studio-accent-lo:   var(--color-accent-dom-lo);
}
```
Define `--color-accent-dom*` in `tokens.css` within the SSOT hue family, verifying **4.5:1 contrast against `--bg-0` through `--bg-3` in both themes**. If indigo is a deliberate brand decision, keep the hue but move the definition into `tokens.css` and add the contrast-checked variants there — the requirement is centralization, not a specific hue.

### 1.3 Eliminate raw literals
- 41 `oklch()` → semantic tokens (`--color-*`, `--bg-*`, `--line-*`, `--ink-*`).
- ~361 raw `px` → `--space-*`, `--radius-*`, or layout dimension tokens. Sub-pixel legacy values (`12.5px`, `9.5px`, `11.5px`) are deleted with their dead rules in 1.1.
- 13 `rgba()` → `oklch(... / α)` via token references.
- Hardcoded `240ms` in `StageLayer` → `var(--duration-normal)`.

### 1.4 Z-index normalization
- `.bs-contextmenu { z-index: 10000 }` → `var(--z-dropdown)`.
- `Fields.tsx` inline `zIndex: 100` → `var(--z-dropdown)` via class.
- Audit all overlays against the 20–70 scale; add `--z-canvas-overlay: 30` if a tier is genuinely missing rather than escaping the scale.

### 1.5 Reconcile layout dimension conflicts
- `DOMTopBar.tsx` "Reset Workspace Layout" must read token defaults, not literals:
  ```ts
  setUIState({ leftRailW: LAYOUT_DEFAULTS.leftRailW, inspectorW: LAYOUT_DEFAULTS.inspectorW, timelineH: LAYOUT_DEFAULTS.timelineH });
  ```
  Export `LAYOUT_DEFAULTS` from a single module derived from the token values (276 / 340 / 88), replacing the current 340/340/160.
- Remove the inline `--bs-size-timelineH: '88px'` from `DOMStudioRoot.tsx`; the token owns it.

**Exit criteria:** `grep -c 'oklch(' ` on studio CSS returns 0 outside token definitions; zero unreferenced selectors; collision audit clean; visual diff shows no unintended change.

---

## Phase 2 — Component Primitive Layer

**Goal:** Build the reusable, accessible primitives every later phase consumes. This is the single-source-of-truth foundation.

### 2.1 Consolidate field primitives
`Fields.tsx` currently mixes SSOT (`.field-row`, `.f-input`) and UI-Kit (`.uk-numfield*`) classes. Pick **one** convention — UI-Kit, since the primitives belong in `packages/ui-kit/` per governance §2.1 — and:
- Move `NumberField`, `NumberSliderField`, `TextField`, `SelectField`, `ColorField`, `Vector3Field`, `FieldRow` into `packages/ui-kit/`.
- Delete all inline `style={{}}` from these components; every visual property becomes a class.
- Re-export from `dom-studio/components/common/Fields.tsx` so existing imports keep working (IL-11: behavior-identical).

### 2.2 New primitives required by later phases
| Component | Purpose | Consumed by |
|---|---|---|
| `CollapsibleSection` | Accordion with persisted open state, `aria-expanded`, `aria-controls` | Phase 5 |
| `Tabs` | One accessible tab implementation (`tablist`/`tab`/`tabpanel`) | Phases 4, 5 |
| `Modal` | Scrim + focus trap + Escape + initial focus + focus restore | Phase 7 |
| `Menu` / `MenuItem` | `role="menu"`/`menuitem"`, arrow keys, typeahead, keyboard submenus | Phase 7 |
| `EmptyState` | Icon + heading + description + optional CTA | Phase 10 |
| `Skeleton` | Loading placeholder | Phase 10 |
| `ErrorState` | Message + retry | Phase 10 |
| `IconButton` | Sized from `--icon-btn-size`, mandatory `aria-label` | all |
| `Tooltip` | Hover + focus triggered, `role="tooltip"` | all |

### 2.3 Focus management utilities
- `useFocusTrap(ref, active)` — cycles Tab within a container.
- `useFocusRestore(active)` — captures `document.activeElement` on open, restores on close.
- `useRovingTabIndex(items)` — single-tab-stop composite widget navigation, for Tree and Menu.

### 2.4 Global focus-visible baseline
Add one token-driven rule set replacing the 4 ad-hoc declarations:
```css
:where(button, a, input, select, textarea, [tabindex]):focus-visible {
  outline: var(--space-hair) solid var(--color-focus-ring);
  outline-offset: var(--space-1);
}
```

**Exit criteria:** All primitives unit-tested for keyboard operability; `Fields.tsx` has zero inline styles; typecheck and lint clean.

---

## Phase 3 — Shell & Workspace Architecture

**Goal:** A slot-based, composable shell where every region is optional, resizable, collapsible, and persisted.

### 3.1 Region model
Replace hard-mounted regions in `DOMStudioRoot.tsx` with a declarative layout:

```
┌──────────────────────────────────────────────────────────────┐
│ TopBar                                        --topbar-h 60  │
├────┬──────────────┬──────────────────────────┬───────────────┤
│    │              │  ProfileBar (floating)   │               │
│Rail│  Dock        │                          │  Inspector    │
│ 64 │  --layers-w  │  Canvas                  │  --insp-w 340 │
│    │  276         │                          │               │
│    │              ├──────────────────────────┤               │
│    │              │  FlowStrip (collapsible) │               │
├────┴──────────────┴──────────────────────────┴───────────────┤
│ StatusBar                                   --statusbar-h 24 │
└──────────────────────────────────────────────────────────────┘
```

- Grid template driven **entirely** by tokens + persisted store widths (`leftRailW`, `inspectorW`, `timelineH`).
- Each region reads its own collapse flag (`leftRailCollapsed`, `inspectorCollapsed`, `timelineCollapsed`) — all already exist in the store and are currently under-used.
- Collapsed regions render a thin re-expand affordance, not `display: none`.

### 3.2 Reclaim vertical space
Current chrome consumes ~172px before the canvas. Target: **~84px**.
- **FlowStrip:** collapsed by default (`timelineCollapsed: true`), 28px collapsed rail with an expand chevron. *(See Open Question — this assumes option 3.)*
- **ProfileBar:** stop occupying a grid row. Convert `DOMProfileBar` to a floating canvas overlay (`position: absolute`, top-center), matching the existing `.bs-canvas-profile-bar` treatment. Zero vertical cost.

### 3.3 Stylesheet consolidation
Reduce the 6 imports in `DOMStudioRoot.tsx`. Target structure:
```
styles/
  shell.css        (grid, regions, splitters)
  panels.css       (dock, inspector, shared panel chrome)
  canvas.css       (viewport chrome, overlays, selection frame)
  dom-studio.css   (studio identity tokens only)
```
UI-Kit styles come from the package, not a studio-local import.

### 3.4 Shortcut system
Replace the single global `keydown` effect with a registry:
```ts
registerShortcut({ id, keys, when, label, run });
```
- **Every shortcut advertised in a menu must be registered** — this closes the 8 unbound shortcuts (Ctrl+N/O/S/G/L/0, Shift+1, F11).
- The `when` predicate handles the input/`contentEditable` guard centrally (Phase 0.4 becomes structural).
- The command palette and the Help → Keyboard Shortcuts sheet both read the same registry — one source of truth for shortcut labels.

### 3.5 Typed event contract
Replace untyped `window.dispatchEvent(new CustomEvent('bs:dom:align', …))` with a typed emitter. Critically, **`profile` must come from `getUIState().profile`**, not the hardcoded `'desktop'` — this is a functional bug fix, not just typing.

**Exit criteria:** Regions independently collapsible and persisted; canvas gains ≥88px height; all menu-advertised shortcuts functional; align respects the active breakpoint.

---

## Phase 4 — Navigation: Rail, Dock & Hierarchy

**Goal:** Separate global from studio navigation; decompose the 495-line branch; make the tree keyboard-operable.

### 4.1 Split the Activity Rail out of `DOMDock`
`DOMDock.tsx` currently renders both the global Activity Rail and the studio Dock. Move the rail to the app shell (`src/app/`) as `ActivityRail`, leaving `DOMDock` responsible only for the studio's own panel. This is the structural refactoring the brief permits.

### 4.2 Decompose `DOMSidebar` (495 lines → 4 panels)
```
components/dock/
  DockPanel.tsx        (chrome: header, tabs, search, footer)
  panels/PagesPanel.tsx
  panels/LayersPanel.tsx
  panels/ComponentsPanel.tsx
  panels/TemplatesPanel.tsx
  panels/AssetsPanel.tsx     ← restores the unreachable tab
```
- `DockPanel` uses the Phase 2 `Tabs` primitive.
- Active tab persists to the store (`dockTab`), replacing local `useState`.
- `aria-label` on the `<aside>` becomes **dynamic**, derived from the active tab (fixes the hardcoded `"Layers"`).
- Wire the `assets` tab into `DOCK_TABS` and back it with real manifest `assets` data.
- Implement the "Add layer" button (currently `onClick={() => {}}`) as a real `dispatch`-backed node insert, or remove it. Do not ship a no-op.

### 4.3 Replace placeholder data
- Pages panel: read real `sections` / page data from the manifest — remove `"Home · Fleet Story"`.
- Components panel: real counts from the component library — remove the hardcoded `3` and `12`.
- Top bar avatars: bind to real presence data, or hide the `bs-avatars` block behind a feature flag until collaboration ships. Remove `MK` / `DV`.

### 4.4 Rebuild `Tree.tsx` (347 lines)
**Accessibility (P1 — closes WCAG 2.1.1):**
- `useRovingTabIndex`: single tab stop; Arrow Up/Down move, Arrow Right expands/descends, Arrow Left collapses/ascends, Home/End jump, typeahead selects by label.
- Add `aria-level`, `aria-setsize`, `aria-posinset` to every `treeitem`.
- Chevron becomes a real `<button>` with `aria-label` and `aria-expanded` — not a `<span onClick>`.

**Presentation:**
- Delete all 8 inline `style={{}}` blocks.
- Indentation moves from JS (`8 + depth * 14`) to CSS custom property: `style={{ '--tree-depth': item.depth }}` with `padding-inline-start: calc(var(--space-3) + var(--tree-depth) * var(--space-5))`.
- Add indent guide lines (`::before` rules) for visual nesting.
- Status badges (currently inline `opacity` / `marginLeft: auto` / `paddingRight: 4`) become classed.

**Interaction:**
- Hover/focus quick actions: visibility toggle, lock toggle, rename — revealed on row hover **and** on keyboard focus (not hover-only).
- Preserve the existing drag-reparent and 30%/70% edge-insert logic (`edgeFor`) verbatim — it works.
- Add keyboard reparenting as an accessible alternative to drag.

**Data model:**
- Separate the synthetic `'__stage__'` row and unplaced-waypoint rows into visually distinct groups rather than mixing three node kinds into one flat depth-0 list.

**Empty state:** replace the bare `"No matches"` row with the `EmptyState` primitive.

### 4.5 Remove dynamic imports from handlers
`DOMSidebar`'s `import('../../../../engine/progress').then(p => p.setProgress(…))` becomes a static top-level import. The module is always needed; the round-trip buys nothing.

**Exit criteria:** Tree fully keyboard-navigable (axe-core clean); no placeholder data; assets tab reachable; dock tab persists; zero inline styles in `Tree.tsx`.

---

## Phase 5 — Inspector Architecture

**Goal:** Decompose the 1,310-line monolith into grouped, collapsible, searchable property sections.

### 5.1 Fix the panel chrome (`DOMInspectorPanel.tsx`)
- Replace the hand-rolled `insp-tabs` with the Phase 2 `Tabs` primitive — this alone closes the tab-semantics inconsistency against `DOMDock`.
- Persist `subTab` to the store (`inspectorTab`) instead of local `useState`.
- **Render the search input.** `inspectorSearch` is read but no input exists. Add a search field in the panel header that filters visible property rows.
- **Namespace the search field.** `inspectorSearch` is currently a single global consumed identically by all five studios' inspectors, so switching studios carries a stale query. Change to `inspectorSearch: Record<StudioId, string>` or add `domInspectorSearch`. This is a store change — coordinate with the other four studios (behavior-identical migration).

### 5.2 Section decomposition
Split `DOMInspector.tsx` into:
```
components/inspector/sections/
  PositionSection.tsx
  SizeSection.tsx
  BoxModelSection.tsx      ← Phase 0.2 fields live here
  TypographySection.tsx
  BackgroundSection.tsx
  BorderSection.tsx
  EffectsSection.tsx       (shadows, filters, opacity)
  TransformSection.tsx
  ResponsiveSection.tsx    (override management)
```
Each section:
- Wraps in `CollapsibleSection` with persisted open/closed state.
- Owns no local mirror of manifest state — **`ShadowSection`'s `useState` mirror is deleted**; it reads from the manifest and writes via `setStyleValue`, eliminating the drift bug.
- Reads/writes exclusively through `resolveStyle(node, profile)` + `setStyleValue`, preserving the responsive override model and override dots.

### 5.3 Consistent labeling
- One casing convention for section titles — Title Case. Replaces the current mix of `"POSITION"`, `"Box Model"`, `"Shadows · N"`.
- Every input gets `id` + `htmlFor`-associated `<label>` (closes WCAG 1.3.1 / 3.3.2 for Position/Size).
- The override dot `<button>` gets a real accessible name: `aria-label={\`Clear ${label} override for ${profileLabel}\`}` — `title` alone is insufficient.

### 5.4 Multi-selection support
The store already carries `selectedDomNodeIds`. Sections render mixed-value indicators when a property differs across the selection, and write to all selected nodes via a single `dispatchBatch` — one undo step per gesture.

### 5.5 Relocate misplaced inspectors
Move `MaterialInspector.tsx` and `DOMScene3DInspector.tsx` (~2,000 lines) out of `dom-studio/` into their owning studios, or into a shared `packages/inspectors/` if genuinely cross-studio. IL-11 applies: rendered output must be identical. Update the `Inspector.css` references accordingly.

**Exit criteria:** No file in `components/inspector/` exceeds ~300 lines; sections collapse and persist; search filters rows; multi-select edits produce one undo step; no local state mirrors.

---

## Phase 6 — Canvas Chrome & Overlays

**Goal:** Precise, token-driven, keyboard-operable direct-manipulation layer.

### 6.1 Selection frame (`DOMSelectionFrame.tsx`)
- Move `HANDLE_POS` geometry out of TypeScript into CSS: `.bs-selframe__handle--nw { inset-block-start: calc(var(--handle-size) / -2); … }`. TS supplies only the direction class.
- Introduce `--handle-size`, `--handle-hit-area` (≥24px hit target per WCAG 2.5.8), `--selframe-border` tokens.
- Handles become `<button>` elements with `aria-label` (e.g. "Resize from top-left") and **keyboard resize**: Arrow keys adjust by 1px, Shift+Arrow by 10px, committing through the existing `dispatchBatch(cmds, \`resize:${selId}\`)` grouping.
- `Math.max(24, …)` minimum size → `--min-node-size` token.
- Preserve the locked state (`--locked` / `__lockbadge`) behavior.

### 6.2 Profile bar → floating overlay (`DOMProfileBar.tsx`)
- Zoom readout `<span onClick>` → `<button>` with `aria-label="Reset zoom to 100%"`; strip inline `fontSize: 11` / `fontFamily` / `padding` into `.bs-canvas-profile-zoom`.
- Keep the working `aria-pressed` device pills.
- Position as a floating canvas overlay per Phase 3.2.

### 6.3 Viewport controls (`DOMViewportControls.tsx`)
- `AlignToolbar` buttons: add `aria-label` alongside `title`.
- `ScrollRail` is already correct (`role="slider"`, arrow/Home/End, `aria-valuenow`) — **use it as the reference implementation** for other custom controls; do not modify.
- `StageLayer`: inline `pointerEvents` / `transition` → classes with `var(--duration-normal)`.
- Resolve the duplicate `domCanvasHelpers`: keep the `engine/` copy as canonical (it is the one imported), delete the 237-line studio copy after confirming no divergent logic, and update imports.
- Reconsider the `Scene3DViewport` import from `scene3d-studio`. If DOM Studio genuinely needs 3D preview, that viewport belongs in a shared package — the current bidirectional studio dependency violates the isolation model.

### 6.4 Rulers, guides & grid
- Restore guide rendering with tokenized colors (the dead `.bs-guide--center` used a raw `oklch(0.65 0.20 30)`).
- Ruler ticks, labels, and the grid overlay all resolve to tokens.
- Grid/snap/guide toggles bind to the Phase 3.4 shortcut registry (Ctrl+G, Ctrl+L currently advertised but unbound).

**Exit criteria:** Nodes resizable by keyboard; zero inline styles in canvas components; one `domCanvasHelpers`; all overlay colors tokenized.

---

## Phase 7 — Overlays: Menus, Dialogs & Command Palette

**Goal:** Every overlay traps focus, restores focus, closes on Escape, and is fully keyboard-navigable.

### 7.1 Context menu (`DOMContextMenu.tsx`, 488 lines)
- Adopt the Phase 2 `Menu` primitive: `role="menuitem"` on every item, arrow-key navigation, typeahead, Enter/Space activation, keyboard-openable submenus (currently hover-only).
- Toggle items become `role="menuitemcheckbox"` with `aria-checked` — replacing the current pattern of encoding state into label strings.
- Preserve the working viewport clamping (12px margins), Escape, and outside-pointerdown close.
- Focus moves into the menu on open and returns to the trigger on close.

### 7.2 Modals (`PublishModal.tsx`, `TopBarModals.tsx`, `ConflictModal`)
All migrate to the Phase 2 `Modal` primitive, which supplies: `role="dialog"`, `aria-modal="true"`, labelled title, focus trap, initial focus, focus restore, Escape close, and scrim click-to-dismiss where appropriate.
- `PublishModal` currently has **no Escape handler and no focus management** — the primitive fixes both.
- Stop reusing `.uk-palette__backdrop` as a generic scrim; the `Modal` primitive owns `.uk-modal__scrim`.
- Replace `autoFocus` (`TopBarModals.tsx:381`) with the primitive's explicit initial-focus target.

### 7.3 Command palette (`DOMCommandPalette.tsx`, 186 lines)
- Add `aria-modal="true"`; adopt the focus trap and focus restore utilities; remove the `setTimeout(…, 0)` focus hack in favor of a ref-based focus on mount.
- Listbox semantics: `role="listbox"` on the results container, `role="option"` + `aria-selected` on items, `aria-activedescendant` on the input. Items become buttons/options, not `<div onClick/onMouseEnter>`.
- Replace the silent `.slice(0, 12)` with a scrollable virtualized list, or keep a cap **and render "N more results — refine your search"**. Silent truncation is the defect, not the cap.
- Group results by category (Nodes / Commands / Panels / Navigation) with `role="group"` + `aria-labelledby`.
- Source commands from the Phase 3.4 shortcut registry so palette entries and menu shortcuts never drift.
- Backdrop `<div>` gets `role="presentation"`.

### 7.4 Tooltips
Apply the `Tooltip` primitive to every `title`-only affordance so hints are available on keyboard focus, not just hover.

**Exit criteria:** Tab cannot escape any open overlay; Escape closes all; focus returns to the trigger; axe-core reports zero violations on each overlay.

---

## Phase 8 — Accessibility Hardening

**Goal:** WCAG 2.1 AA across the studio, verified by automated and manual testing.

### 8.1 Remaining non-interactive click handlers
Convert the last of the 8 audited categories to real controls with accessible names:
- `.bm-num` spans → `NumberField` (done in Phase 0.2)
- `.tb-cloud-dot` span → `<button aria-label="Sync status: …">`
- `.uk-numfield__scrub` → keep the pointer affordance but make the paired input the accessible control; mark the scrub handle `aria-hidden="true"` since the input already exposes the value
- `Fields.tsx` swatch `<div>` → `<button aria-label="Choose color" aria-expanded={open} aria-haspopup="dialog">`
- `DOMSidebar` draggable rows (`comp-item`, `comp-list-row`, `bs-comp-item`) → `role="button"` + `tabIndex={0}` + Enter/Space handlers, or native `<button>`

### 8.2 Live regions
`DOMStatusBar.tsx` currently marks the whole `<footer role="status">`, re-announcing all 8 items on any change. Scope live regions to the individual changing values (`aria-live="polite"` on the specific span), and remove `role="status"` from the footer.

### 8.3 Shared label maps
Merge `DOMStatusBar`'s `MODE_LABEL` and `DOMTopBar`'s `MODE_TO_STUDIO` into one exported map — same concept, currently two definitions.

### 8.4 Contrast verification
Verify every token pair used for text/background and border/background meets 4.5:1 (text) and 3:1 (UI components) in **both** light and dark themes, including the new `--color-accent-dom*` scale from Phase 1.2.

### 8.5 Verification matrix
| Check | Tool |
|---|---|
| Automated rule violations | `axe-core` per panel + overlay |
| Keyboard-only traversal | Manual: full studio without a mouse |
| Screen reader | Manual: NVDA (Windows) on tree, inspector, overlays |
| Focus visibility | Manual: every interactive element |
| Contrast | Automated token-pair script + manual spot check |
| Reduced motion | `prefers-reduced-motion` honored by all transitions |

> Full WCAG conformance cannot be established by automated tooling alone. Automated checks catch roughly a third of criteria; the manual screen-reader and keyboard passes above, plus expert accessibility review, are required before claiming AA compliance.

**Exit criteria:** axe-core clean; complete keyboard traversal with no traps and no unreachable controls; NVDA announces tree structure, property values, and overlay boundaries correctly.

---

## Phase 9 — Responsive & Adaptive Layout

**Goal:** Introduce the responsive layer that does not currently exist (0 `@media` queries across 3,023 lines).

### 9.1 Breakpoints
Define studio-shell breakpoints in `tokens.css` (distinct from the *document* `DeviceProfile` breakpoints, which describe the user's design — not the tool's chrome):
```css
--bp-shell-sm: 1024px;   /* single panel at a time */
--bp-shell-md: 1280px;   /* one side panel + canvas */
--bp-shell-lg: 1600px;   /* full three-column */
```
Document the distinction clearly; conflating tool chrome breakpoints with document breakpoints would be a serious source of confusion.

### 9.2 Adaptive panel behavior
| Width | Rail | Dock | Canvas | Inspector | FlowStrip |
|---|---|---|---|---|---|
| ≥1600 | icons + labels | open | flex | open | collapsible |
| 1280–1599 | icons | open | flex | open, narrower | collapsed |
| 1024–1279 | icons | overlay drawer | flex | overlay drawer | hidden |
| <1024 | icons | drawer | full | drawer | hidden |

Below `--bp-shell-md`, side panels become overlay drawers over the canvas rather than grid columns — the canvas never drops below a usable minimum.

### 9.3 Container queries for panels
Inspector sections and dock panels use `@container` rather than viewport media queries, so a section laid out at 340px and one at 480px adapt to their own width regardless of window size. This keeps panels correct when the user resizes a splitter.

### 9.4 Splitter constraints
`PanelSplitter` enforces token-driven min/max widths and persists to the store. Add keyboard resize (Arrow keys when the splitter is focused, `role="separator"` + `aria-valuenow`).

### 9.5 Motion & density
- All transitions honor `prefers-reduced-motion: reduce`.
- Optional compact density mode toggling a `--density` multiplier on spacing tokens — valuable for a properties-dense tool on smaller displays.

**Exit criteria:** Studio usable and visually correct at 1024, 1280, 1600, and 1920 wide; no overlap or clipping; splitters keyboard-resizable.

---

## Phase 10 — States, Polish & Documentation

### 10.1 State coverage
Every panel and data surface implements all four states using the Phase 2 primitives:
| State | Requirement |
|---|---|
| **Loading** | `Skeleton` matching final layout — no layout shift on resolve |
| **Empty** | `EmptyState` with icon, heading, description, primary action |
| **Error** | `ErrorState` with cause and retry |
| **Selection** | None / single / multi (mixed values) handled in inspector and canvas |

### 10.2 Iconography
Single icon set, single sizing scale (`--icon-sm/md/lg`), consistent stroke weight, `aria-hidden="true"` on all decorative icons.

### 10.3 Documentation deliverables
- `docs/dom-studio-design-system.md` — token reference, component catalogue, usage rules
- `docs/dom-studio-keyboard-shortcuts.md` — generated from the Phase 3.4 registry
- `docs/dom-studio-architecture.md` — region model, data flow, extension points
- Update `CHANGELOG.md`
- Storybook (or equivalent) entries for every Phase 2 primitive

---

## Verification Strategy

### Per-phase gates (all must pass before merge)
```bash
npm run typecheck
npm run lint
node scripts/audit-selector-collisions.mjs
npm run test
```

### Functional regression checklist
Re-verified after every phase — these are the behaviors that must not change:
1. Node select / multi-select / deselect
2. Drag-reparent and edge-insert (30% / 70% zones)
3. Property mutation → manifest → canvas render
4. Undo / redo, including one step per drag gesture (`dispatchBatch` grouping)
5. Responsive overrides: set, display override dot, clear, per-profile isolation
6. Publish flow and version immutability (IL-4 / IL-5)
7. Scroll clock `[0,1]` driving DOM, camera, lights, materials (Rule 7)
8. Imperative per-frame path (IL-2) — no React re-render on scroll
9. Copy / cut / paste / duplicate / delete, from both top bar and context menu
10. Command palette navigation and execution

### Performance gates
- No React re-render on scroll (IL-2 preserved) — verify with the Profiler
- Tree renders 1,000+ nodes at 60fps (virtualize if needed)
- Inspector property change → canvas paint under one frame
- No layout thrash from the new container queries

---

## Risk Register

| Risk | Phase | Mitigation |
|---|---|---|
| Store schema change breaks sibling studios | 5.1 | Migrate all five inspectors together; behavior-identical default |
| Moving Material/3D inspectors breaks imports | 5.5 | IL-11 — move only, re-export from old path for one release |
| Shell grid rewrite breaks imperative frame path | 3 | Verify IL-2 with the Profiler before/after; canvas DOM refs must remain stable |
| Activity Rail extraction affects other studios | 4.1 | It is already global in behavior; extract with no visual change, verify all six studios |
| Deleting `.uk-*` scoping breaks other consumers | 1.1 | Collision audit after each file; grep confirms `uk-fieldrow__content` is unrendered |
| Accent hue change alters brand identity | 1.2 | Centralize first, decide hue with design sign-off separately |
| Scope creep into engine/business logic | all | Every PR states which Iron Law it touches; engine changes require explicit justification |

---

## Open Question — Requires Decision Before Phase 3

> [!IMPORTANT]
> **`DOMFlowStrip` and the 88px timeline grid area.**
> DOM Studio unconditionally allocates a timeline track for `DOMFlowStrip`. Unlike Animate Studio, DOM design is not inherently timeline-driven.
>
> | Option | Effect |
> |---|---|
> | **1. Remove** | Reclaims 88px permanently; loses in-place scroll-waypoint editing |
> | **2. Repurpose** as asset/component bin | Fills the gap left by the unreachable `assets` tab; larger build |
> | **3. Keep, collapsible, default collapsed** ← *plan assumes this* | Reclaims 60px; fully reversible; no functionality lost |
>
> **This plan proceeds on option 3** because it is the only reversible choice and preserves all existing functionality per the brief. If option 1 or 2 is preferred, Phase 3.2 and Phase 4.2 change accordingly. Confirm before Phase 3 begins.

---

## Summary

30 audited findings across 5 priority tiers resolve across 11 phases. Phase 0 fixes shipped defects in isolation so later regressions are attributable. Phases 1–2 establish the single source of truth — tokens and primitives — that every subsequent phase consumes. Phases 3–7 rebuild the presentation layer region by region. Phases 8–10 harden accessibility, add the missing responsive layer, and complete state coverage and documentation.

The engine, command model, responsive override system, and scroll clock are preserved unchanged throughout.

