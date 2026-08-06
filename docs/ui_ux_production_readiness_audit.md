# Enterprise SaaS UI/UX Production Readiness Audit

**Version:** 1.0 · 2026-08-06
**Scope:** Frontend UI layer — `frontend/src/app/**` and `frontend/src/studios/**`
**Constraint:** No changes to business logic, engine APIs, routing, data flow, or user workflows.
**Baseline:** `npm run typecheck` ✅ · `npm run lint` ✅ · boundary invariants ✅

---

## 1. Executive Summary

The application is **functionally complete and architecturally disciplined at the boundary layer**, but
carries **structural UI debt that will not scale**. The engine/studio separation is enforced and clean
(verified by `scripts/check-boundaries.mjs`). Colour tokenisation is near-perfect — exactly **one**
hardcoded colour literal exists in 19,080 lines of studio CSS.

The problem is not correctness. It is **replication**.

| Metric | Value | Assessment |
|---|---|---|
| Total studio TS/TSX | 34,193 lines across 186 files | — |
| Shared `app/` layer | **639 lines** (1.8% of UI code) | 🔴 Critically thin |
| Total CSS | 19,080 lines | — |
| CSS that is a verbatim copy | **~8,400 lines (44%)** | 🔴 Critical |
| Byte-identical component files | **59 redundant of 74** | 🔴 Critical |
| Competing design-token scales | **3 parallel systems** | 🔴 Critical |
| `text-transform: uppercase` sites | 58 | 🟠 High |
| Non-semantic click handlers (`<div onClick>`) | 48 | 🟠 High |
| `:focus-visible` rules | 28 (for 19k CSS lines) | 🟠 High |
| `prefers-reduced-motion` blocks | **1** | 🟠 High |
| Responsive breakpoints | 5, ad hoc, no tokens | 🟡 Medium |
| Hardcoded colour literals | 1 | 🟢 Excellent |

**Headline finding:** six studios each maintain a private copy of the same design system. `LeftRail.css`
(1,353 lines) exists in five studios; four are byte-identical and **one has already drifted**.
`Inspector.css` (715 lines) shows the same pattern. This is not a theoretical risk — the drift has
already happened, and it is the mechanism by which every visual inconsistency in the reviewed
screenshots was introduced.

**Overall production readiness: 6.5 / 10.** Ship-capable, but each future UI change costs 5×
what it should and carries a 5× regression surface.

---

## 2. Overall UI/UX Assessment

### What is working

- **Colour system discipline.** Semantic aliasing (`--color-text-primary` → `--ink-0` → `#F4F5F7`) is
  correct three-layer token architecture. Light and dark are genuine first-class variants, not a filter.
- **A contrast test is written** (`src/app/ui/tokens/contrast.test.ts`, 134 lines) — but see the
  correction in §2.1: it imports `vitest`, and **no test runner is installed**. It has never executed.
  It is a correct foundation, not a working control.
- **Architectural boundaries are enforced in CI.** No cross-studio imports, no reverse
  `packages/** → src/**` dependencies. This is rare and worth protecting.
- **ARIA coverage is better than typical.** 343 `aria-label` and 237 `role` attributes indicate genuine
  effort, not an afterthought.

### What is not

- **The design system is documentation, not infrastructure.** Tokens are defined centrally but consumed
  through five divergent copies. There is no mechanism preventing a studio from drifting.
- **Typography is the weakest subsystem.** Three competing scales, four font-family declarations, a
  monospace/sans role inversion, and a floor at 9px.
- **The shared layer is too small to be load-bearing.** At 639 lines against 34,193, `app/` cannot
  function as a design system. It is a utility folder.
- **Accessibility is inconsistent rather than absent.** Good ARIA coverage sits alongside 48
  keyboard-inaccessible click targets and near-zero motion-preference support.

---

## 2.1 Corrections to Version 1.0

Two findings from the Phase 0 implementation pass invert conclusions in the original audit. Both are
recorded here rather than silently edited, because both change what the roadmap should do.

### Correction A — `dom-studio` CSS drift is a FIX, not a defect

Version 1.0 flagged `dom-studio` as the drifted outlier and scheduled it to migrate **last**
(Phase 4.6, 4.12) on the assumption its divergence was accidental. The diff shows the opposite.

