import { useState } from 'react';
import { Tree, type TreeItem } from '../common/Tree';
import { Icons } from '../../../../app/ui/Icons';
import { DOMContextMenu } from '../common/DOMContextMenu';
import { toast } from '../../../../app/ui/Toast';
import {
  addWaypoint,
  componentInstances,
  dispatch,
  duplicateDomNode,
  duplicateSection,
  getManifest,
  moveDomNode,
  moveDomNodeBeside,
  removeComponentDef,
  removeDomNode,
  removeSection,
  removeWaypoint,
  reorderSections,
  setStageProp,
  setWaypointProp,
  setUIState,
  toggleDomSelection,
  useUIState,
  type DomNode,
} from '@bs/engine';
import { getProgress } from '../../../../engine/progress';
import { getComponentLibrary } from '@bs/services/appData';
import { MIME_COMPONENT } from '../../utils/dnd';
import { STARTER_TEMPLATES, importStarterTemplate } from '../../../../templates/starterTemplates';

const DOM_ICON: Record<string, React.ReactNode> = {
  section: Icons.section,
  container: Icons.container,
  heading: Icons.heading,
  text: Icons.text,
  button: Icons.buttonEl,
  image: Icons.image,
  scene3d: Icons.cube,
};

const TOOLBOX_ICON: Record<string, React.ReactNode> = {
  'cmp-section': Icons.section,
  'cmp-container': Icons.container,
  'cmp-flex': Icons.flex,
  'cmp-grid': Icons.grid,
  'cmp-heading': Icons.heading,
  'cmp-text': Icons.text,
  'cmp-link': Icons.link,
  'cmp-button': Icons.buttonEl,
  'cmp-image': Icons.image,
  'cmp-scene3d': Icons.cube,
  'cmp-video': Icons.video,
  'cmp-svg': Icons.shapes,
  'cmp-icon': Icons.sparkles,
  'cmp-nav': Icons.navigation,
  'cmp-footer': Icons.footer,
  'cmp-custom': Icons.braces,
  'cmp-waypoint': Icons.anchor,
};

function flattenDom(): TreeItem[] {
  const m = getManifest();
  const out: TreeItem[] = [];

  if (m.domRootOrder.length > 0) {
    out.push({
      id: '__stage__',
      label: m.stage.label,
      icon: Icons.cube,
      depth: 0,
      hidden: !m.stage.visible,
      locked: false,
      droppable: false,
      tagText: m.stage.mode === 'full' ? 'full page' : (m.sections.find((s) => s.id === m.stage.sectionId)?.name ?? 'section'),
      tagType: 'dom',
      hasChildren: false,
      parentId: null,
    });
  }

  const placedWpIds = new Set<string>();

  const walk = (id: string, depth: number, parentId: string | null) => {
    const n: DomNode = m.domNodes[id];
    if (!n) return;

    const section = m.sections.find((sec) => sec.rootDomNodeId === id);
    const sectionWps = section
      ? (m.waypoints ?? []).filter(
          (wp) => wp.range[0] >= section.range[0] && wp.range[1] <= section.range[1],
        )
      : [];

    sectionWps.forEach((wp) => placedWpIds.add(wp.id));

    const hasChildren =
      (n.children && n.children.length > 0) || sectionWps.length > 0;

    out.push({
      id,
      label: n.label,
      icon: DOM_ICON[n.type] ?? Icons.container,
      depth,
      hidden: n.hidden,
      locked: n.locked,
      droppable: n.type === 'section' || n.type === 'container',
      tagText: section ? `${section.range[0]}  "${section.range[1]}` : n.type,
      tagType: 'dom',
      hasChildren,
      parentId,
    });

    n.children?.forEach((c) => walk(c, depth + 1, id));

    if (section) {
      sectionWps.forEach((wp) => {
        out.push({
          id: wp.id,
          label: wp.label,
          icon: Icons.anchor,
          depth: depth + 1,
          hidden: false,
          locked: false,
          droppable: false,
          tagText: `  ' ${wp.anchorId}`,
          tagType: 'dom',
          hasChildren: false,
          parentId: id,
        });
      });
    }
  };

  m.domRootOrder.forEach((id) => walk(id, 0, null));

  const unplaced = (m.waypoints ?? []).filter((wp) => !placedWpIds.has(wp.id));
  unplaced.forEach((wp) => {
    out.push({
      id: wp.id,
      label: wp.label,
      icon: Icons.anchor,
      depth: 0,
      hidden: false,
      locked: false,
      droppable: false,
      tagText: `  ' ${wp.anchorId}`,
      tagType: 'dom',
      hasChildren: false,
      parentId: null,
    });
  });

  return out;
}

