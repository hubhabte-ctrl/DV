# UI/UX Production Readiness Audit — Implementation Todos

**Version:** 1.1 · 2026-08-06  
**Source:** [ui_ux_production_readiness_audit.md](./ui_ux_production_readiness_audit.md)  
**Estimated total:** 9–13 engineer-days across 6 phases

**Progress:** Phase 0 ✅ · Phase 1 ✅ · Phases 2–6 not started

Verify any phase with `npm run ui:verify`
(`typecheck` → `lint` → `tokens:check` → `contrast:check`).

---

## Phase 0 — Guardrails (0.5 day, zero risk)

**Status:** ✅ Complete (visual-diff tooling deferred — see 0.1)  
**Priority:** Critical — nothing else starts until this lands  
**Risk:** None

### Tasks

- [ ] **0.1** Capture 36 visual regression baselines — **DEFERRED, NOT DONE**
  - 6 studios (DOM, Scene3D, Material, Animation, Asset, Preview)
  - 2 themes (light, dark)
  - 3 viewports (1280px, 1600px, 1920px)
  - Tool: Playwright, Percy, or Chromatic
  - Location: `frontend/tests/visual/baselines/`
  - **Blocked:** no screenshot tool is installed, and adding one pulls a
    browser binary into a repo that currently has no test runner at all.
    Phases 1 and 2 are token- and type-level and are covered by
    `tokens:check` + `contrast:check`. **Phase 4 (CSS consolidation) must not
    begin until this lands** — it is the phase whose failure mode is purely
    visual, so the snapshot checks cannot substitute for it.

- [x] **0.2** Snapshot computed CSS custom properties
  - `scripts/snapshot-tokens.mjs` — static parse, resolves `var()` chains
  - Output: `tests/tokens/token-snapshot-{dark,light}.json` (427 tokens each)
  - `npm run tokens:snapshot` (write) · `npm run tokens:check` (diff)
  - Limit: static, so it cannot evaluate `calc()` or cascade order across
    component sheets. It catches the failure that matters in Phase 2 — a token
    deleted, renamed, or repointed.

- [x] **0.3** Add verification scripts
  - Substituted for the visual-diff scripts, which 0.1 blocks
  - `npm run tokens:check` · `npm run contrast:check` · `npm run ui:verify`

- [x] **0.4** Verify tooling runs green on unchanged HEAD
  - `tokens:check` green · `contrast:check` green · `typecheck` + `lint` green

**Exit criteria:**
- ⬜ 36 screenshots committed — deferred, gates Phase 4
- ✅ Token snapshots committed (`tests/tokens/`)
- ✅ `npm run ui:verify` runs green
- ✅ Scripts documented in the script headers

---

## Phase 1 — Typography and Motion (1 day, low risk, high visible impact)

**Status:** ✅ Code complete — human visual sign-off outstanding (see exit criteria)  
**Priority:** High — addresses every screenshot issue  
**Risk:** Low — intentional visual changes

### Tasks

- [x] **1.1** Add `prefers-reduced-motion` block (Issue 9)
  - **Already present** at `src/app/ui/tokens/global.css:441-452`, covering
    `*, *::before, *::after` with the exact declarations this task specifies.
    The audit counted it ("1 `prefers-reduced-motion` block") but read the
    count as insufficient coverage rather than as this global reset.
  - No change made. Outstanding: confirm in OS settings that no studio
    re-introduces motion via a more specific rule.

- [x] **1.2** Swap monospace/sans roles (Issue 4)
  - `Inspector.css` — `.grp-title`, `.insp-obj-head .kind`, `.field label`
    moved `var(--mono)` → `var(--font)`
  - `.f-input` keeps `var(--mono)` (correct role for numerics) and gained
    `font-variant-numeric: tabular-nums`, so digits stop shifting width
    while scrubbing
  - Applied to dom-studio, then propagated to the other four studios

- [x] **1.3** Remove `text-transform: uppercase` from field labels (Issue 5)
  - Removed from `.field label`; tracking reset to `--tracking-normal`
  - **Retained** on `.grp-title` and `.insp-obj-head .kind` as the deliberate
    hierarchy marker, with tracking reduced to `--tracking-wide` (0.01em)