| File · line | `dom-studio` | Other 4 studios |
|---|---|---|
| `LeftRail.css:1093-1094` | `rgba(22, 90, 109, …)` — Petrol Blue | `rgba(56, 189, 248, …)` — **neon sky** |
| `Inspector.css:642` | `rgba(22, 90, 109, 0.20)` — Petrol Blue | `rgba(16, 185, 129, 0.25)` — **neon emerald** |
| `Inspector.css:709` | `rgba(22, 90, 109, 0.18)` — Petrol Blue | `rgba(16, 185, 129, 0.15)` — **neon emerald** |

`tokens.css:5` states the brand rule explicitly: **"BANNED: neon accents, high-saturation
primaries."** The four "clean" studios each carry three banned neon literals. `dom-studio` is the only
one that has been corrected.

**Consequences:**
1. **`dom-studio` is the canonical source** for both files, not the last to migrate.
2. The audit's "1 hardcoded colour literal" metric was wrong — it counted only `color:` declarations.
   Counting `background`/`border` fallbacks, there are **13** (12 neon + 1 `border-color: #0f172a`).
3. Open Decision 1 is **resolved**: the drift is an intentional brand fix. No team decision needed.
4. These are `var(--token, fallback)` fallbacks, so they only paint if the token is missing — latent,
   not currently visible. That is why they survived review. It does not make them correct.

### Correction B — the contrast test has never run

`contrast.test.ts` imports `vitest`. Neither `frontend/package.json` nor the root manifest installs
vitest, jest, or any runner; `frontend/package.json` has no `test` script. The file is 134 lines of
correct, unexecuted logic.

**Consequence:** every "✅ `contrast.test.ts` green" gate in the Version 1.0 roadmap was unsatisfiable.
Installing a runner is a **Phase 0 prerequisite**, not a Phase 1 convenience.

---

| # | Issue | Priority | Complexity | Risk |
|---|---|---|---|---|
| 1 | Three competing design-token scales | **Critical** | High | Medium |
| 2 | CSS duplicated 5× with active drift | **Critical** | High | High |
| 3 | 59 byte-identical duplicate components | **Critical** | High | Medium |
| 4 | Monospace/sans typographic role inversion | **High** | Low | Low |
| 5 | Universal ALL CAPS label treatment | **High** | Low | Low |
| 6 | Type scale floor below legibility threshold | **High** | Low | Low |
| 7 | Flat weight hierarchy in panels | **High** | Low | Low |
| 8 | 48 keyboard-inaccessible click targets | **High** | Medium | Low |
| 9 | No `prefers-reduced-motion` support | **High** | Low | None |
| 10 | Sparse `:focus-visible` coverage | **High** | Medium | Low |
| 11 | Dark-mode optical weight not compensated | **Medium** | Low | Low |
| 12 | Numeric fields lack units and tabular figures | **Medium** | Low | Low |
| 13 | Weak empty-state treatment (`(none)`) | **Medium** | Low | Low |
| 14 | Low-contrast helper text | **Medium** | Low | None |
| 15 | Undersized colour swatch affordance | **Medium** | Low | Low |
| 16 | No responsive breakpoint system | **Medium** | Medium | Medium |
| 17 | Inconsistent vertical rhythm | **Medium** | Medium | Medium |
| 18 | Dead token declarations in `tokens.css` | **Low** | Low | None |
| 19 | Corrupted punctuation in code comments | **Low** | Low | None |
| 20 | Residual abbreviated field labels | **Low** | Low | None |

---

## 4. Critical Issues — Full Analysis

### Issue 1 — Three Competing Design-Token Scales

**1. Summary.** `tokens.css` declares three parallel, overlapping token systems for the same primitives.

**2. Problem description.** Spacing, radius, and type size each have three independent naming schemes
with colliding values:

| Concept | Layer A (`--bs-*`) | Layer B (Forma) | Layer C (SSOT) |
|---|---|---|---|
| 4px space | `--bs-space-1` | `--sp-2` | `--space-2` |
| 8px space | `--bs-space-2` | `--sp-4` | `--space-4` |
| 4px radius | `--bs-radius-xs` | `--r-xs` | `--radius-sm` |
| 11px text | `--bs-typography-size-xs` | `--fs-00` | `--text-label` |
| Sans stack | `--bs-typography-fontFamily-ui` | `--font-sans` | `--font` |
| Mono stack | `--bs-typography-fontFamily-mono` | `--font-mono` | `--mono` |

