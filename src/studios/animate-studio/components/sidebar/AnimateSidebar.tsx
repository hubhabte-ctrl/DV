/**
 * Animate Studio's left rail panel contribution (Phase 3 decoupling).
 * Provides the Layers tab (Animation Layer Tree).
 */
import { useState } from 'react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { Icons } from '../../../../app/ui/Icons';
import { toast } from '../../../../app/ui/Toast';
import { deleteKeyframe, getKeyframeName, getManifest, setUIState, useUIState, type Track } from '@bs/engine';
import { setProgress } from '../../../../engine/progress';

export interface RailPanelProps {
  tab: string;
  search: string;
}

export function AnimateSidebar({ tab, search }: RailPanelProps) {
  const m = getManifest();
  const selTrack = useUIState((s) => s.selectedTrackId);
  const selKeyframeT = useUIState((s) => s.selectedKeyframeT);
  const [expandedTracks, setExpandedTracks] = useState<Record<string, boolean>>({});

  if (tab !== 'tracks') return null;

  const toggleTrackExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTracks((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const categories = [
    {
      name: 'Cameras & Views',
      tracks: m.tracks.filter((t) => t.label.toLowerCase().includes('camera') || t.id.includes('cam')),
    },
    {
      name: '3D Scene Objects',
      tracks: m.tracks.filter(
        (t) =>
          !t.label.toLowerCase().includes('camera') &&
          !t.id.includes('cam') &&
          !t.label.toLowerCase().includes('dom') &&
          !t.id.includes('dom'),
      ),
    },
    {
      name: 'DOM & Waypoints',
      tracks: m.tracks.filter((t) => t.label.toLowerCase().includes('dom') || t.id.includes('dom')),
    },
  ];

  const getTrackIcon = (t: Track) => {
    if (t.label.toLowerCase().includes('camera') || t.id.includes('cam')) return Icons.camera;
    if (t.label.toLowerCase().includes('dom') || t.id.includes('dom')) return Icons.layers;
    return Icons.cube;
  };

  return (
    <div className="bs-animate-tree">
      {categories.map(
        (cat) =>
          cat.tracks.length > 0 && (
            <CollapsibleSection key={cat.name} title={`${cat.name} (${cat.tracks.length})`}>
              {cat.tracks
                .filter((t) => !search || t.label.toLowerCase().includes(search.toLowerCase()))
                .map((t) => {
                  const isTrackSel = selTrack === t.id;
                  const isExpanded = expandedTracks[t.id] ?? false;
                  const icon = getTrackIcon(t);

                  return (
                    <div key={t.id} className="bs-flex-col">
                      <div
                        className={`uk-tree__row bs-animate-track-row ${isTrackSel ? 'uk-tree__row--selected' : ''}`}
                        onClick={() => {
                          setUIState({ selectedTrackId: t.id, selectedKeyframeT: null });
                          if (t.target) {
                            if (m.sceneNodes[t.target]) setUIState({ selectedSceneNodeId: t.target });
                            else if (m.domNodes[t.target]) setUIState({ selectedDomNodeId: t.target });
                          }
                        }}
                      >
                        <span
                          onClick={(e) => toggleTrackExpand(t.id, e)}
                          className="uk-tree__chevron bs-animate-track-chevron"
                        >
                          {isExpanded ? ' - ' : ' - '}
                        </span>
                        <span className="uk-tree__icon">{icon}</span>
                        <span className="uk-tree__label bs-animate-track-label">
                          {t.label}
                        </span>
                        <span className="bs-muted bs-animate-track-count">
                          {t.keyframes.length} keys
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="bs-animate-keyframe-list">
                          {t.keyframes.map((k, kIdx) => {
                            const isKeySel =
                              isTrackSel && selKeyframeT !== null && Math.abs(selKeyframeT - k.t) < 1e-5;
                            const kName = getKeyframeName(t, k, kIdx);
                            return (
                              <div
                                key={k.t}
                                className={`uk-tree__row bs-animate-keyframe-row ${isKeySel ? 'uk-tree__row--selected' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProgress(k.t);
                                  setUIState({ selectedTrackId: t.id, selectedKeyframeT: k.t });
                                  if (t.target) {
                                    if (m.sceneNodes[t.target]) setUIState({ selectedSceneNodeId: t.target });
                                    else if (m.domNodes[t.target]) setUIState({ selectedDomNodeId: t.target });
                                  }
                                }}
                              >
                                <span className="uk-tree__icon" style={{ opacity: isKeySel ? 1 : 0.5, color: isKeySel ? 'var(--accent)' : undefined }}>
                                  {Icons.track}
                                </span>
                                <span className="uk-tree__label bs-animate-keyframe-label">
                                  {kName}
                                </span>
                                <span className="bs-muted bs-animate-keyframe-t">
                                  t={k.t.toFixed(2)}
                                </span>
                                <span className="uk-tree__actions">
                                  {t.keyframes.length > 1 && (
                                    <button
                                      type="button"
                                      className="uk-iconbtn"
                                      title={`Delete keyframe '${kName}'`}
                                      aria-label={`Delete keyframe ${kName}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteKeyframe(t.id, k.t);
                                        toast(`Deleted keyframe '${kName}'`);
                                      }}
                                    >
                                      {Icons.trash}
                                    </button>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </CollapsibleSection>
          ),
      )}
    </div>
  );
}
