# Preview Studio

The Preview Studio provides a presentation layer for the final experience. It strips away authoring tools, exposing only what an end-user or reviewer would see, allowing for accurate interactive previews of the composed 3D scene and 2D UI.

## Architecture & Encapsulation Rules

In accordance with the Build Studio frontend architecture mandate (Docs 13 Part 3 & IL-1):

1. **Full UI Isolation:** This studio is **fully self-contained** at the UI layer. It owns its own layout (`PreviewStudioRoot`), viewports, and styles.
2. **Zero Cross-Studio Imports:** 
   - **DO NOT** import UI components, CSS, layouts, or presentation logic from `preview-studio` into any other studio.
   - **DO NOT** import UI components from other studios (e.g., `scene3d-studio`) into `preview-studio`. It utilizes the `Platform3DCanvas` from the infrastructure layer rather than importing the Scene3D viewport directly.
3. **Shared Infrastructure:** If a utility, function, or engine abstraction is genuinely needed by multiple studios, it must be pushed down into the platform infrastructure layer (`app/ui/` or `engine/`).

## Key Files
- `PreviewStudioRoot.tsx`: The standalone entry point and layout for this studio.
- `components/`: Contains all studio-specific UI components.
- `styles/`: Contains all CSS required to render this studio.