- [x] **1.4** Raise type scale floor to 11px (Issue 6)
  - **Token layer.** `--text-label-sm` (10.5px), `--text-mono-label` (10px),
    `--text-micro` (10px) and `--text-nano` (9px) now all resolve to
    `--text-label` (11px). Collapsed at the token layer, not at the ~190 call
    sites: those are roughly 8 distinct rules replicated across five studio
    stylesheet copies, so a central change is both smaller and reversible.
    Phase 2 codemods the names away.
  - **Second cluster — hardcoded literals.** The token collapse alone did not
    finish the task: **28 declarations bypassed the scale entirely** and were
    unaffected by it. A grep after the token edit found them; all are fixed.
    - **23 in CSS.** Three inspector rules — `.bs-insp-node__nid`,
      `.bs-insp-grp__head`, `.bs-insp-seg button` — fixed in dom-studio and
      re-propagated to all five studios (`Inspector.css` md5
      `439d625b10d5a93cc8f9fc73c169e381` across all copies). Five mono
      badge/ruler sizes raised in `ShellLayout.css`, `AnimateStudio.css` (×2),
      `DOMStudio.css`, `MaterialStudio.css`. Three prose labels — `.eyebrow`,
      `.bs-group-label`, `.bs-asset-sub` — additionally moved to sans and the
      `--tracking-wide` tier, since they were mono-at-label-size (the role
      inversion of Issue 4).
    - **5 inline JSX `fontSize` values** tokenised to `var(--text-label)` in
      `AnimateKeyframeInspector.tsx`, both `DOMScene3DInspector.tsx` /
      `Scene3DInspector.tsx`, and both `DOMCanvasRuler.tsx` copies.
  - **Regression guard.** `checkTypeScale()` in `scripts/check-contrast.mjs`
    fails the run if any `--text-*` token resolves below 11px. Verified by
    negative test: dropping `--text-label` to 9px produced
    `✖ 5 token(s) below the 11px floor` and exit 1.
  - `grep` for sub-11px `font-size` / `fontSize` across `src/` now returns **0**.
  - ⚠️ **Reflow in dense panels is UNVERIFIED** — the check this task calls
    for needs the visual baselines that task 0.1 defers. Timeline rulers,
    badges and the left-rail meta rows are the likely pressure points.

- [x] **1.5** Establish three weight tiers (Issue 7)
  - **Object name:** `--text-body` 14px · 600 · Title Case · sans
  - **Section header:** `--text-label` 11px · 600 · UPPERCASE 0.01em · sans
  - **Field label:** `--text-label` 11px · `--weight-label` · Title Case · sans

- [x] **1.6** Add dark-mode weight compensation (Issue 11)
  - `--weight-label` → 500 (dark) / 400 (light), verified in both snapshots
  - Polarity is the reverse of this task's original snippet, which set 400 in
    both themes: light-on-dark text optically thins, so **dark** carries the
    extra step.

- [x] **1.7** Raise helper text contrast (Issue 14)
  - `contrast.test.ts` could not be used — it imports `vitest`, which is not
    installed and has no `test` script, so it has never run. Replaced with
    `scripts/check-contrast.mjs` (plain node, no new dependency).
  - **Dark** `--ink-3` was 2.69:1 — below AA at any size. Lifting it alone
    would have left a 1.26:1 gap to `--ink-2`, so both steps moved.
  - **Light** already cleared AA, but `--ink-0`/`--ink-1` sat 1.26:1 apart —
    primary and secondary text were the same colour to the eye. Re-spaced for
    parity with dark.
  - Result on the panel surface, both themes: **10.4 / 7.0 / 4.6** with ~1.5×
    separation per tier.
  - `--bs-color-border-strong` aliased a *border* role onto the ink ramp; it
    is pinned to its prior literal so no border changed colour. Phase 2 owns
    repointing it to `--color-border-strong`.

