/**
 * Generic tree/list   " powers DOM layer tree and 3D scene hierarchy (Doc 05   3/  5).
 * Inline action icons have been moved to the right-click context menu to reduce
 * visual noise and provide more room for layer/object names.
 * Selection: `selectedId` is the anchor; `selectedIds` (optional) renders the
 * full multi-selection (01 SelectionSystem). Click events pass through to
 * `onSelect` so callers can implement Ctrl/Shift additive selection.
 *
 * Collapse: session-transient only (never persisted in manifest   " ObjectHierarchy   1/  5).
 * `hasChildren` items show a chevron toggle. When collapsed, all descendants are
 * hidden from the rendered list. The Tree owns the collapsed set internally; callers
 * can optionally seed it via `defaultCollapsed`.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Icons } from '../../../../app/ui/Icons';

export interface TreeItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  depth: number;
  hidden?: boolean;
  locked?: boolean;
  /** rows accepting drag-reparent drops (containers/groups) */
  droppable?: boolean;
  tagText?: string;
  tagType?: 'dom' | 'scene';
  /** DOMViewportControls the selection highlight colour   " independent of tagType/tagText badge.
   *  'scene' = amber (bs-node--sel-scene); 'dom' = teal (bs-node--sel). */
  nodeKind?: 'dom' | 'scene';
  /** For mesh nodes: the bound material id in the manifest (scene mode only) */
  materialId?: string;
  /** Display name of the bound material (shown as secondary badge) */
  materialName?: string;
  /** True when the node has children   " enables the chevron collapse toggle */
  hasChildren?: boolean;
  /**
   * Parent id in the flat list   " used by the Tree to identify descendants that
   * must be hidden when an ancestor is collapsed. Set by flattenScene/flattenDom.
   */
  parentId?: string | null;
}

const MIME_TREE = 'application/x-bs-treenode';

function RenameInput({ value, onCommit }: { value: string; onCommit: (v: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      className="uk-input uk-tree__rename"
      defaultValue={value}
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => onCommit(e.target.value.trim() || null)}
      onKeyDown={(e: any) => {
        if (e.key === 'Enter') onCommit((e.target as HTMLInputElement).value.trim() || null);
        else if (e.key === 'Escape') onCommit(null);
        e.stopPropagation();
      }}
    />
  );
}

/** Chevron for collapse toggle */
function Chevron({ collapsed }: { collapsed: boolean }) {
  return (
    <span
      className="uk-tree__chevron"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 14,
        height: 14,
        flexShrink: 0,
        transition: 'transform 0.15s ease',
        transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
        opacity: 0.7,
      }}
    >
      {Icons.chevronDown ?? ' - '}
    </span>
  );
}