An engineer adding a component has three defensible choices for every value. All three are "correct."
That is the definition of an unenforceable standard.

**3. Root cause.** Two design-system migrations were layered without decommissioning the predecessor.
The file's own comments acknowledge this: *"Bridge aliases kept for legacy components"* and
*"every other neutral was a dead oklch declaration superseded by the SSOT."*

**4. Recommended approach.** Declare **SSOT (Layer C) canonical.** Convert Layers A and B into thin
aliases pointing at Layer C, mark them `@deprecated` in a comment block, codemod all consumers to
Layer C, then delete A and B. Do not attempt this in one commit — alias first, migrate per-studio,
delete last.

**5. Affected modules.** `src/app/ui/tokens/tokens.css`, `global.css`, all 23 stylesheets.

**6. Complexity.** High — ~1,200 substitution sites.

**7. Priority.** Critical. Every other standardisation effort depends on this landing first.

**8. Risks.** Value collisions where A and B differ subtly (`--sp-1: 2px` has no Layer C equivalent
below `--space-1: 2px` — verify before mapping). Specificity changes if a token is deleted while still
referenced, producing an invalid `var()` and silent fallback to initial value.

**9. Regression prevention.** Add a Stylelint rule banning Layer A/B token names after migration
(`declaration-property-value-disallowed-list`). Snapshot every computed custom property on `:root` and
`[data-theme='light']` before and after; diff must be empty.

**10. Validation checklist.**
- [ ] Computed-style snapshot identical pre/post for both themes
- [ ] Zero `var(--bs-*)` / `var(--sp-*)` / `var(--fs-*)` / `var(--r-*)` references remain
- [ ] `contrast.test.ts` passes
- [ ] Visual regression suite: 0 diffs above 0.1% threshold

---

### Issue 2 — CSS Duplicated Five Times, With Active Drift

**1. Summary.** 44% of studio CSS is copy-paste, and divergence has already begun.

**2. Problem description.** Verified by checksum:

| File | Copies | Byte-identical | Status |
|---|---|---|---|
| `LeftRail.css` (1,353 lines) | 5 | 4 | 🔴 `dom-studio` has drifted |
| `Inspector.css` (715 lines) | 5 | 4 | 🔴 `dom-studio` has drifted |
| `CanvasChrome.css` (94 lines) | 3 | 3 | 🟠 Duplicated, not yet drifted |

Roughly **8,400 of 19,080 CSS lines are redundant**. A single-line fix to inspector spacing requires
five edits; miss one and you have manufactured a new inconsistency. This is precisely what produced
the visual differences visible across studio panels.

**3. Root cause.** Studio isolation (a correct architectural goal, enforced for *imports*) was applied
to *styling* as well. But CSS is global by nature — isolating it duplicates it without providing
encapsulation benefit.

**4. Recommended approach.** Promote shared stylesheets to `src/app/ui/styles/`:
`inspector.css`, `left-rail.css`, `canvas-chrome.css`. Each studio imports the shared sheet, then
optionally a small `*-overrides.css` for genuine studio-specific rules. Reconcile `dom-studio`'s drift
explicitly — diff it, decide which side is correct, document the decision.

**5. Affected modules.** All 6 studio `styles/` directories.

**6. Complexity.** High — requires careful cascade reconciliation.

**7. Priority.** Critical.

**8. Risks.** **Highest-risk change in this plan.** Five independent cascades merging into one can alter
specificity resolution. Import order changes which rule wins. `dom-studio`'s drift may be an
intentional fix that would be silently reverted.

**9. Regression prevention.**
- Diff `dom-studio` copies against the canonical set *before* any merge; classify each delta as
  intentional-fix or accidental-drift, in writing.
- Land as three separate PRs (one file family each), never one.
- Full visual regression capture across all 6 studios × 2 themes × 3 viewports = 36 baselines.

