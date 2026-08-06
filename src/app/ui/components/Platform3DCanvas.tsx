import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createViewport, type ViewportHandle } from '../../../viewport/runtime';
import { registerViewport } from '../../../viewport/handleRegistry';
import { setUIState, toggleSceneSelection, useUIState } from '@bs/engine';

export interface Platform3DCanvasProps {
  navigation: 'editor' | 'track';
  chrome?: boolean;
  children?: ReactNode;
  onDragOver?: (e: React.DragEvent, handle: ViewportHandle) => void;
  onDrop?: (e: React.DragEvent, handle: ViewportHandle) => void;
  onContextMenu?: (e: React.MouseEvent, handle: ViewportHandle) => void;
}

export function Platform3DCanvas({
  navigation,
  chrome = true,
  children,
  onDragOver,
  onDrop,
  onContextMenu,
}: Platform3DCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<ViewportHandle | null>(null);
  const [stats, setStats] = useState({ frameMs: 0, drawCalls: 0, triangles: 0 });

  const selectedSceneNodeId = useUIState((s) => s.selectedSceneNodeId);
  const selectedSceneNodeIds = useUIState((s) => s.selectedSceneNodeIds);
  const tool = useUIState((s) => s.tool);
  const space = useUIState((s) => s.space);

  useEffect(() => {
    if (!hostRef.current) return;
    const handle = createViewport(hostRef.current, {
      onSelect: (nodeId: string | null, additive: boolean) => {
        if (additive && nodeId) toggleSceneSelection(nodeId);
        else setUIState({ selectedSceneNodeId: nodeId });
      },
      overlayEl: overlayRef.current ?? undefined,
    });
    handleRef.current = handle;
    registerViewport(handle);
    handle.setNavigation(navigation);
    handle.setChrome(chrome);
    const timer = setInterval(() => setStats(handle.getStats()), 500);
    return () => {
      clearInterval(timer);
      registerViewport(null);
      handle.dispose();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => handleRef.current?.setNavigation(navigation), [navigation]);
  useEffect(() => handleRef.current?.setChrome(chrome), [chrome]);
  useEffect(
    () => handleRef.current?.setSelected(selectedSceneNodeId, selectedSceneNodeIds),
    [selectedSceneNodeId, selectedSceneNodeIds],
  );
  useEffect(() => handleRef.current?.setTool(tool), [tool]);
  useEffect(() => handleRef.current?.setSpace(space), [space]);

  return (
    <div
      className={`bs-viewport ${chrome ? '' : 'bs-viewport--clean'}`}
      ref={hostRef}
      onDragOver={(e) => {
        if (onDragOver && handleRef.current) onDragOver(e, handleRef.current);
      }}
      onDrop={(e) => {
        if (onDrop && handleRef.current) onDrop(e, handleRef.current);
      }}
      onContextMenu={(e) => {
        if (onContextMenu && handleRef.current) onContextMenu(e, handleRef.current);
      }}
    >
      <div className="bs-viewport__overlay" ref={overlayRef} />
      {children}
      {navigation === 'editor' && chrome && (
        <>
          <div className="bs-fps">
            {stats.frameMs > 0 ? `${Math.round(1000 / Math.max(stats.frameMs, 1))} fps` : '-'}
          </div>
          <div className="bs-layerbadges">
            <span className="bs-layerbadge bs-layerbadge--scene">
              <span className="bs-layerbadge__dot" />
              3D SCENE * ACTIVE
            </span>
          </div>
          <div className="bs-viewport__stats">
            {stats.frameMs.toFixed(1)} ms * {stats.drawCalls} calls * {(stats.triangles / 1000).toFixed(0)}k tris
          </div>
        </>
      )}
    </div>
  );
}
