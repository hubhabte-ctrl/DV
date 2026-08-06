/**
 * PanelSplitter   " Platform infrastructure (not studio UI).
 * Draggable panel splitter: pointer-drag resizes, double-click collapses/expands,
 * arrow keys resize (a11y separator).
 * Shared by all studios as structural plumbing (Phase 3   " audit U-7).
 */
import { setPanelDimension, togglePanelCollapsed, useUIState } from '@bs/engine';

export function PanelSplitter({ side }: { side: 'leftRail' | 'inspector' | 'timeline' }) {
  const size = useUIState((s) =>
    side === 'leftRail' ? s.leftRailW : side === 'inspector' ? s.inspectorW : s.timelineH,
  );
  const collapsed = useUIState((s) =>
    side === 'leftRail' ? s.leftRailCollapsed : side === 'inspector' ? s.inspectorCollapsed : s.timelineCollapsed,
  );

  if (side === 'timeline') {
    return (
      <div
        className="bs-splitter bs-splitter--timeline"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize timeline panel"
        title="Drag up or down to resize · double-click to collapse"
        onDoubleClick={() => togglePanelCollapsed('timeline')}
        onPointerDown={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          const startY = e.clientY;
          const startH = collapsed ? 0 : size;
          const el = e.currentTarget as HTMLElement;
          const onMove = (ev: PointerEvent) => {
            const delta = startY - ev.clientY;
            setPanelDimension('timeline', startH + delta);
          };
          const onUp = () => {
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerup', onUp);
          };
          el.addEventListener('pointermove', onMove);
          el.addEventListener('pointerup', onUp);
        }}
      />
    );
  }

  return (
    <div
      className={`bs-splitter ${side === 'leftRail' ? 'bs-splitter--left' : 'bs-splitter--right'}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={side === 'leftRail' ? 'Resize left panel' : 'Resize inspector panel'}
      aria-valuenow={collapsed ? 0 : size}
      tabIndex={0}
      title="Drag to resize · double-click to collapse"
      onDoubleClick={() => togglePanelCollapsed(side)}
      onKeyDown={(e) => {
        const dir = side === 'leftRail' ? 1 : -1;
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setPanelDimension(side, (collapsed ? 0 : size) + 16 * dir);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setPanelDimension(side, (collapsed ? 0 : size) - 16 * dir);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          togglePanelCollapsed(side);
        }
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const startX = e.clientX;
        const startW = collapsed ? 0 : size;
        const el = e.currentTarget as HTMLElement;
        const onMove = (ev: PointerEvent) => {
          const delta = (ev.clientX - startX) * (side === 'leftRail' ? 1 : -1);
          setPanelDimension(side, startW + delta);
        };
        const onUp = () => {
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerup', onUp);
        };
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onUp);
      }}
    />
  );
}
