/**
 * DomNode renderer component with Figma-like free move gesture tracking (WS2-3b).
 * Pure move from DOMViewport.tsx (IL-11 behavior-identical).
 */
import { useEffect, useRef, useState, type DragEvent } from 'react';
import {
  addDomNode,
  dispatch,
  dispatchBatch,
  findDomParent,
  getManifest,
  instantiateComponent,
  resolveStyle,
  type Command,
} from '@bs/engine';
import { getUIState, setUIState, toggleDomSelection, useUIState, type DeviceProfile } from '@bs/engine';
import { Icons } from '../../../../app/ui/Icons';
import { toast } from '../../../../app/ui/Toast';
import { createEmbedViewer } from '../../../../viewport/embedViewer';
import { MIME_COMPONENT } from '../../utils/dnd';
import { addScene3dNode } from '../../../../engine/domCanvasHelpers';
import {
  domEls,
  dropIndexFor,
  hideGuides,
  isContainerType,
  nodeFromTemplate,
  sectionRootIdOf,
  showGuideH,
  showGuideV,
  SNAP,
  stylePath,
  TEXT_TYPES,
  toCss,
  type FreeMoveGesture,
} from '../../../../engine/domTypes';

export function DOMNodeView({ id, profile }: { id: string; profile: DeviceProfile }) {
  const m = getManifest();
  const node = m.domNodes[id];
  const mode = useUIState((s) => s.mode);
  const isPreview = mode === 'preview';
  const selected = !isPreview && useUIState((s) => s.selectedDomNodeIds.includes(id));
  const [dropHint, setDropHint] = useState(false);
  if (!node) return null;


  /** screen-space insertion caret for index drops (Phase 3   " audit U-6) */
  const [dropLine, setDropLine] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  /** in-canvas text editing (Phase 3   " audit D-11): double-click to edit */
  const [editingText, setEditingText] = useState(false);
  const freeMove = useRef<FreeMoveGesture | null>(null);

  /* scene3d embed: gridless, transparent 3D scene inside the page (new_task).
     Mounted imperatively   " the viewer module is React-free (IL-3).
     Strict asset resolution: a missing URL shows an explicit error state and
     never a silently substituted model (audit A-5/AS-8). */
  const embedAsset = node.type === 'scene3d' ? m.assets.find((a) => a.id === node.assetId) : undefined;
  const embedUrl = embedAsset?.url;
  const embedVersion = embedAsset?.version;
  const mediaAsset =
    (node.type === 'image' || node.type === 'video' || node.type === 'svg') && node.assetId
      ? m.assets.find((a) => a.id === node.assetId)
      : undefined;
  useEffect(() => {
    if (node.type !== 'scene3d' || node.hidden || !embedUrl) return;
    const el = domEls.get(id);
    if (!el) return;
    // node id makes the embed track-addressable (Phase 2.8   " audit D-9)
    const viewer = createEmbedViewer(el, embedUrl, id);
    return () => viewer.dispose();
  }, [id, node.type, node.hidden, embedUrl, embedVersion]);

  if (node.hidden) return null; // hidden layers render nowhere (01 LayerSystem)
  const isRoot = m.domRootOrder.includes(id);
  const locked = Boolean(node.locked);
  const container = isContainerType(node);
  // ElementType keeps the dynamic-tag props union tractable for the ref callback
  const Tag = node.tag as unknown as React.ElementType;

  /** Insertion caret geometry for a drop at `clientY` (Phase 3   " audit U-6):
   *  horizontal line in column flow, vertical caret in row/grid flow. */
  const insertionLineFor = (containerEl: HTMLElement, clientY: number) => {
    const kids = Array.from(containerEl.children).filter((el) => el.classList.contains('bs-domnode'));
    const cs = getComputedStyle(containerEl);
    const horizontalFlow =
      cs.display === 'grid' || (cs.display === 'flex' && cs.flexDirection.startsWith('row'));
    const cr = containerEl.getBoundingClientRect();
    const index = dropIndexFor(containerEl, clientY);
    const anchor = kids[Math.min(index, kids.length - 1)]?.getBoundingClientRect();
    if (!anchor) {
      return horizontalFlow
        ? { x: cr.left + 4, y: cr.top + 4, w: 2, h: cr.height - 8 }
        : { x: cr.left + 4, y: cr.top + 4, w: cr.width - 8, h: 2 };
    }
    const after = index >= kids.length;
    return horizontalFlow
      ? { x: after ? anchor.right + 2 : anchor.left - 2, y: anchor.top, w: 2, h: anchor.height }
      : { x: cr.left + 4, y: after ? anchor.bottom + 2 : anchor.top - 2, w: cr.width - 8, h: 2 };
  };

  const onDragOver = container
    ? (e: DragEvent) => {
        if (e.dataTransfer.types.includes(MIME_COMPONENT)) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'copy';
          setDropHint(true);
          setDropLine(insertionLineFor(e.currentTarget as HTMLElement, e.clientY));
        }
      }
    : undefined;

  const onDrop = container
    ? (e: DragEvent) => {
        setDropHint(false);
        setDropLine(null);
        const componentId = e.dataTransfer.getData(MIME_COMPONENT);
        /* asset-panel + OS-file drops BUBBLE to the canvas handler (issues.md:
           sections cover the page, so swallowing them here silently broke
           Asset Studio   ' DOM Canvas drag-and-drop) */
        if (!componentId) return;
        e.preventDefault();
        e.stopPropagation();
        // 3D Scene component: free-form embed at the drop point   " every drop
        // is a new independent instance with its own id (issues.md)
        if (componentId === 'cmp-scene3d') {
          addScene3dNode(undefined, 'New Scene', e.clientX, e.clientY);
          toast('3D Scene added — assign a GLB/GLTF asset in the Inspector');
          return;
        }
        const index = dropIndexFor(e.currentTarget as HTMLElement, e.clientY);
        if (componentId) {
          // reusable component defs stamp linked instances (Phase 3   " audit D-5)
          if (getManifest().components[componentId]) {
            const rootId = instantiateComponent(componentId, id, index);
            if (rootId) {
              setUIState({ selectedDomNodeId: rootId });
              toast(`${getManifest().components[componentId].name} instance added`);
            }
            return;
          }
          const fresh = nodeFromTemplate(componentId);
          if (!fresh) {
            toast('This component has no drop template in the prototype');
            return;
          }
          if (fresh.type === 'section') {
            toast('Drop sections on the canvas background — they are top-level scroll panels');
            return;
          }
          addDomNode(id, fresh, index);
          setUIState({ selectedDomNodeId: fresh.id });
          toast(`${fresh.label} added`);
        }
      }
    : undefined;

  /*  "  "  Figma-like free move (pointer drag   ' FR-121 absolute overlay)  "  "  */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || isRoot || locked) return;
    e.stopPropagation();
    freeMove.current = {
      pid: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      active: false,
      sectionEl: null,
      baseLeft: 0,
      baseTop: 0,
      w: 0,
      h: 0,
      zoom: 1,
      peers: [],
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const fm = freeMove.current;
    if (!fm || e.pointerId !== fm.pid) return;
    const el = domEls.get(id);
    if (!el) return;
    if (!fm.active) {
      if (Math.hypot(e.clientX - fm.sx, e.clientY - fm.sy) < 4) return;
      const sectionEl = domEls.get(sectionRootIdOf(id));
      if (!sectionEl || sectionEl === el) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const zoom = getUIState().canvasZoom; // screen   ' canvas px (Phase 1.5)
      const r = el.getBoundingClientRect();
      const sr = sectionEl.getBoundingClientRect();
      fm.zoom = zoom;
      fm.baseLeft = (r.left - sr.left) / zoom;
      fm.baseTop = (r.top - sr.top) / zoom;
      fm.w = r.width / zoom;
      fm.h = r.height / zoom;
      fm.sectionEl = sectionEl;
      fm.active = true;
      const m2 = getManifest();
      const ui = getUIState();
      // multi-move (Phase 1.6): if the grabbed node is part of the selection,
      // every other selected node rides along with the same delta
      const groupIds =
        ui.selectedDomNodeIds.includes(id) && ui.selectedDomNodeIds.length > 1 ? ui.selectedDomNodeIds : [id];
      if (!ui.selectedDomNodeIds.includes(id)) setUIState({ selectedDomNodeId: id });
      const convert: Command[] = [];
      fm.peers = [];
      for (const pid of groupIds) {
        const n2 = m2.domNodes[pid];
        const el2 = domEls.get(pid);
        if (!n2 || !el2 || n2.locked || m2.domRootOrder.includes(pid)) continue;
        const sec2 = domEls.get(sectionRootIdOf(pid));
        if (!sec2 || sec2 === el2) continue;
        const r2 = el2.getBoundingClientRect();
        const sr2 = sec2.getBoundingClientRect();
        const baseLeft = (r2.left - sr2.left) / zoom;
        const baseTop = (r2.top - sr2.top) / zoom;
        if (pid !== id) fm.peers.push({ id: pid, baseLeft, baseTop });
        if (resolveStyle(n2, profile).position !== 'absolute') {
          // convert flow   ' free-form; whole gesture coalesces to one undo step
          convert.push(
            { type: 'set', path: stylePath(pid, profile, 'position'), value: 'absolute' },
            { type: 'set', path: stylePath(pid, profile, 'left'), value: Math.round(baseLeft) },
            { type: 'set', path: stylePath(pid, profile, 'top'), value: Math.round(baseTop) },
            { type: 'set', path: stylePath(pid, profile, 'width'), value: Math.round(r2.width / zoom) },
          );
        }
      }
      if (convert.length) dispatchBatch(convert, `freemove:${id}`);
      return;
    }
    const sr = fm.sectionEl!.getBoundingClientRect();
    const secW = sr.width / fm.zoom;
    const secH = sr.height / fm.zoom;
    let left = fm.baseLeft + (e.clientX - fm.sx) / fm.zoom;
    let top = fm.baseTop + (e.clientY - fm.sy) / fm.zoom;
    hideGuides();
    // snapping + alignment guides (01 SnapSystem): section edges + centres
    const hCenter = (secW - fm.w) / 2;
    if (Math.abs(left - hCenter) < SNAP) {
      left = hCenter;
      showGuideV(sr.left + sr.width / 2);
    } else if (Math.abs(left) < SNAP) {
      left = 0;
      showGuideV(sr.left);
    } else if (Math.abs(left + fm.w - secW) < SNAP) {
      left = secW - fm.w;
      showGuideV(sr.right);
    }
    const vCenter = (secH - fm.h) / 2;
    if (Math.abs(top - vCenter) < SNAP) {
      top = vCenter;
      showGuideH(sr.top + sr.height / 2);
    } else if (Math.abs(top) < SNAP) {
      top = 0;
      showGuideH(sr.top);
    } else if (Math.abs(top + fm.h - secH) < SNAP) {
      top = secH - fm.h;
      showGuideH(sr.bottom);
    }
    // anchor snaps; peers follow the snapped delta (Phase 1.6)
    const dLeft = left - fm.baseLeft;
    const dTop = top - fm.baseTop;
    const cmds: Command[] = [
      { type: 'set', path: stylePath(id, profile, 'left'), value: Math.round(left) },
      { type: 'set', path: stylePath(id, profile, 'top'), value: Math.round(top) },
    ];
    for (const peer of fm.peers) {
      cmds.push(
        { type: 'set', path: stylePath(peer.id, profile, 'left'), value: Math.round(peer.baseLeft + dLeft) },
        { type: 'set', path: stylePath(peer.id, profile, 'top'), value: Math.round(peer.baseTop + dTop) },
      );
    }
    dispatchBatch(cmds, `freemove:${id}`);
  };

  const endFreeMove = (e?: React.PointerEvent) => {
    const fm = freeMove.current;
    freeMove.current = null;
    hideGuides();
    /* cross-section drag (Phase 2.7   " audit D-7): dropping over a DIFFERENT
       section re-parents the element to that section root and re-anchors its
       coordinates; the batch coalesces into the drag = ONE undo step */
    if (!fm?.active || !e || !fm.sectionEl) return;
    const m2 = getManifest();
    const originRootId = sectionRootIdOf(id);
    let targetRootId: string | null = null;
    for (const rootId of m2.domRootOrder) {
      const el2 = domEls.get(rootId);
      if (!el2) continue;
      const r2 = el2.getBoundingClientRect();
      if (e.clientY >= r2.top && e.clientY <= r2.bottom) {
        targetRootId = rootId;
        break;
      }
    }
    if (!targetRootId || targetRootId === originRootId) return;
    const el = domEls.get(id);
    const targetEl = domEls.get(targetRootId);
    if (!el || !targetEl) return;
    const r = el.getBoundingClientRect();
    const tr = targetEl.getBoundingClientRect();
    const zoom = getUIState().canvasZoom;
    const fromParentId = findDomParent(id);
    if (!fromParentId) return;
    const cmds: Command[] = [
      { type: 'set', path: stylePath(id, profile, 'left'), value: Math.round((r.left - tr.left) / zoom) },
      { type: 'set', path: stylePath(id, profile, 'top'), value: Math.round((r.top - tr.top) / zoom) },
      {
        type: 'set',
        path: `domNodes.${fromParentId}.children`,
        value: m2.domNodes[fromParentId].children.filter((c) => c !== id),
      },
      {
        type: 'set',
        path: `domNodes.${targetRootId}.children`,
        value: [...m2.domNodes[targetRootId].children, id],
      },
    ];
    dispatchBatch(cmds, `freemove:${id}`);
    toast(`Moved into ${m2.domNodes[targetRootId].label}`);
  };

  return (
    <Tag
      data-node-id={id}
      ref={(el: unknown) => {
        if (el instanceof HTMLElement) domEls.set(id, el);
        else domEls.delete(id);
      }}
      className={`bs-domnode ${selected ? 'bs-domnode--selected' : ''} ${dropHint ? 'bs-domnode--drop' : ''} ${locked ? 'bs-domnode--locked' : ''}`}

      style={{ ...toCss(node, profile), touchAction: isRoot || isPreview ? undefined : 'none' }}
      onPointerDown={editingText || isPreview ? undefined : onPointerDown}
      onPointerMove={editingText || isPreview ? undefined : onPointerMove}
      onPointerUp={editingText || isPreview ? undefined : endFreeMove}
      onPointerCancel={editingText || isPreview ? undefined : endFreeMove}
      onDragOver={isPreview ? undefined : onDragOver}

      onDragLeave={
        container
          ? () => {
              setDropHint(false);
              setDropLine(null);
            }
          : undefined
      }
      onDrop={onDrop}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        if (locked) return; // locked = tree-selectable only
        if (e.ctrlKey || e.metaKey || e.shiftKey)
          toggleDomSelection(id); // additive (0.3)
        else setUIState({ selectedDomNodeId: id });
      }}
      onDoubleClick={(e: React.MouseEvent) => {
        // in-canvas text editing (Phase 3   " audit D-11, Figma/Webflow baseline)
        if (!TEXT_TYPES.has(node.type) || locked) return;
        e.stopPropagation();
        setEditingText(true);
      }}
    >
      {selected && <span className="bs-domnode__tag">{node.label}</span>}
      {node.type === 'scene3d' && !embedUrl && (
        <span className="bs-domnode__asset-error">
          {node.assetId
            ? `Missing 3D asset (${node.assetId}) — re-import the GLB`
            : 'Empty 3D Scene — assign a GLB/GLTF asset in the Inspector or drop one from the Assets panel'}
        </span>
      )}
      {/* media nodes render their ACTUAL asset content (Phase 1.4, audit AS-7) */}
      {(node.type === 'image' || node.type === 'svg') && mediaAsset?.url && (
        <img className="bs-domnode__media" src={mediaAsset.url} alt={node.label} draggable={false} />
      )}
      {/* asset-less vector nodes render an editable glyph (Phase 2.1   " FR-120 SVG/Icon) */}
      {node.type === 'svg' && !node.assetId && (
        <span className="bs-domnode__glyph bs-domnode__glyph--fill" aria-hidden>
          {Icons.star}
        </span>
      )}
      {node.type === 'icon' && (
        <span className="bs-domnode__glyph bs-domnode__glyph--em" aria-hidden>
          {Icons.sparkles}
        </span>
      )}
      {node.type === 'video' && mediaAsset?.url && (
        <video className="bs-domnode__media" src={mediaAsset.url} muted loop autoPlay playsInline />
      )}
      {(node.type === 'image' || node.type === 'video') && node.assetId && !mediaAsset?.url && (
        <span className="bs-domnode__asset-error">Missing media asset — re-import it</span>
      )}
      {editingText ? (
        <span
          className="bs-domnode__textedit"
          contentEditable
          suppressContentEditableWarning
          ref={(el) => {
            if (!el) return;
            el.focus();
            // place the caret at the end of the existing content
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation(); // shortcuts must not fire while typing
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              (e.currentTarget as HTMLElement).blur();
            } else if (e.key === 'Escape') {
              e.currentTarget.textContent = node.content ?? '';
              (e.currentTarget as HTMLElement).blur();
            }
          }}
          onBlur={(e) => {
            setEditingText(false);
            const next = (e.currentTarget.textContent ?? '').trim();
            if (next !== (node.content ?? '')) {
              dispatch({ type: 'set', path: `domNodes.${id}.content`, value: next });
            }
          }}
        >
          {node.content}
        </span>
      ) : (
        node.content
      )}
      {node.children.map((c) => (
        <DOMNodeView key={c} id={c} profile={profile} />
      ))}
      {/* drop insertion caret (Phase 3   " audit U-6): screen-space, zoom-safe */}
      {dropLine && (
        <span
          className="bs-dropline"
          style={{
            position: 'fixed',
            left: dropLine.x,
            top: dropLine.y,
            width: dropLine.w,
            height: dropLine.h,
          }}
          aria-hidden
        />
      )}
    </Tag>
  );
}