- [x] **1.8** Expand abbreviated field labels (Issue 20)
  - `HDR Env` → `Environment Image`, `BG Color` → `Background Color`,
    `Env Power` → `Environment Intensity` in the two dom-studio files
    (`scene3d-studio` already used the expanded wording)
  - The inspector search filter compares the query against a **separate** key
    string, so renaming a label alone would have made it unsearchable by its
    own visible text — a bug already live in `scene3d-studio`. Keys widened to
    contain both wordings (`'hdr env environment image'`), so old muscle
    memory and the new label both match.

**Exit criteria:**
- ⬜ Visual diff reviewed — **blocked on task 0.1**, no tooling exists
- ✅ Contrast verified — `npm run contrast:check`, both themes
- ✅ Type-scale floor verified — same script, negative-tested
- ✅ `npm run typecheck && npm run lint` green
- ⬜ Both themes verified side by side — **needs a human**; the automated
      check covers token contrast, not rendered layout
- ⬜ Reduced-motion verified in OS settings — **needs a human**

### Carried out of Phase 1

- **Border contrast (1.4.11):** `--color-border-strong` is 2.67:1 (dark) /
  2.42:1 (light) against the panel, below the 3:1 required for non-text UI.
  Registered in `KNOWN_GAPS` in `scripts/check-contrast.mjs`, which reports it
  on every run and **fails the build if it is suppressed after being fixed**.
  → **Phase 5**, which already owns focus visibility.
- **Banned neon literals:** the propagation swept `Inspector.css` and
  `LeftRail.css` clean. Three remain: `app/ui/styles/UIKit.css:1876`,
  `preview-studio/styles/PreviewStudio.css:444`, and the `QUICK_SWATCHES`
  array in three `MaterialInspector.tsx` copies — the last is a user-facing
  colour-picker palette, i.e. content, not chrome. → **Phase 2**.


---

## Phase 2 — Token Consolidation (2 days, medium risk)

**Status:** 🔴 Not started  
**Priority:** Critical — unblocks all future standardization  
**Risk:** Medium — computed values must stay byte-identical

### Tasks

- [ ] **2.1** Audit Layer A/B → Layer C mapping
  - Document every token collision
  - Flag where A and B differ (`--sp-1: 2px` has no Layer C equivalent)
  - Decision: add Layer C token or map to nearest?
  - Write mapping table to `docs/token_migration_map.md`

- [ ] **2.2** Alias Layer A (`--bs-*`) to Layer C (SSOT)
  - Location: `tokens.css`
  - Add comment block: `/* @deprecated — use SSOT (Layer C) */`
  - Example: `--bs-space-1: var(--space-1);`
  - Do NOT delete old declarations yet — alias only

- [ ] **2.3** Alias Layer B (Forma) to Layer C (SSOT)
  - Location: `tokens.css`
  - Add comment block: `/* @deprecated — use SSOT (Layer C) */`
  - Example: `--sp-2: var(--space-2);`
  - Example: `--r-xs: var(--radius-sm);`
  - Do NOT delete old declarations yet — alias only

- [ ] **2.4** Codemod consumers — DOM Studio
  - Find/replace `--bs-space-*` → `--space-*`
  - Find/replace `--sp-*` → `--space-*`
  - Find/replace `--fs-*` → `--text-*`
  - Find/replace `--r-*` → `--radius-*`
  - Files: `src/studios/dom-studio/**/*.css`
  - PR title: "refactor(tokens): migrate DOM Studio to SSOT (Layer C)"

- [ ] **2.5** Codemod consumers — Scene3D Studio
  - Same substitutions as 2.4
  - Files: `src/studios/scene3d-studio/**/*.css`
  - PR title: "refactor(tokens): migrate Scene3D Studio to SSOT (Layer C)"

- [ ] **2.6** Codemod consumers — Material Studio
  - Same substitutions as 2.4
  - Files: `src/studios/material-studio/**/*.css`
  - PR title: "refactor(tokens): migrate Material Studio to SSOT (Layer C)"

- [ ] **2.7** Codemod consumers — Animation Studio
  - Same substitutions as 2.4
  - Files: `src/studios/animate-studio/**/*.css`
  - PR title: "refactor(tokens): migrate Animation Studio to SSOT (Layer C)"