export function Tree({
  items,
  selectedId,
  selectedIds,
  onSelect,
  onToggleHidden,
  onToggleLocked,
  onRename,
  onDuplicate,
  onDelete,
  onDropInto,
  onReorder,
  onContextMenu,
  filter,
  defaultCollapsed,
}: {
  items: TreeItem[];
  selectedId: string | null;
  /** full multi-selection (optional); `selectedId` remains the anchor */
  selectedIds?: string[];
  onSelect: (id: string, e: React.MouseEvent) => void;
  onToggleHidden?: (id: string) => void;
  onToggleLocked?: (id: string) => void;
  /** double-click rename commit (label edits are commands   " IL-1) */
  onRename?: (id: string, label: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** drag-reparent: dropped `dragId` onto droppable row `targetId` */
  onDropInto?: (dragId: string, targetId: string) => void;
  /** sibling reorder (Phase 3   " 01 LayerSystem): drop on a row's top/bottom
   *  edge inserts before/after it; the middle keeps reparent-into semantics */
  onReorder?: (dragId: string, targetId: string, edge: 'before' | 'after') => void;
  /** Right-click on a row   " caller is responsible for rendering the context menu */
  onContextMenu?: (id: string, x: number, y: number) => void;
  filter?: string;
  /** IDs to start collapsed (session-transient; defaults to none) */
  defaultCollapsed?: string[];
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [dropEdge, setDropEdge] = useState<'before' | 'after' | 'into' | null>(null);
  // Session-transient collapse state (never persisted   " ObjectHierarchy   1/  5)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(
    () => new Set(defaultCollapsed ?? []),
  );
  const rootRef = useRef<HTMLDivElement>(null);

  /* scroll-to-selection (Phase 3   " 01 LayerSystem): selecting in the canvas /
     viewport reveals the row */
  useEffect(() => {
    if (!selectedId) return;
    rootRef.current
      ?.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(selectedId)}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  const toggleCollapsed = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** Edge zones: top/bottom 30% = sibling insert; middle = reparent-into. */
  const edgeFor = (e: React.DragEvent, droppable?: boolean): 'before' | 'after' | 'into' | null => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const rel = (e.clientY - r.top) / r.height;
    if (onReorder && rel < 0.3) return 'before';
    if (onReorder && rel > 0.7) return 'after';
    return onDropInto && droppable ? 'into' : onReorder ? (rel < 0.5 ? 'before' : 'after') : null;
  };

  //  "  "  Filter and collapse culling  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  "  " 
  const q = filter?.trim().toLowerCase();

  // Build a set of all collapsed ancestor ids so we can hide descendants.
  // We walk items in order (parents always come before children in the flat list)
  // and track which ids have a collapsed ancestor.
  const hiddenByCollapse = new Set<string>();
  if (!q) {
    // Build parent   ' children set mapping from parentId metadata on each item
    for (const item of items) {
      if (item.parentId && (collapsedIds.has(item.parentId) || hiddenByCollapse.has(item.parentId))) {
        hiddenByCollapse.add(item.id);
      }
    }
  }

  const visible = q
    ? items.filter((i) => i.label.toLowerCase().includes(q))
    : items.filter((i) => !hiddenByCollapse.has(i.id));

  return (
    <div className="uk-tree" role="tree" ref={rootRef}>
      {visible.map((item) => {
        const isSelected = item.id === selectedId || (selectedIds?.includes(item.id) ?? false);
        const rowEdge = dropId === item.id ? dropEdge : null;
        const isCollapsed = collapsedIds.has(item.id);
        const indentPx = 8 + (q ? 0 : item.depth) * 14;

        return (
          <div
            key={item.id}
            data-tree-id={item.id}
            role="treeitem"
            aria-selected={isSelected}
            aria-expanded={item.hasChildren ? !isCollapsed : undefined}
            className={`uk-tree__row bs-node ${
              isSelected ? ((item.tagType === 'scene' || item.nodeKind === 'scene') ? 'bs-node--sel-scene' : 'bs-node--sel') : ''
            } ${
              item.hidden ? 'uk-tree__row--hidden' : ''
            } ${rowEdge === 'into' ? 'uk-tree__row--drop' : ''} ${
              rowEdge === 'before' ? 'uk-tree__row--insert-before' : ''
            } ${rowEdge === 'after' ? 'uk-tree__row--insert-after' : ''}`}
            style={{ paddingLeft: indentPx }}
            onClick={(e) => onSelect(item.id, e)}
            onDoubleClick={() => onRename && setRenamingId(item.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(item.id, e as any);
              onContextMenu?.(item.id, e.clientX, e.clientY);
            }}
            draggable={(!!onDropInto || !!onReorder) && !item.locked}
            onDragStart={(e: any) => {
              e.dataTransfer.setData(MIME_TREE, item.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e: any) => {
              if (!(onDropInto || onReorder) || !e.dataTransfer.types.includes(MIME_TREE)) return;
              const edge = edgeFor(e, item.droppable);
              if (!edge) return;
              e.preventDefault();
              setDropId(item.id);
              setDropEdge(edge);
            }}
            onDragLeave={() => setDropId((d) => (d === item.id ? null : d))}
            onDrop={(e: any) => {
              e.preventDefault();
              const edge = edgeFor(e, item.droppable);
              setDropId(null);
              setDropEdge(null);
              const dragId = e.dataTransfer.getData(MIME_TREE);
              if (!dragId || dragId === item.id || !edge) return;
              if (edge === 'into') onDropInto?.(dragId, item.id);
              else onReorder?.(dragId, item.id, edge);
            }}
          >
            {/* Drag grip   " SSOT DRAG_GRIP (App.ts:386); shown only when row is draggable.
               T4.7: hidden by default, appears on row hover via CSS. */}
            {(!!onDropInto || !!onReorder) && !item.locked && (
              <span className="drag-handle" title="Drag to reorder" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="10" height="10">
                  <circle cx="9" cy="5" r="1.2" fill="currentColor"/>
                  <circle cx="15" cy="5" r="1.2" fill="currentColor"/>
                  <circle cx="9" cy="12" r="1.2" fill="currentColor"/>
                  <circle cx="15" cy="12" r="1.2" fill="currentColor"/>
                  <circle cx="9" cy="19" r="1.2" fill="currentColor"/>
                  <circle cx="15" cy="19" r="1.2" fill="currentColor"/>
                </svg>
              </span>
            )}

            {/* Collapse chevron   " only for nodes with children */}
            {item.hasChildren ? (
              <span
                className="uk-tree__chevron-wrap"
                style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
                onClick={(e: any) => {
                  e.stopPropagation();
                  toggleCollapsed(item.id);
                }}
                title={isCollapsed ? 'Expand' : 'Collapse'}
              >
                <Chevron collapsed={isCollapsed} />
              </span>
            ) : (
              <span style={{ display: 'inline-block', width: 14, flexShrink: 0 }} />
            )}

            <span className="uk-tree__icon bs-node__tw">{item.icon}</span>

            {renamingId === item.id ? (
              <RenameInput
                value={item.label}
                onCommit={(v) => {
                  setRenamingId(null);
                  if (v !== null && v !== item.label) onRename?.(item.id, v);
                }}
              />
            ) : (
              <span className="uk-tree__label bs-node__lab">
                {item.label}
                {/* T4.8: lbl-count child count   " shown for group/container nodes (SSOT App.ts:396) */}
                {item.hasChildren && item.droppable && (
                  <span className="lbl-count">({item.depth === 0
                    ? (items.filter(i => i.parentId === item.id).length)
                    : (items.filter(i => i.parentId === item.id).length)})</span>
                )}
              </span>
            )}

            {/* Type badge */}
            {item.tagText && (
              <span className={`bs-node__tag bs-node__tag--${item.tagType ?? 'dom'}`}>
                {item.tagText}
              </span>
            )}

            {/* Material badge   " shown for mesh nodes when a material is bound */}
            {item.materialName && (
              <span
                className="bs-node__tag bs-node__tag--mat"
                title={`Material: ${item.materialName}${item.materialId ? ` (${item.materialId})` : ''}`}
                style={{
                  maxWidth: 80,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {item.materialName}
              </span>
            )}

            {/* Locked & Hidden indicator badges   " read-only visual status */}
            {item.locked && (
              <span
                className="bs-node__status-badge"
                title="Locked - right-click to unlock"
                style={{ opacity: 0.5, marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: 4 }}
              >
                {Icons.lock}
              </span>
            )}
            {item.hidden && !item.locked && (
              <span
                className="bs-node__status-badge"
                title="Hidden - right-click to show"
                style={{ opacity: 0.4, marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: 4 }}
              >
                {Icons.eyeOff}
              </span>
            )}
          </div>
        );
      })}
      {visible.length === 0 && (
        <div className="uk-tree__row bs-muted" style={{ paddingLeft: 12 }}>
          No matches
        </div>
      )}
    </div>
  );
}
