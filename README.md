# Build Studio — Frontend SPA & Design System

> **Governing Specifications**: Formally governed by [`AGENTS.md`](../AGENTS.md), the 13-document core suite (`core/01` through `13`), and the subsystem master index [`docs/core/specs/00_INDEX.md`](../docs/core/specs/00_INDEX.md). Traced specifically to **Doc 05 (UX/UI Design Specification)**, **Doc 04 (Technical Design Specification)**, **Doc 13 (Engineering Constitution)** §Part 3 (Iron Laws IL-1..13), **Doc 05 §10 (UI Kit & Tokens)**, **FR-191 (Design Tokens)**, and **PRD-INV-02 / ADR-002**.

---

## 1. Overview

The `frontend` workspace is the standalone, high-performance visual editing web app for **Build Studio SaaS**. It houses the 5 core studio environments plus the chrome-free Preview surface, an imperative Three.js WebGL rendering pipeline, an animation engine, and a unified OKLCH design system token suite.

### Core Studio UIs
1. **DOM Canvas Studio**: Interactive WYSIWYG section & element visual editor with device profile breakpoints.
2. **3D Scene Studio**: Three.js WebGL viewport with free-orbit camera controls and 3D transform gizmos.
3. **Animate Studio**: Value-vs-time keyframe track graph editor with custom bezier curve easing handles.
4. **Material Studio**: PBR shader channel editor (BaseColor, Metallic, Roughness, Normal, AO, Emission).
5. **Asset Studio**: Asset library browser, upload zone, and metadata inspector.
6. **Preview**: Chrome-free scroll-driven output surface (also the standalone runtime build target).

> There is **no UI Kit Gallery studio** (Spec 07 §2, ruling E-A). A design-system reference surface is planned post-MVP as a Help-menu surface, spec-first per `AGENTS.md` §1.

---

## 2. Directory Structure

```
frontend/
├── index.html                      # HTML5 entry point & Google Fonts loader (Inter & IBM Plex Mono)
├── package.json                    # Workspace dependencies & script definitions
├── tsconfig.json                   # Path aliases (@bs/ui-kit, @bs/engine, @bs/runtime, @bs/schema, @bs/services)
├── vite.config.ts                  # Vite 8 bundler, proxy fallback, & path alias resolution (port 5175)
├── public/                         # Public static assets & seed golden manifest
├── src/                            # Main application shell & studios
│   ├── main.tsx                    # Bootstrapper & React mount
│   ├── App.tsx                     # Top-level 5-region grid shell layout (.bs-shell)
│   ├── shell/                      # Studio UIs, topbar, sidebars, modal dialogs, & canvas contexts
│   │   ├── canvas/                 # Hit-testing, context menus, & ruler overlays
│   │   └── inspector/              # Property inspectors (Dom, 3D, Material, Asset, Keyframe)
│   ├── engine/                     # Store, command bus (IL-1), cloud sync, & IndexedDB storage
│   ├── viewport/                   # Imperative WebGL & DOM Canvas runtime (runtime.ts, embedViewer.ts)
│   └── templates/                  # Starter project templates
└── packages/                       # Workspace internal packages
    ├── ui-kit/                     # Shared UI components, tokens.json, applyTokens.ts, uikit.css, global.css
    ├── engine/                     # Keyframe evaluator re-exports
    ├── runtime/                    # Progress clock [0,1] & offscreen WebGL context embed pool
    ├── schema/                     # Manifest JSON schemas
    └── services/                   # Fastify backend API client & sync handlers
```

---

## 3. Styling Architecture & Design System

The application uses a single-sourced, token-driven CSS architecture:

- **Tokens Source (`tokens.json`)**: The **single source of token values** — typography, font sizes, OKLCH colors, spacing, radii, shadows, z-indices, and the Forma semantic theme sets (`forma.shared` / `forma.light` / `forma.dark`).
- **Dynamic Injection (`applyTokens.ts`)**: Value-free loader. Flattens `tokens.json` groups into `--bs-*` custom properties, applies the `forma.*` theme set for the active theme, and sets `data-theme="dark|light"`. Legacy `--bs-*` properties map dynamically to canonical Forma tokens (`var(--shell)`, `var(--surface)`, `var(--ink)`, `var(--accent)`, `var(--border)`). **Do not add literal values to `applyTokens.ts`** — edit `tokens.json`.
- **Global Stylesheet (`global.css`)**: Defines typography resets, BEM layout helper classes (`.bs-flex-col`, `.bs-field-input`, `.bs-modal-card`), grid tracks, and `.bs-*` shell styling.
- **Component Stylesheet (`uikit.css`)**: Encapsulates design system `.uk-*` component classes (`.uk-btn`, `.uk-input`, `.uk-chip`, `.uk-tree`, `.bs-modal`).

---

## 4. Non-Negotiable Invariants

Per **Doc 13 (Engineering Constitution)**:

1. **Command Engine Boundary (IL-1)**: Every manifest mutation must dispatch through the command engine. React components never mutate state directly.
2. **Canonical Progress Clock `[0,1]` (PRD-INV-01 / IL-2)**: Single imperative progress clock owned by `@bs/runtime`. GSAP or React never own the time state.
3. **Imperative Three.js WebGL Runtime (PRD-INV-02 / IL-3)**: Three.js operates strictly imperatively outside React render loops. No React Three Fiber in the runtime.
4. **WebGL Background Token Linkage**: `getBgColor()` in `runtime.ts` queries the computed `--shell` CSS variable dynamically so WebGL canvas background matches the active OKLCH theme.

---

## 5. Development & Scripts

From the `frontend` directory (or using monorepo scripts):

```bash
# Start Vite dev server on port 5175
npm run dev

# Run TypeScript typecheck (0 errors invariant)
npm run typecheck

# Build client production bundle
npm run build

# Run linter
npm run lint
```

### Server Ports Reference
- **Frontend SPA**: `http://localhost:5175`
- **Data Backend API**: `http://localhost:4174`
- **Auth Service**: `http://localhost:4175`