- [ ] **2.8** Codemod consumers — Asset Studio
  - Same substitutions as 2.4
  - Files: `src/studios/asset-studio/**/*.css`
  - PR title: "refactor(tokens): migrate Asset Studio to SSOT (Layer C)"

- [ ] **2.9** Codemod consumers — Preview Studio
  - Same substitutions as 2.4
  - Files: `src/studios/preview-studio/**/*.css`
  - PR title: "refactor(tokens): migrate Preview Studio to SSOT (Layer C)"

- [ ] **2.10** Codemod consumers — App layer
  - Same substitutions as 2.4
  - Files: `src/app/ui/**/*.css`
  - PR title: "refactor(tokens): migrate app/ui layer to SSOT (Layer C)"

- [ ] **2.11** Add Stylelint rule banning deprecated tokens
  - Location: `.stylelintrc.json` or `stylelint.config.js`
  - Rule: `declaration-property-value-disallowed-list`
  - Ban patterns: `--bs-*`, `--sp-*`, `--fs-*`, `--r-*` (Layers A/B)
  - Test: add deprecated token to a file; verify lint fails

- [ ] **2.12** Delete Layer A and B declarations
  - Location: `tokens.css`
  - Remove all `@deprecated` comment blocks
  - Remove all aliased Layer A (`--bs-*`) declarations
  - Remove all aliased Layer B (Forma) declarations
  - PR title: "refactor(tokens): remove deprecated Layer A/B aliases"

- [ ] **2.13** Verify computed-property snapshot byte-identical
  - Run `npm run tokens:check` — must report `unchanged` for both themes
  - Any drift is a regression; the script prints added/removed/changed keys
  - Four keys are **expected to disappear** when 2.x deletes them:
    `--text-label-sm`, `--text-mono-label`, `--text-micro`, `--text-nano`
    (Phase 1 collapsed their values to `--text-label`; Phase 2 removes the
    names). Re-baseline with `npm run tokens:snapshot` only for those.

- [ ] **2.14** Repoint `--bs-color-border-strong` (carried from Phase 1)
  - It currently holds a **pinned literal** (`#5a626f` dark / `#475569` light)
    because it aliased a border role onto the `--ink-*` text ramp. Phase 1
    lifted that ramp for WCAG AA and pinned this token so no border shifted.
  - Repoint to `var(--color-border-strong)` and delete the bridge
  - ⚠️ This **changes** the resolved value (`#52627A` dark / `#94A0B2` light).
    It is the first intentional token-value change in Phase 2 — expect and
    re-baseline exactly these two keys, and check hover/active borders.

- [ ] **2.15** Remove remaining banned neon literals (carried from Phase 1)
  - `app/ui/styles/UIKit.css:1876` — `rgba(16, 185, 129, 0.15)`
  - `preview-studio/styles/PreviewStudio.css:444` — `#0f172a`
  - **Leave** `QUICK_SWATCHES` in the three `MaterialInspector.tsx` copies:
    that array is a user-facing colour-picker palette, i.e. content the user
    chooses from, not brand chrome. Phase 3 dedupes the file itself.

**Exit criteria:**
- ✅ `npm run tokens:check` green, with only the documented deletions re-based
- ✅ Zero `var(--bs-*)` / `var(--sp-*)` / `var(--fs-*)` / `var(--r-*)` in codebase
- ✅ Stylelint rule active and enforced
- ✅ `npm run ui:verify` green
- ✅ Visual diff: 0 changes

---

## Phase 3 — Component Consolidation (3 days, medium risk)

**Status:** 🔴 Not started  
**Priority:** Critical — eliminates 59 redundant files  
**Risk:** Medium — drift in non-identical families

### Byte-Identical Families (Zero Risk)

- [ ] **3.1** Consolidate `Button.tsx` (6 copies → 1)
  - Verify byte-identical: `md5sum */components/common/Button.tsx`
  - Move to: `src/app/ui/components/Button.tsx`
  - Add re-export shims in each studio:
    ```tsx
    export { Button, type ButtonProps } from '../../../../app/ui/components/Button';
    ```
  - Files: all 6 studios
  - PR title: "refactor(components): consolidate Button (6 → 1)"

