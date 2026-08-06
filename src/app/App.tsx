import { useUIState } from '@bs/engine';
import { DOMStudioRoot } from '../studios/dom-studio/DOMStudioRoot';
import { Scene3DStudioRoot } from '../studios/scene3d-studio/Scene3DStudioRoot';
import { AnimateStudioRoot } from '../studios/animate-studio/AnimateStudioRoot';
import { MaterialStudioRoot } from '../studios/material-studio/MaterialStudioRoot';
import { AssetStudioRoot } from '../studios/asset-studio/AssetStudioRoot';
import { PreviewStudioRoot } from '../studios/preview-studio/PreviewStudioRoot';
import { ToastHost } from './ui/Toast';

export default function App() {
  const mode = useUIState((s) => s.mode);

  return (
    <>
      {mode === 'dom' && <DOMStudioRoot />}
      {mode === '3d' && <Scene3DStudioRoot />}
      {mode === 'animate' && <AnimateStudioRoot />}
      {mode === 'material' && <MaterialStudioRoot />}
      {mode === 'assets' && <AssetStudioRoot />}
      {mode === 'preview' && <PreviewStudioRoot />}
      <ToastHost />
    </>
  );
}