**10. Validation checklist.**
- [ ] `dom-studio` deltas classified and dispositioned in writing
- [ ] 36 visual baselines captured pre-merge
- [ ] Post-merge diff ≤ 0.1% on every baseline
- [ ] Computed styles identical for a representative node in each studio
- [ ] CSS bundle size reduced ≥ 40%

---

### Issue 3 — Fifty-Nine Redundant Component Files

**1. Summary.** Fifteen component families are byte-identical across up to six studios.

**2. Problem description.** Verified by checksum:

| Component | Copies | Redundant |
|---|---|---|
| `Button.tsx` | 6 | 5 |
| `Chip.tsx` | 6 | 5 |
| `SearchInput.tsx` | 6 | 5 |
| `SegmentedControl.tsx` | 6 | 5 |
| `ConflictModal.tsx` | 6 | 5 |
| `PublishModal.tsx` | 6 | 5 |
| `TopBarModals.tsx` | 6 | 5 |
| `Icons.tsx` | 5 | 4 |
| `CollapsibleSection.tsx` | 5 | 4 |
| `InspectorObjectHeader.tsx` | 5 | 4 |
| `Tree.tsx` | 4 | 3 |
| `Menu.tsx` | 4 | 3 |
| `dnd.ts` | 4 | 3 |
| `PBRSliderRow.tsx` | 3 | 2 |
| `DOMNodeView.tsx` | 2 | 1 |
| **Total** | **74** | **59** |

Additionally, these exist in 3–6 copies that are **no longer identical** — they have already drifted:
`Fields.tsx`, `MaterialInspector.tsx`, `MaterialChannels.tsx`, `*CommandPalette.tsx`, `*Dock.tsx`.

**3. Root cause.** Same as Issue 2 — studio isolation over-applied to presentational primitives that
carry no studio-specific logic.

**4. Recommended approach.** Establish `src/app/ui/components/` as the shared primitive library.
Migrate the 15 identical families first (mechanical, zero-risk — the files are byte-identical, so a
re-export shim cannot change behaviour). Then reconcile the drifted families one at a time, treating
each as its own reviewed change.

Migration shim pattern preserves all import paths:

```tsx
// studios/dom-studio/components/common/Button.tsx
export { Button, type ButtonProps } from '../../../../app/ui/components/Button';
```

This is a **zero-behaviour-change** step. Import-path cleanup is a separate, optional follow-up.

**5. Affected modules.** All 6 studios' `components/common/` and `components/modals/`.

**6. Complexity.** High in aggregate, trivial per component.

**7. Priority.** Critical.

**8. Risks.** Low for identical files. Medium for drifted files — the drift may encode a studio-specific
fix. The boundary checker must be updated to permit `studios/** → app/ui/**` (verify it already does).

**9. Regression prevention.** One component family per PR. Shim-first, delete-later. Confirm
`check-boundaries.mjs` still passes after each.

**10. Validation checklist.**
- [ ] `md5sum` confirms identity before each migration
- [ ] Shim re-exports the identical public surface
- [ ] `npm run typecheck && npm run lint` green per PR
- [ ] Boundary invariants still clean
- [ ] Visual regression: 0 diffs

---

## 5. Typography Audit

This is the subsystem most visible in the reviewed screenshots and the cheapest to fix.

### Issue 4 — Monospace/Sans Role Inversion

**Problem.** Monospace carries *labels*; sans carries *values*. Convention is the reverse.

Observed in the Light & Env panel:
- `LIGHTING`, `ENVIRONMENT IMAGE`, `BACKGROUND COLOR`, `ENVIRONMENT INTENSITY` → mono ❌
- `SCENE LIGHTS, CAMERAS & HDR`, `scene · environment` → mono ❌
- `(none)`, `color`, `1` → sans ❌
- `#0b0d10` → mono ✅ *(the one correct assignment)*

**Root cause.** `--mono` was adopted as the "label voice" for visual texture rather than for its
functional property (fixed advance width).

**Impact.** Monospace has ~15% wider average advance at equal point size and weaker word-shape
differentiation, so it is measurably slower to read as prose. Worse, numeric values in sans lack
tabular figures — the intensity field will visibly jitter as `1` → `0.85` → `12`.

**Recommendation.**