- [ ] **3.2** Consolidate `Chip.tsx` (6 → 1)
- [ ] **3.3** Consolidate `SearchInput.tsx` (6 → 1)
- [ ] **3.4** Consolidate `SegmentedControl.tsx` (6 → 1)
- [ ] **3.5** Consolidate `ConflictModal.tsx` (6 → 1)
- [ ] **3.6** Consolidate `PublishModal.tsx` (6 → 1)
- [ ] **3.7** Consolidate `TopBarModals.tsx` (6 → 1)
- [ ] **3.8** Consolidate `Icons.tsx` (5 → 1)
- [ ] **3.9** Consolidate `CollapsibleSection.tsx` (5 → 1)
- [ ] **3.10** Consolidate `InspectorObjectHeader.tsx` (5 → 1)
- [ ] **3.11** Consolidate `Tree.tsx` (4 → 1)
- [ ] **3.12** Consolidate `Menu.tsx` (4 → 1)
- [ ] **3.13** Consolidate `dnd.ts` (4 → 1)
- [ ] **3.14** Consolidate `PBRSliderRow.tsx` (3 → 1)
- [ ] **3.15** Consolidate `DOMNodeView.tsx` (2 → 1)

### Drifted Families (Requires Reconciliation)

- [ ] **3.16** Reconcile `Fields.tsx` (6 copies, all drifted)
  - Diff all 6 copies pairwise
  - Classify each delta: intentional-fix vs accidental-drift
  - Document disposition in writing: `docs/fields_drift_disposition.md`
  - Merge to canonical implementation
  - Test all field types: text, number, color, select, vector3
  - PR title: "refactor(components): reconcile and consolidate Fields (6 → 1)"

- [ ] **3.17** Reconcile `MaterialInspector.tsx` (3 copies, drifted)
  - Diff DOM / Scene3D / Material studio copies
  - Document disposition
  - Merge to canonical implementation
  - Test all material types and PBR properties
  - PR title: "refactor(components): reconcile MaterialInspector (3 → 1)"

- [ ] **3.18** Reconcile `MaterialChannels.tsx` (3 copies, drifted)
- [ ] **3.19** Reconcile `*CommandPalette.tsx` (6 copies, drifted)
- [ ] **3.20** Reconcile `*Dock.tsx` (5 copies, drifted)

### Verification

- [ ] **3.21** Update boundary checker if needed
  - Verify `scripts/check-boundaries.mjs` permits `studios/** → app/ui/**`
  - If not, add exception for shared components
  - Test: `npm run lint` should pass

- [ ] **3.22** Verify no visual regressions
  - Run `npm run ui:diff`
  - All 36 baselines should show 0 diffs
  - If drift causes visual change, document and get approval

**Exit criteria:**
- ✅ 59 redundant files removed
- ✅ All shims export identical public surface
- ✅ `npm run typecheck && npm run lint` green
- ✅ Boundary invariants still clean
- ✅ Visual regression: 0 diffs
- ✅ Drift dispositions documented for reconciled families

---

## Phase 4 — CSS Consolidation (3 days, **highest risk**)

**Status:** 🔴 Not started  
**Priority:** Critical — eliminates 8,400 duplicate CSS lines  
**Risk:** **High** — cascade changes can alter specificity

### Pre-Work (BLOCKING)

- [ ] **4.0** Disposition `dom-studio` drift **in writing**
  - Diff `dom-studio/styles/LeftRail.css` against other 4 copies
  - Diff `dom-studio/styles/Inspector.css` against other 4 copies
  - Classify each delta: intentional-fix or accidental-drift
  - Document in: `docs/dom_studio_css_drift_disposition.md`
  - **Decision required from team before proceeding**

### LeftRail.css Consolidation

- [ ] **4.1** Create canonical `app/ui/styles/left-rail.css`
  - Use the majority byte-identical copy as base
  - Apply intentional fixes from `dom-studio` if dispositioned as correct
  - Document applied fixes in commit message

