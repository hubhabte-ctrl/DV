# Scene3D Studio

The Scene3D Studio is the core spatial composition environment. It allows users to place, manipulate, and organize 3D objects, lights, and cameras in real-time, providing deep access to the 3D scene hierarchy.

## Architecture & Encapsulation Rules

In accordance with the Build Studio frontend architecture mandate (Docs 13 Part 3 & IL-1):

1. **Full UI Isolation:** This studio is **fully self-contained** at the UI layer. It owns its own layout (`Scene3DStudioRoot`), 3D viewports, toolbars, sidebars, inspectors, modals, context menus, and styles.
2. **Zero Cross-Studio Imports:** 
   - **DO NOT** import UI components, CSS, layouts, or presentation logic from `scene3d-studio` into any other studio.
   - **DO NOT** import UI components from other studios (e.g., `dom-studio`, `material-studio`) into `scene3d-studio`.
3. **Shared Infrastructure:** If a utility, function, or engine abstraction is genuinely needed by multiple studios, it must be pushed down into the platform infrastructure layer (`app/ui/` or `engine/`).

## Key Files
- `Scene3DStudioRoot.tsx`: The standalone entry point and layout for this studio.
- `components/`: Contains all studio-specific UI components, including localized shared UI like `Button.tsx` and `Icons.tsx`.
- `styles/`: Contains all CSS required to render this studio.
