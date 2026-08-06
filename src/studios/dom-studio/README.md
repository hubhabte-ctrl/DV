# DOM Studio

The DOM Studio is responsible for 2D UI authoring and HTML layout composition. It allows users to build user interfaces that overlay or interact with the 3D scene, providing tools for DOM element manipulation, styling, and structural editing.

## Architecture & Encapsulation Rules

In accordance with the Build Studio frontend architecture mandate (Docs 13 Part 3 & IL-1):

1. **Full UI Isolation:** This studio is **fully self-contained** at the UI layer. It owns its own layout (`DOMStudioRoot`), viewports, toolbars, sidebars, inspectors, context menus, and styles.
2. **Zero Cross-Studio Imports:** 
   - **DO NOT** import UI components, CSS, layouts, or presentation logic from `dom-studio` into any other studio.
   - **DO NOT** import UI components from other studios (e.g., `scene3d-studio`, `material-studio`) into `dom-studio`.
3. **Shared Infrastructure:** If a utility, function, or engine abstraction is genuinely needed by multiple studios, it must be pushed down into the platform infrastructure layer (`app/ui/` or `engine/`).

## Key Files
- `DOMStudioRoot.tsx`: The standalone entry point and layout for this studio.
- `components/`: Contains all studio-specific UI components, including localized shared UI like `Button.tsx` and `Icons.tsx`.
- `styles/`: Contains all CSS required to render this studio.