- [ ] **4.2** Migrate Scene3D Studio to shared `left-rail.css`
  - Replace `scene3d-studio/styles/LeftRail.css` import
  - Import `../../../app/ui/styles/left-rail.css`
  - Delete local copy
  - Visual regression check
  - PR title: "refactor(css): migrate Scene3D to shared left-rail"

- [ ] **4.3** Migrate Material Studio to shared `left-rail.css`
- [ ] **4.4** Migrate Animation Studio to shared `left-rail.css`
- [ ] **4.5** Migrate Asset Studio to shared `left-rail.css`
- [ ] **4.6** Migrate DOM Studio to shared `left-rail.css` (LAST — already drifted)
  - Add `dom-studio/styles/left-rail-overrides.css` if needed
  - Document why overrides exist

### Inspector.css Consolidation

- [ ] **4.7** Create canonical `app/ui/styles/inspector.css`
  - Use the majority byte-identical copy as base
  - Apply intentional fixes from `dom-studio` if dispositioned as correct

- [ ] **4.8** Migrate Scene3D Studio to shared `inspector.css`
- [ ] **4.9** Migrate Material Studio to shared `inspector.css`
- [ ] **4.10** Migrate Animation Studio to shared `inspector.css`
- [ ] **4.11** Migrate Asset Studio to shared `inspector.css`
- [ ] **4.12** Migrate DOM Studio to shared `inspector.css` (LAST)
  - Add `dom-studio/styles/inspector-overrides.css` if needed

### CanvasChrome.css Consolidation

- [ ] **4.13** Create canonical `app/ui/styles/canvas-chrome.css`
  - All 3 copies are byte-identical — use any as base

- [ ] **4.14** Migrate Scene3D Studio to shared `canvas-chrome.css`
- [ ] **4.15** Migrate DOM Studio to shared `canvas-chrome.css`
- [ ] **4.16** Migrate Animation Studio to shared `canvas-chrome.css`

### Verification

- [ ] **4.17** Verify CSS bundle size reduced ≥40%
  - Measure: `du -sh dist/assets/*.css`
  - Before: ~19,080 lines
  - After: should be ~11,000 lines (40% reduction)

- [ ] **4.18** Verify 36 visual baselines within 0.1%
  - Run `npm run ui:diff`
  - Any diff >0.1% requires investigation and approval

- [ ] **4.19** Verify computed styles for representative nodes
  - Pick one inspector field per studio
  - Capture computed styles before/after
  - Diff must be empty

**Exit criteria:**
- ✅ `dom-studio` drift dispositioned in writing
- ✅ CSS bundle size reduced ≥40%
- ✅ All 36 baselines within 0.1%
- ✅ Computed styles identical for representative nodes
- ✅ `npm run typecheck && npm run lint` green
- ✅ No specificity regressions

---

## Phase 5 — Accessibility Remediation (2 days, low risk)

**Status:** 🔴 Not started  
**Priority:** High — WCAG 2.2 AA compliance  
**Risk:** Low — converting divs to buttons may shift layout slightly

### Keyboard Access

- [ ] **5.1** Audit 48 `<div onClick>` handlers
  - Find: `grep -rn "<div[^>]*onClick" src --include="*.tsx"`
  - List all 48 in: `docs/keyboard_inaccessible_divs.md`

- [ ] **5.2** Create `.uk-reset-button` style
  - Location: `UIKit.css`
  - CSS:
    ```css
    .uk-reset-button {
      all: unset;
      display: inherit;
      cursor: pointer;
    }
    ```

- [ ] **5.3** Convert interactive divs to buttons (batch 1: 16 files)
  - Convert `<div onClick>` → `<button className="uk-reset-button">`
  - Add `onKeyDown` if Enter/Space handling differs from click
  - Verify layout unchanged
  - Test keyboard traversal

- [ ] **5.4** Convert interactive divs to buttons (batch 2: 16 files)
- [ ] **5.5** Convert interactive divs to buttons (batch 3: 16 files)

### Focus Visibility