| Role | Face | Rationale |
|---|---|---|
| Section headers, field labels, helper text, buttons | `var(--font)` | Prose — reads faster |
| Numeric inputs, hex values, IDs, coordinates, metrics | `var(--mono)` + `font-variant-numeric: tabular-nums` | Alignment and comparison |

The existing token comment already states the correct rule — *"IBM Plex Mono is the one mono face
(code · tokens · IDs · metrics)"* — it simply is not followed by the label styles.

**Priority.** High · **Complexity.** Low · **Risk.** Low (may shift label widths ~10-15%; verify no
truncation in narrow panels).

---

### Issue 5 — Universal ALL CAPS Treatment

**Problem.** 58 `text-transform: uppercase` declarations. Every field label, section header, and
eyebrow renders in caps with `--tracking-heading: 0.07em`.

**Root cause.** Applied as a global "technical UI" aesthetic rather than a hierarchy signal. Because it
is applied at *every* level, it signals nothing.

**Important note for the record:** the source strings are **already Title Case**. `Material Library`,
`Environment Image`, `Background Color`, and `Scene Lights, Cameras & HDR` are all correctly cased in
TSX. The uppercase is purely a CSS render-time transform. Any prior copy-cleanup work was therefore
correct and is being masked by the stylesheet.

**Impact.** Caps removes ascender/descender word shapes, forcing letter-by-letter parsing. At 10px with
0.07em tracking the penalties compound: small + tracked + shapeless.

**Recommendation.** Retain uppercase **only** for the section-header tier (`LIGHTING`) as a deliberate
hierarchy marker. Remove it from field labels. Reduce tracking to `--tracking-wide` (0.01em) wherever
uppercase is retained at ≤11px.

**Priority.** High · **Complexity.** Low · **Risk.** Low — labels become ~12% narrower, no truncation risk.

---

### Issue 6 — Type Scale Floor Below Legibility Threshold

**Problem.** The scale bottoms at `--text-nano: 9px`, with `--text-micro: 10px`,
`--text-mono-label: 10px`, and `--text-label-sm: 10.5px` all in active use.

**Impact.** 9–10px monospace, uppercased, with 0.07em tracking is below practical legibility for
sustained use — particularly for users over 40 and on standard-DPI displays. WCAG sets no absolute
minimum, but this fails 1.4.4 Resize Text in spirit and fails usability in practice.

**Recommendation.** Raise the floor to **11px**. Retire `--text-nano` and `--text-label-sm`; collapse
`--text-micro` / `--text-mono-label` into `--text-label: 11px`. The 13-step scale should reduce to
seven steps: 11 / 12 / 13 / 14 / 16 / 20 / 32.

**Priority.** High · **Complexity.** Low · **Risk.** Medium — a 1–2px increase across dense panels may
cause reflow. Audit fixed-height rows.

---

### Issue 7 — Flat Weight Hierarchy

**Problem.** Object name, section header, and field label render at near-identical visual weight.
Only `3D Environment & Stage` shows distinct semibold, and it sits directly beneath a competing
uppercase eyebrow.

**Recommendation.** Three explicit tiers:

| Tier | Size | Weight | Case | Face |
|---|---|---|---|---|
| Object name | 14px | 600 | Title Case | sans |
| Section header | 11px | 600 | UPPERCASE, 0.01em | sans |
| Field label | 11px | 400 | Title Case | sans |

**Priority.** High · **Complexity.** Low · **Risk.** Low.

---

### Issue 11 — Dark-Mode Optical Weight Not Compensated

**Problem.** Identical weight tokens serve both themes. Light-on-dark text optically thins; the dark
screenshot shows visibly more fragile labels and helper text than its light counterpart.

**Recommendation.** Add a dark-mode weight step in `[data-theme]`:

```css
:root { --weight-label: var(--weight-regular); }          /* 400 */
[data-theme='light'] { --weight-label: var(--weight-regular); }
/* dark is default — bump one step */
:root:not([data-theme='light']) { --weight-label: var(--weight-medium); }  /* 500 */
```

**Priority.** Medium · **Complexity.** Low · **Risk.** Low.

---

## 6. Component-Level Audit

### Forms and Inputs

