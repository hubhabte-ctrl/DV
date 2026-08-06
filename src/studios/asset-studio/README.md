# Asset Studio

The Asset Studio is responsible for managing, organizing, and preparing all resources and assets used within the Build Studio. This includes 3D models, images, videos, audio, fonts, textures, and HDR environments.

## Architecture & Encapsulation Rules

In accordance with the Build Studio frontend architecture mandate (Docs 13 Part 3 & IL-1):

1. **Full UI Isolation:** This studio is **fully self-contained** at the UI layer. It owns its own layout (`AssetStudioRoot`), workspaces, toolbars, sidebars, modals, context menus, and styles.
2. **Zero Cross-Studio Imports:** 
   - **DO NOT** import UI components, CSS, layouts, or presentation logic from `asset-studio` into any other studio.
   - **DO NOT** import UI components from other studios (e.g., `scene3d-studio`, `dom-studio`) into `asset-studio`.
3. **Shared Infrastructure:** If a utility, function, or engine abstraction is genuinely needed by multiple studios, it must be pushed down into the platform infrastructure layer (`app/ui/` or `engine/`).

## Key Files
- `AssetStudioRoot.tsx`: The standalone entry point and layout for this studio.
- `components/`: Contains all studio-specific UI components, including localized shared UI like `Button.tsx` and `Icons.tsx`.
- `styles/`: Contains all CSS required to render this studio.