- [ ] **5.6** Create canonical `:focus-visible` rule
  - Location: `global.css`
  - Apply to all interactive selectors:
    ```css
    button:focus-visible,
    a:focus-visible,
    input:focus-visible,
    select:focus-visible,
    textarea:focus-visible,
    [role="button"]:focus-visible,
    [role="tab"]:focus-visible,
    [tabindex]:focus-visible {
      outline: none;
      box-shadow: var(--shadow-focus);
    }
    ```

- [ ] **5.7** Remove per-component `:focus-visible` rules
  - Find: `grep -rn ":focus-visible" src --include="*.css"`
  - Delete redundant declarations (covered by canonical rule)
  - Keep only if genuinely component-specific

### Target Size

- [ ] **5.8** Raise `--icon-btn-size-sm` to 24px (WCAG 2.5.8)
  - Location: `tokens.css`
  - Change: `--icon-btn-size-sm: 22px` → `--icon-btn-size-sm: 24px`
  - Verify layout doesn't break in dense toolbars

### Contrast

- [ ] **5.9** Extend `contrast.test.ts` to non-text elements
  - Test border contrast: 3:1 minimum
  - Test swatch contrast: 3:1 minimum
  - Test disabled state contrast
  - Test placeholder text contrast

- [ ] **5.10** Verify inactive tab contrast
  - Check against 4.5:1 in both themes
  - Adjust if needed

### Manual Testing

- [ ] **5.11** Keyboard-only traversal of every panel
  - DOM Studio inspector
  - Scene3D Studio inspector
  - Material Studio inspector
  - Animation Studio timeline + inspector
  - Asset Studio library + workspace
  - Preview Studio canvas
  - All modals and dialogs
  - **All interactions must be keyboard-accessible**

- [ ] **5.12** axe-core automated scan
  - Install: `npm install --save-dev @axe-core/cli`
  - Run: `npx axe http://localhost:3000 --tags wcag2aa`
  - Fix all Critical and Serious issues
  - Document Moderate/Minor in: `docs/accessibility_known_issues.md`

- [ ] **5.13** Raise border contrast to 3:1 (carried from Phase 1, WCAG 1.4.11)
  - `--color-border-strong` (→ `--line-3`) is **2.67:1** dark / **2.42:1**
    light against `--color-surface-panel`; non-text UI requires 3:1
  - It is the hover/active border, so it communicates state — 1.4.11 applies
  - Registered in `KNOWN_GAPS` in `scripts/check-contrast.mjs`. That list may
    only shrink: once this passes, the script **fails** until the entry is
    deleted, so the suppression cannot outlive the fix.
  - Also audit `--color-border-default` (`--line-2`) on input fills, and add
    both pairs to `PAIRS` in the script once they clear
  - ⚠️ Repaints every strong border in both themes — a deliberate visual
    change, which is why Phase 1 declined to make it

**Exit criteria:**
- ✅ Zero `<div onClick>` without keyboard handler
- ✅ Canonical `:focus-visible` applied universally
- ✅ All interactive targets ≥24×24px
- ✅ `npm run contrast:check` green with an **empty** `KNOWN_GAPS`
- ✅ Keyboard traversal complete without mouse
- ✅ axe-core: 0 Critical, 0 Serious

---

## Phase 6 — Responsive Tokenisation (1 day, medium risk)

**Status:** 🔴 Not started  
**Priority:** Medium — documents current breakpoints  
**Risk:** Medium — do not change values, only tokenize

### Tasks

- [ ] **6.1** Add breakpoint tokens to `tokens.css`
  - Do NOT change values — tokenize existing only
  - ```css
    --bp-sm: 560px;    /* (existing, used once) */
    --bp-md: 768px;    /* (existing, used once) */
    --bp-lg: 900px;    /* (existing, used once) */
    --bp-xl: 1024px;   /* (existing, used twice) */
    --bp-2xl: 1250px;  /* (existing, used once) */
    ```

- [ ] **6.2** Replace hardcoded breakpoints in `@media` queries
  - Find: `grep -rn "@media.*max-width.*px" src --include="*.css"`
  - Replace literals with tokens
  - Example: `@media (max-width: 1024px)` → `@media (max-width: var(--bp-xl))`