| Finding | Priority | Fix |
|---|---|---|
| Numeric fields show bare values with no unit (`1` for intensity) | Medium | Add `unit` prop rendering; format as `1.0×` |
| No `font-variant-numeric: tabular-nums` on numeric inputs | Medium | Add to shared numeric field style |
| Colour swatch is ~12px — below comfortable target | Medium | Raise to 24px; add visible picker affordance |
| Dropdown empty state reads `(none)` — parses as broken/disabled | Medium | Replace with `No environment image` |
| Six drifted `Fields.tsx` copies | Critical | Consolidate (Issue 3) |

### Buttons

Byte-identical `Button.tsx` in six studios. No variant drift observed — **consolidate mechanically,
zero risk.**

### Dialogs and Modals

`ConflictModal`, `PublishModal`, `TopBarModals` each byte-identical ×6. Same disposition.
Verify focus trap and `Escape` handling once, centrally, rather than six times.

### Navigation / Tabs

Tab bar (`Transform | Mesh | Material | Light & Env`) uses correct Title Case — **this is the one place
the typographic voice is right.** Inactive-tab contrast is low in both themes; verify against 4.5:1.

### Empty States

`No scene materials yet. / Pick a preset to create one.` is correctly worded but is passive text with
no actionable control. Enterprise pattern: empty state should carry the primary action as a button.
**Note:** this crosses from copy into interaction design — flag for product sign-off before implementing.

### Loading / Error / Success States

Not systematically represented in the reviewed screenshots. **Recommend a dedicated inventory pass** —
this audit cannot assess what was not observable. Tracked as an open item, not a finding.

---

## 7. Accessibility Audit (WCAG 2.2 AA)

| Criterion | Status | Evidence |
|---|---|---|
| 1.4.3 Contrast (text) | 🟡 Partial | `contrast.test.ts` exists; helper text and inactive tabs need verification |
| 1.4.11 Non-text contrast | 🟡 Unverified | Borders/swatches not covered by existing test |
| 1.4.4 Resize text | 🔴 At risk | 9–10px floor |
| 2.1.1 Keyboard | 🔴 Fail | **48 `<div onClick>` handlers** — not focusable, no Enter/Space |
| 2.4.7 Focus visible | 🟠 Partial | 28 `:focus-visible` rules for 19k CSS lines |
| 2.5.8 Target size (24×24) | 🟡 Unverified | `--icon-btn-size-sm: 22px` is **below minimum** |
| 2.3.3 Animation from interactions | 🔴 Fail | **1** `prefers-reduced-motion` block against ~20 motion tokens |
| 4.1.2 Name, role, value | 🟢 Good | 343 `aria-label`, 237 `role` |

### Issue 8 — Keyboard-Inaccessible Controls

48 interactive `<div>` elements. Each needs either conversion to `<button>` (preferred) or
`role="button"` + `tabIndex={0}` + `onKeyDown` for Enter/Space.

**Regression risk:** converting `<div>` → `<button>` inside a flex/grid row can change layout
(button carries UA default padding, border, and `display: inline-block`). Reset explicitly:

```css
.uk-reset-button {
  all: unset;
  display: inherit;
  cursor: pointer;
}
```

### Issue 9 — Motion Preference

Single global block, added once:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Zero risk, highest accessibility return per line in this document.**

### Issue 10 — Focus Visibility

Establish one canonical ring using the existing `--shadow-focus` token, applied via a shared
`:focus-visible` rule on all interactive selectors rather than per-component.

---

## 8. Responsive Layout Audit

**Finding.** Five breakpoints total, all `max-width`, no tokens, no documented system:
`560px`, `768px`, `900px`, `1024px`, `1250px`.

**Assessment.** For a desktop-first professional creative tool this is *defensible* — this class of
application is not expected to serve phones. But the values are arbitrary and undocumented.

**Recommendation.** Tokenise and document the three that matter for this product class. Do **not**
introduce mobile layouts — that would be a redesign, which is out of scope.

```css
--bp-compact: 1024px;   /* inspector collapses to overlay */
--bp-narrow:  1280px;   /* left rail collapses to icons */
--bp-wide:    1600px;   /* dual-panel comfortable */
```

**Priority.** Medium · **Risk.** Medium — changing breakpoint values alters layout at those widths.
Tokenise at **existing values first**, rationalise separately.