export interface RailPanelProps {
  tab: string;
  search: string;
}

export function DOMSidebar({ tab, search }: RailPanelProps) {
  const selDom = useUIState((s) => s.selectedDomNodeId);
  const selDomIds = useUIState((s) => s.selectedDomNodeIds);
  const selWp = useUIState((s) => s.selectedWaypointId);
  const stageSelected = useUIState((s) => s.stageSelected);
  const m = getManifest();
  const [layerCtxMenu, setLayerCtxMenu] = useState<{ x: number; y: number; targetId: string | null } | null>(null);

  if (tab === 'layers') {
    return (
      <>
        <Tree
          items={flattenDom()}
        selectedId={stageSelected ? '__stage__' : selWp ? selWp : selDom}
        selectedIds={selDomIds}
        onSelect={(id, e) => {
          if (id === '__stage__') {
            setUIState({ stageSelected: true, selectedDomNodeId: null, selectedWaypointId: null });
            return;
          }
          const wp = (m.waypoints ?? []).find((w) => w.id === id);
          if (wp) {
            setUIState({ selectedWaypointId: wp.id, selectedDomNodeId: null, stageSelected: false });
            // Use window interface to call setProgress dynamically without circular import problems
            import('../../../../engine/progress').then(p => p.setProgress((wp.range[0] + wp.range[1]) / 2));
            if (wp.anchorId && m.sceneNodes[wp.anchorId]) {
              setUIState({ selectedSceneNodeId: wp.anchorId });
            }
            return;
          }
          if (e.ctrlKey || e.metaKey || e.shiftKey) {
            toggleDomSelection(id);
          } else {
            setUIState({ selectedDomNodeId: id, selectedWaypointId: null, stageSelected: false });
          }
        }}
        onToggleHidden={(id) => {
          if (id === '__stage__') {
            setStageProp('visible', !m.stage.visible);
            return;
          }
          if (m.domNodes[id]) {
            dispatch({
              type: 'set',
              path: `domNodes.${id}.hidden`,
              value: !m.domNodes[id].hidden,
            });
          }
        }}
        onToggleLocked={(id) => {
          if (m.domNodes[id]) {
            dispatch({
              type: 'set',
              path: `domNodes.${id}.locked`,
              value: !m.domNodes[id].locked,
            });
          }
        }}
        onRename={(id, label) => {
          if (id === '__stage__') {
            setStageProp('label', label);
            return;
          }
          const wp = (m.waypoints ?? []).find((w) => w.id === id);
          if (wp) {
            setWaypointProp(id, 'label', label);
            return;
          }
          if (m.domNodes[id]) {
            dispatch({ type: 'set', path: `domNodes.${id}.label`, value: label });
          }
        }}
        onDuplicate={(id) => {
          const section = m.sections.find((s) => s.rootDomNodeId === id);
          if (section) {
            const rootId = duplicateSection(section.id);
            if (rootId) {
              setUIState({ selectedDomNodeId: rootId });
              toast('Section duplicated — scroll ranges redistributed');
            }
            return;
          }
          const newId = duplicateDomNode(id);
          if (newId) setUIState({ selectedDomNodeId: newId });
        }}
        onDelete={(id) => {
          const section = m.sections.find((s) => s.rootDomNodeId === id);
          if (section) {
            if (removeSection(section.id)) {
              if (selDom === id) setUIState({ selectedDomNodeId: null });
              toast('Section deleted — Ctrl+Z restores it; ranges redistributed');
            } else {
              toast('The page keeps at least one section');
            }
            return;
          }
          const wp = (m.waypoints ?? []).find((w) => w.id === id);
          if (wp) {
            removeWaypoint(id);
            toast('Waypoint removed');
            return;
          }
          if (removeDomNode(id)) {
            if (selDom === id) setUIState({ selectedDomNodeId: null });
            toast('Node deleted — Ctrl+Z restores the subtree');
          }
        }}
        onDropInto={(dragId, targetId) => {
          if (m.domNodes[targetId]) {
            moveDomNode(dragId, targetId, m.domNodes[targetId].children.length);
            setUIState({ selectedDomNodeId: dragId });
          }
        }}
        onReorder={(dragId, targetId, edge) => {
          const dragSecIdx = m.sections.findIndex((s) => s.rootDomNodeId === dragId);
          const targetSecIdx = m.sections.findIndex((s) => s.rootDomNodeId === targetId);
          if (dragSecIdx >= 0 && targetSecIdx >= 0) {
            const insertAt = edge === 'after' ? targetSecIdx + (dragSecIdx < targetSecIdx ? 0 : 1) : targetSecIdx;
            reorderSections(dragSecIdx, Math.max(0, Math.min(insertAt, m.sections.length - 1)));
            toast('Scroll sequence updated — section ranges redistributed');
            return;
          }
          if (moveDomNodeBeside(dragId, targetId, edge)) {
            setUIState({ selectedDomNodeId: dragId });
          }
        }}
        filter={search}
        onContextMenu={(id, x, y) => {
          setLayerCtxMenu({ x, y, targetId: id === '__stage__' ? null : id });
        }}
      />
      {layerCtxMenu && (
        <DOMContextMenu
          x={layerCtxMenu.x}
          y={layerCtxMenu.y}
          targetId={layerCtxMenu.targetId}
          onClose={() => setLayerCtxMenu(null)}
        />
      )}
      </>
    );
  }

  if (tab === 'components') {
    return (
      <div className="bs-px-sm bs-pb-md">
        {Object.keys(m.components ?? {}).length > 0 && (
          <>
            <div className="bs-grouphead">Component Registry</div>
            {Object.values(m.components ?? {})
              .filter((def) => !search || def.name.toLowerCase().includes(search.toLowerCase()))
              .map((def) => {
                const instances = componentInstances(def.id).length;
                return (
                  <div
                    key={def.id}
                    className="bs-comp-item"
                    style={{ cursor: 'grab' }}
                    title={`${def.name} — drag into a container to add a linked instance`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(MIME_COMPONENT, def.id);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                  >
                    <span className="bs-comp-item__ic">{Icons.component}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="bs-comp-item__nm">{def.name}</div>
                      <div className="bs-comp-item__mt">Instances: {instances}</div>
                    </div>
                    <span className="bs-comp-item__badge bs-comp-delete-btn">
                      <span> - </span>
                      <button
                        type="button"
                        className="uk-iconbtn bs-comp-delete-icon-btn"
                        title={
                          instances > 0 ? 'Detach or delete its instances first' : 'Delete component'
                        }
                        aria-label={`Delete component ${def.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (removeComponentDef(def.id)) toast(`${def.name} deleted`);
                          else
                            toast(
                              `${def.name} has ${instances} instance(s) — detach or delete them first`,
                            );
                        }}
                      >
                        {Icons.trash}
                      </button>
                    </span>
                  </div>
                );
              })}
          </>
        )}

        <div className="comp-group-label">Basic</div>
        <div className="comp-grid">
            {getComponentLibrary()
              .toolbox.filter((c) => !search || c.label.toLowerCase().includes(search.toLowerCase()))
              .filter((c) => !['cmp-section', 'cmp-scene3d'].includes(c.id))
              .map((c) => (
                <div
                  key={c.id}
                  className="comp-item"
                  title={c.description}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(MIME_COMPONENT, c.id);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => {
                    if (c.id === 'cmp-waypoint') {
                      import('../../../../engine/progress').then(p => {
                        const wp = addWaypoint(p.getProgress());
                        if (wp) {
                          setUIState({ selectedWaypointId: wp.id, selectedDomNodeId: null });
                          toast(
                            `Waypoint created — bound to anchor '${wp.anchorId}'`,
                            'ok',
                            'Waypoint Active',
                          );
                        } else {
                          toast('No 3D anchors in the scene to bind to', 'err', 'Anchor Binding Error');
                        }
                      });
                    }
                  }}
                >
                  <span className="cic">{TOOLBOX_ICON[c.id] ?? Icons.anchor}</span>
                  {c.label}
                </div>
              ))}
        </div>

        <div className="comp-group-label">Sections</div>
        <div className="comp-grid">
            {getComponentLibrary()
              .toolbox.filter((c) => !search || c.label.toLowerCase().includes(search.toLowerCase()))
              .filter((c) => ['cmp-section', 'cmp-scene3d'].includes(c.id))
              .map((c) => (
                <div
                  key={c.id}
                  className="comp-item"
                  title={c.description}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(MIME_COMPONENT, c.id);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                >
                  <span className="cic">{TOOLBOX_ICON[c.id] ?? Icons.anchor}</span>
                  {c.label}
                </div>
              ))}
        </div>

        <div className="comp-group-label">Custom Components</div>
        <div className="comp-list-row" draggable onDragStart={(e) => {
          e.dataTransfer.setData(MIME_COMPONENT, 'cmp-custom');
          e.dataTransfer.effectAllowed = 'copy';
        }}>
          <span className="nic">{Icons.component}</span>
          <span className="lbl">Saved Components</span>
          <span className="lbl-count">3</span>
        </div>
        <div className="comp-list-row" draggable onDragStart={(e) => {
          e.dataTransfer.setData(MIME_COMPONENT, 'cmp-custom');
          e.dataTransfer.effectAllowed = 'copy';
        }}>
          <span className="nic">{Icons.component}</span>
          <span className="lbl">Consortium Library</span>
          <span className="lbl-count">12</span>
        </div>
      </div>
    );
  }

  if (tab === 'pages') {
    return (
      <div className="bs-pages-tab">
        <div className="bs-grouphead">Pages</div>
        <div className="bs-node bs-node--sel bs-pages-tab-node">
          <span className="bs-node__tw">{Icons.layoutGrid}</span>
          <span className="bs-node__lab">Home · Fleet Story</span>
          <span className="bs-node__tag bs-node__tag--dom">active</span>
        </div>
      </div>
    );
  }

  if (tab === 'templates') {
    return (
      <div className="bs-templates-tab">
        <div className="bs-grouphead">Starter Templates</div>
        {STARTER_TEMPLATES.map((tpl) => (
          <div
            key={tpl.id}
            className="bs-template-card"
          >
            <div className="bs-template-card-header">
              <div className="bs-template-card-title">
                {tpl.has3D ? Icons.cube : Icons.layoutGrid}
                <span>{tpl.name}</span>
              </div>
              <span className={`bs-template-badge ${tpl.badge === 'FEATURED' ? 'bs-template-badge--featured' : 'bs-template-badge--default'}`}>
                {tpl.badge}
              </span>
            </div>
            <p className="bs-template-desc">{tpl.description}</p>
            <div className="bs-template-footer">
              <span className="bs-template-meta">
                {tpl.sectionsCount} {tpl.sectionsCount === 1 ? 'Section' : 'Sections'} {tpl.has3D ? ' * 3D Scene' : ''}
              </span>
              <button
                type="button"
                className="bs-template-import-btn"
                onClick={() => {
                  const res = importStarterTemplate(tpl.id);
                  toast(res.message, 'ok', 'Blueprint Deployed');
                }}
              >
                Deploy Blueprint
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