- [ ] **6.3** Document breakpoint system
  - Location: `docs/responsive_breakpoints.md`
  - Describe what happens at each breakpoint
  - Note: mobile/tablet layouts are **not** in scope

**Exit criteria:**
- ✅ All 5 breakpoints tokenized
- ✅ Zero hardcoded `max-width: NNNpx` in `@media` queries
- ✅ Breakpoints documented
- ✅ Visual diff: 0 changes (values unchanged)

---

## Open Decisions (BLOCKING)

**Status:** 🔴 Requires team decision

### Decision 1: `dom-studio` CSS Drift
**Blocks:** Phase 4 (CSS Consolidation)

- `dom-studio/styles/LeftRail.css` has drifted from other 4 copies
- `dom-studio/styles/Inspector.css` has drifted from other 4 copies

**Question:** Is this drift an intentional fix or accidental divergence?

**Action required:**
- Diff and classify each delta
- Document disposition in `docs/dom_studio_css_drift_disposition.md`
- Decide which version is correct

---

### Decision 2: Uppercase Retention
**Blocks:** Phase 1.3

**Question:** Should section headers keep `text-transform: uppercase` as a deliberate hierarchy marker, or remove entirely?

**Current recommendation:** Retain for section headers only (e.g. `LIGHTING`), remove from field labels.

**Action required:** Confirm or override recommendation

---

### Decision 3: 9px/10px Type Removal
**Blocks:** Phase 1.4

**Question:** Does any dense data view depend on `--text-nano: 9px` or `--text-label-sm: 10.5px`?

**Current recommendation:** Raise floor to 11px and retire sub-11px tokens.

**Action required:** Audit all usages; confirm no critical view breaks

---

### Decision 4: Loading/Error/Success States
**Does not block any phase**

**Question:** Loading/error/success states were not observable in reviewed screenshots. Should we inventory them separately?

**Current recommendation:** Commission a separate inventory pass after Phase 1-3 land.

**Action required:** Decide if this is in scope for this audit or deferred

---

## Out of Scope (Flagged for Product)

These surfaced during audit but constitute **redesign, not standardization**:

- [ ] Adding primary-action buttons to empty states (interaction design change)
- [ ] Restructuring Transmission/Alpha Mode dependency disclosure (workflow change)
- [ ] Adding preview thumbnails to environment-image selector (new feature)
- [ ] Any mobile or tablet layout (new responsive tier)

**Requires product sign-off before implementation**

---

## Regression Prevention Checklist

**Per PR:**
- [ ] `npm run typecheck` green
- [ ] `npm run lint` green (includes boundary invariants)
- [ ] Visual diff reviewed; intentional changes explicitly accepted
- [ ] No `@bs/engine`, `dispatch`, `getManifest`, routing, or command file in diff
- [ ] Both themes verified
- [ ] Keyboard traversal unaffected

**Per Phase:**
- [ ] All 36 baselines re-captured and compared
- [ ] Computed token snapshot diffed
- [ ] `contrast.test.ts` green
- [ ] Bundle size recorded
- [ ] Rollback verified by reverting phase merge on scratch branch

**Pre-Production:**
- [ ] axe-core clean across all 6 studios
- [ ] Manual keyboard-only traversal of every panel
- [ ] Screen-reader smoke test (NVDA or VoiceOver) on inspector + modals
- [ ] 200% zoom without horizontal scroll or clipping
- [ ] `prefers-reduced-motion: reduce` honoured
- [ ] Light and dark parity confirmed side by side

---

## Success Metrics

| Metric | Current | Target | Phase |
|---|---|---|---|
| CSS duplication | 44% (8,400 lines) | 0% | 4 |
| Component duplication | 59 redundant files | 0 | 3 |
| Design token systems | 3 competing | 1 | 2 |
| Keyboard failures | 48 | 0 | 5 |
| Focus-visible coverage | 28 rules | Universal | 5 |
| Motion preference support | 1 block | Complete | 1 |
| Type scale floor | 9px | 11px | 1 |
| Monospace/sans roles | Inverted | Correct | 1 |

---

**End of Todos · Version 1.0 · 2026-08-06**