---

## 9. Technical Debt Assessment

| Category | Debt | Interest Rate |
|---|---|---|
| CSS duplication | ~8,400 lines | **5× cost per style change** |
| Component duplication | 59 files | **5× cost + drift risk** |
| Token layering | 3 systems | **3× decision cost per new component** |
| Dead token declarations | ~40 lines | Low — comments already document them |
| Comment punctuation corruption | ~35 files | Cosmetic only |

**Estimated total remediation:** 9–13 engineer-days across six phases.
**Estimated annual carrying cost if unaddressed:** materially higher than remediation cost within
two quarters, given the 5× multiplier on every UI change.

---

## 10. Implementation Roadmap

Ordered by **risk-adjusted value** — cheapest and safest first, so early wins fund the harder work.

### Phase 0 — Guardrails (0.5 day, zero risk)

Nothing else starts until this lands.

1. Capture visual regression baselines: 6 studios × 2 themes × 3 viewports = **36 screenshots**.
2. Snapshot all computed `:root` custom properties for both themes to JSON.
3. Add `npm run ui:baseline` and `npm run ui:diff` scripts.

**Exit criteria:** baselines committed, diff tooling runs green against unchanged `HEAD`.

### Phase 1 — Typography and Motion (1 day, low risk, high visible impact)

Addresses every issue visible in the reviewed screenshots.

1. Add the `prefers-reduced-motion` block (Issue 9).
2. Swap mono/sans roles; add `tabular-nums` to numeric fields (Issue 4).
3. Remove `text-transform: uppercase` from field-label tier; retain for section headers at reduced
   tracking (Issue 5).
4. Raise type-scale floor to 11px (Issue 6).
5. Establish three weight tiers (Issue 7).
6. Add dark-mode weight compensation (Issue 11).
7. Raise helper-text contrast (Issue 14).

**Exit criteria:** visual diff reviewed and *accepted* (these changes are intentionally visible);
`contrast.test.ts` green.

### Phase 2 — Token Consolidation (2 days, medium risk)

1. Alias Layer A (`--bs-*`) and Layer B (Forma) to Layer C (SSOT).
2. Codemod consumers studio by studio.
3. Add Stylelint rule banning deprecated names.
4. Delete Layers A and B.

**Exit criteria:** computed-property snapshot byte-identical to Phase 0 baseline.

### Phase 3 — Component Consolidation (3 days, medium risk)

1. Migrate the 15 byte-identical families to `app/ui/components/` behind re-export shims.
2. One family per PR.
3. Reconcile the 5 drifted families individually, with written disposition per delta.

**Exit criteria:** 59 redundant files removed; typecheck, lint, boundaries green; zero visual diff.

### Phase 4 — CSS Consolidation (3 days, **highest risk**)

1. Diff and disposition `dom-studio`'s `LeftRail.css` and `Inspector.css` drift **in writing** before
   touching anything.
2. Promote `inspector.css`, `left-rail.css`, `canvas-chrome.css` to `app/ui/styles/`.
3. Per-studio override sheets for genuine differences only.
4. Land as three separate PRs.

**Exit criteria:** CSS bundle ≥40% smaller; 36 baselines within 0.1%.

### Phase 5 — Accessibility Remediation (2 days, low risk)

1. Convert 48 `<div onClick>` to semantic buttons with layout reset.
2. Canonical `:focus-visible` ring on all interactive selectors.
3. Raise `--icon-btn-size-sm` from 22px to 24px (WCAG 2.5.8).
4. Non-text contrast verification for borders and swatches.

**Exit criteria:** keyboard traversal of every panel without a mouse; axe-core clean.

### Phase 6 — Responsive Tokenisation (1 day, medium risk)

Tokenise the five existing breakpoints at current values. No behaviour change.

---

## 11. Refactoring Strategy

**Principle: shim before delete, one concern per PR, always reversible.**

1. **Never move and modify in the same commit.** A component migration commit changes location only.
   Behaviour changes come in a separate, separately-reviewed commit.
2. **Re-export shims preserve every existing import path.** No studio file needs editing to consolidate
   a component. Import-path cleanup is optional and deferrable indefinitely.
3. **Additive-then-subtractive for tokens.** Aliases land first and coexist; deletion is a final,
   independently revertible step.
4. **Per-studio rollout for anything touching CSS.** DOM Studio is largest (10,742 lines) and already
   drifted — migrate it **last**, when the pattern is proven on smaller studios.
5. **Every phase is independently shippable.** No phase depends on a later phase completing.

---

## 12. Regression Prevention Plan

| Control | Mechanism | Phase |
|---|---|---|
| Visual regression | 36 baselines, 0.1% threshold | 0 |
| Token integrity | Computed-property JSON snapshot diff | 0, 2 |
| Type safety | `npm run typecheck` per PR | All |
| Lint + boundaries | `npm run lint` per PR | All |
| Contrast | `contrast.test.ts`, extended to non-text | 1, 5 |
| Keyboard | axe-core + manual traversal | 5 |
| Bundle size | CSS byte count assertion | 4 |
| Behaviour | **No engine, store, or command-dispatch file may appear in any diff** | All |

**Hard rule:** if a PR in this programme touches `@bs/engine`, `dispatch`, `getManifest`, routing, or
any command path, it is out of scope and must be rejected. The audit's entire value proposition is
that it is visually consequential and behaviourally inert.

---

## 13. Testing and Validation Checklist

**Per PR**
- [ ] `npm run typecheck` green
- [ ] `npm run lint` green (includes boundary invariants)
- [ ] Visual diff reviewed; intentional changes explicitly accepted
- [ ] No engine/store/command file in diff
- [ ] Both themes verified
- [ ] Keyboard traversal unaffected

**Per phase**
- [ ] All 36 baselines re-captured and compared
- [ ] Computed token snapshot diffed
- [ ] `contrast.test.ts` green
- [ ] Bundle size recorded
- [ ] Rollback verified by reverting the phase's merge commit on a scratch branch

**Pre-production**
- [ ] axe-core clean across all six studios
- [ ] Manual keyboard-only traversal of every panel
- [ ] Screen-reader smoke test (NVDA or VoiceOver) on inspector and modals
- [ ] 200% zoom without horizontal scroll or clipping
- [ ] `prefers-reduced-motion: reduce` honoured
- [ ] Light and dark parity confirmed side by side

---

## 14. Production Readiness Checklist

| Criterion | Current | Target |
|---|---|---|
| Single source of truth for tokens | 🔴 3 systems | 🟢 1 |
| Zero duplicated component implementations | 🔴 59 redundant | 🟢 0 |
| Zero duplicated stylesheets | 🔴 ~8,400 lines | 🟢 0 |
| Consistent typographic hierarchy | 🔴 Flat | 🟢 3 tiers |
| WCAG 2.2 AA keyboard | 🔴 48 failures | 🟢 0 |
| WCAG 2.2 AA focus visible | 🟠 Partial | 🟢 Universal |
| Motion preference honoured | 🔴 No | 🟢 Yes |
| Theme parity | 🟡 Weight not compensated | 🟢 Compensated |
| Responsive system documented | 🔴 Ad hoc | 🟢 Tokenised |
| Colour tokenisation | 🟢 1 literal | 🟢 Maintained |
| Architectural boundaries enforced | 🟢 CI-checked | 🟢 Maintained |

---

## 15. Scope Boundaries — Explicitly Out

Flagged because they surfaced during audit but constitute **redesign, not standardisation**. Each
requires product sign-off and is **not** included in the roadmap above:

- Adding primary-action buttons to empty states (interaction design change)
- Restructuring the Transmission/Alpha Mode dependency disclosure (workflow change)
- Adding preview thumbnails to the environment-image selector (new feature)
- Any mobile or tablet layout (new responsive tier)
- Loading/error/success state design (not observable in reviewed material — needs its own inventory)

---

## 16. Open Items Requiring Decision

1. **`dom-studio` CSS drift** — is it an intentional fix or accidental divergence? Blocks Phase 4.
2. **Uppercase retention** — confirm the section-header tier keeps caps as a deliberate hierarchy
   marker, or remove entirely.
3. **9px/10px removal** — confirm no dense data view depends on the sub-11px steps.
4. **Loading/error/success states** — commission a separate inventory pass.

---

**End of Audit · Version 1.0 · 2026-08-06**
