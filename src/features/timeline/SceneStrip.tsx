import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ChevronsDown, ChevronsUp, Copy, Maximize2, Play, Plus, Trash2 } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEditorStore } from '../../state/editorStore';
import { IconButton } from '../../components/ui/IconButton';
import { useAssetUrl } from '../media/useAssetUrl';
import { cn } from '../../lib/cn';
import type { MediaAsset, MediaElement, Project, Scene } from '../../lib/types';

const TRANSITION_BADGE: Record<string, string> = { crossfade: 'Fade', slide: 'Slide', zoom: 'Zoom' };

export function SceneStrip() {
  const project = useEditorStore((s) => s.project);
  const addScene = useEditorStore((s) => s.addScene);
  const duplicateScene = useEditorStore((s) => s.duplicateScene);
  const removeScene = useEditorStore((s) => s.removeScene);
  const renameScene = useEditorStore((s) => s.renameScene);
  const moveScene = useEditorStore((s) => s.moveScene);
  const setActiveScene = useEditorStore((s) => s.setActiveScene);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const activeCardRef = useRef<HTMLDivElement | null>(null);
  const activeSceneId = project?.activeSceneId;

  const sensors = useSensors(
    // A few px of travel before a drag starts keeps clicks on the card working.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  useEffect(() => {
    activeCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeSceneId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      if (!project || previewIndex !== null) return;
      const index = project.scenes.findIndex((s) => s.id === project.activeSceneId);
      if (index !== -1 && scenePreviewAsset(project.scenes[index], project)) {
        e.preventDefault();
        setPreviewIndex(index);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [project, previewIndex]);

  if (!project) return null;

  const handleDragStart = ({ active }: DragStartEvent) => setDraggingId(String(active.id));
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null);
    if (!over || active.id === over.id) return;
    const toIndex = project.scenes.findIndex((s) => s.id === over.id);
    if (toIndex !== -1) moveScene(String(active.id), toIndex);
  };

  const stepPreview = (dir: 1 | -1) => {
    setPreviewIndex((current) => {
      if (current === null) return current;
      for (let i = 1; i <= project.scenes.length; i += 1) {
        const next = (current + dir * i + project.scenes.length) % project.scenes.length;
        if (scenePreviewAsset(project.scenes[next], project)) return next;
      }
      return current;
    });
  };

  const draggingScene = draggingId ? project.scenes.find((s) => s.id === draggingId) : undefined;
  const draggingIndex = draggingScene ? project.scenes.indexOf(draggingScene) : -1;

  return (
    <div className="relative h-[150px] shrink-0">
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 flex flex-col border-t border-line transition-[height] duration-200 ease-out',
          expanded ? 'z-40 h-[calc(100vh-64px)] bg-workspace/85 shadow-popover backdrop-blur-xl' : 'h-full bg-workspace',
        )}
      >
      <div className="flex h-8 items-center justify-between px-3">
        <span className="flex items-center gap-1">
          <span className="text-2xs font-semibold uppercase tracking-wide text-ink-secondary">Scenes</span>
          <IconButton
            label={expanded ? 'Collapse scenes' : 'Expand scenes for reordering'}
            icon={expanded ? <ChevronsDown size={14} strokeWidth={1.75} /> : <ChevronsUp size={14} strokeWidth={1.75} />}
            size="sm"
            onClick={() => setExpanded((v) => !v)}
          />
        </span>
        <span className="text-2xs text-ink-muted">
          Timed playback and trimming arrive with the timeline milestone.
        </span>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingId(null)}
      >
        <SortableContext
          items={project.scenes.map((s) => s.id)}
          strategy={expanded ? rectSortingStrategy : horizontalListSortingStrategy}
        >
          <div
            className={cn(
              'flex-1 gap-2.5 px-3 pb-3',
              expanded
                ? 'grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] content-start overflow-y-auto'
                : 'flex items-stretch overflow-x-auto',
            )}
          >
            {project.scenes.map((scene, index) => {
              const active = scene.id === project.activeSceneId;
              const firstMedia = scene.elements.find((el) => el.kind === 'media');
              const mediaAsset = firstMedia && firstMedia.kind === 'media' ? project.assets[firstMedia.assetId] : undefined;
              const isVideoSlide = mediaAsset?.type === 'video';

              return (
                <SortableSceneCard
                  key={scene.id}
                  id={scene.id}
                  active={active}
                  activeRef={activeCardRef}
                  dragDisabled={renamingId === scene.id}
                  fluid={expanded}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey) {
                        if (mediaAsset) setPreviewIndex(index);
                      } else {
                        setActiveScene(scene.id);
                      }
                    }}
                    onDoubleClick={() => {
                      if (mediaAsset) setPreviewIndex(index);
                    }}
                    className={cn(
                      'relative flex w-full items-center justify-center overflow-hidden bg-canvas-surround',
                      expanded ? 'aspect-video' : 'h-[76px]',
                    )}
                  >
                    {expanded ? (
                      <SceneThumb scene={scene} project={project} />
                    ) : mediaAsset?.thumbnailDataUrl ? (
                      <img src={mediaAsset.thumbnailDataUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-2xs text-ink-muted">Empty scene</span>
                    )}
                    <span className="absolute left-1.5 top-1.5 rounded-pill bg-ink/80 px-1.5 text-2xs text-surface">
                      {index + 1}
                    </span>
                    {isVideoSlide ? (
                      <span className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 rounded-pill bg-ink/80 px-1.5 py-0.5 text-2xs text-surface">
                        <Play size={9} strokeWidth={2.5} fill="currentColor" />
                      </span>
                    ) : null}
                    {scene.transitionOut && scene.transitionOut.type !== 'cut' ? (
                      <span className="absolute bottom-1.5 right-1.5 rounded-pill bg-ink/80 px-1.5 text-2xs text-surface">
                        {TRANSITION_BADGE[scene.transitionOut.type]}
                      </span>
                    ) : null}
                  </button>
                  {mediaAsset ? (
                    <IconButton
                      label="Preview image"
                      icon={<Maximize2 size={11} strokeWidth={2} />}
                      size="sm"
                      onClick={() => setPreviewIndex(index)}
                      className="absolute right-1.5 top-1.5 bg-ink/70 text-surface opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  ) : null}
                  <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                    {renamingId === scene.id ? (
                      <input
                        autoFocus
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onBlur={() => {
                          if (draftName.trim()) renameScene(scene.id, draftName.trim());
                          setRenamingId(null);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        className="h-6 w-full rounded-xs border border-focus bg-surface px-1 text-2xs text-ink outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onDoubleClick={() => {
                          setDraftName(scene.name);
                          setRenamingId(scene.id);
                        }}
                        className="truncate text-left text-2xs font-medium text-ink"
                        title="Double-click to rename"
                      >
                        {scene.name}
                      </button>
                    )}
                    <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                      <IconButton
                        label="Duplicate scene"
                        icon={<Copy size={13} strokeWidth={1.75} />}
                        size="sm"
                        onClick={() => duplicateScene(scene.id)}
                      />
                      <IconButton
                        label="Delete scene"
                        icon={<Trash2 size={13} strokeWidth={1.75} />}
                        size="sm"
                        disabled={project.scenes.length <= 1}
                        onClick={() => removeScene(scene.id)}
                      />
                    </div>
                  </div>
                </SortableSceneCard>
              );
            })}

            <button
              type="button"
              onClick={addScene}
              className="flex h-[76px] w-[72px] shrink-0 flex-col items-center justify-center gap-1 self-start rounded-md border border-dashed border-line-strong text-ink-secondary transition-colors hover:border-focus hover:text-ink"
            >
              <Plus size={16} strokeWidth={1.75} />
              <span className="text-2xs">Add scene</span>
            </button>
          </div>
        </SortableContext>
        <DragOverlay>
          {draggingScene ? (
            <div className="w-[150px] overflow-hidden rounded-md border border-copper/70 bg-surface-raised/70 shadow-popover backdrop-blur-xl">
              <div className="relative flex h-[76px] w-full items-center justify-center bg-canvas-surround">
                <SceneThumb scene={draggingScene} project={project} />
                <span className="absolute left-1.5 top-1.5 rounded-pill bg-ink/80 px-1.5 text-2xs text-surface">
                  {draggingIndex + 1}
                </span>
              </div>
              <p className="truncate px-2 py-1.5 text-2xs font-medium text-ink">{draggingScene.name}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      </div>
      {previewIndex !== null && scenePreviewAsset(project.scenes[previewIndex], project) ? (
        <AssetPreview
          asset={scenePreviewAsset(project.scenes[previewIndex], project)!}
          onClose={() => setPreviewIndex(null)}
          onPrev={() => stepPreview(-1)}
          onNext={() => stepPreview(1)}
        />
      ) : null}
    </div>
  );
}

/** Renders a scene's media elements at their true position/crop so the
 *  thumbnail matches what the canvas and export show. */
function SceneThumb({ scene, project }: { scene: Scene; project: Project }) {
  const mediaEls = scene.elements.filter((el): el is MediaElement => el.kind === 'media' && !el.hidden);
  if (!mediaEls.length) {
    return <span className="absolute inset-0 flex items-center justify-center text-2xs text-ink-muted">Empty scene</span>;
  }
  return (
    <div className="absolute inset-0" style={{ background: scene.background }}>
      {mediaEls.map((el) => {
        const asset = project.assets[el.assetId];
        if (!asset?.thumbnailDataUrl) return null;
        const t = el.transform;
        const panX = t.pan?.x ?? 0.5;
        const panY = t.pan?.y ?? 0.5;
        const zoom = t.fit === 'contain' ? 1 : (t.zoom ?? 1);
        return (
          <div
            key={el.id}
            style={{
              position: 'absolute',
              left: `${(t.x / project.width) * 100}%`,
              top: `${(t.y / project.height) * 100}%`,
              width: `${(t.width / project.width) * 100}%`,
              aspectRatio: `${t.width} / ${t.height}`,
              opacity: el.opacity,
              // Konva rotates the group around its origin — match with 0 0.
              transform: `rotate(${t.rotation}deg)`,
              transformOrigin: '0 0',
              overflow: 'hidden',
            }}
          >
            <img
              src={asset.thumbnailDataUrl}
              alt=""
              draggable={false}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: t.fit === 'contain' ? 'contain' : t.fit === 'free' ? 'fill' : 'cover',
                objectPosition: `${panX * 100}% ${panY * 100}%`,
                transform: `scale(${zoom}) scale(${t.flipX ? -1 : 1}, ${t.flipY ? -1 : 1})`,
                transformOrigin: `${panX * 100}% ${panY * 100}%`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** First media asset of a scene, if it has one. */
function scenePreviewAsset(scene: Scene | undefined, project: Project): MediaAsset | undefined {
  const el = scene?.elements.find((e): e is MediaElement => e.kind === 'media');
  return el ? project.assets[el.assetId] : undefined;
}

/** Full-size media preview shown when double-clicking a scene thumbnail.
 *  ←/→ steps through the scenes' media for quick browsing. */
function AssetPreview({ asset, onClose, onPrev, onNext }: { asset: MediaAsset; onClose: () => void; onPrev: () => void; onNext: () => void }) {
  const url = useAssetUrl(asset.status === 'ready' ? asset.storageKey : undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.code === 'Space') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') onPrev();
      else if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/75 p-8" onClick={onClose}>
      <div className="relative max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
        {url && asset.type === 'video' ? (
          <video src={url} controls autoPlay muted className="max-h-[85vh] max-w-[90vw] rounded-sm" />
        ) : url ? (
          <img src={url} alt={asset.name} className="max-h-[85vh] max-w-[90vw] rounded-sm object-contain" />
        ) : (
          <span className="text-2xs text-surface">Loading…</span>
        )}
        <span className="absolute bottom-2 left-2 max-w-[70%] truncate rounded-xs bg-ink/80 px-1.5 py-0.5 text-2xs text-surface">
          {asset.name}
        </span>
      </div>
    </div>,
    document.body,
  );
}

function SortableSceneCard({
  id,
  active,
  dragDisabled,
  activeRef,
  fluid,
  children,
}: {
  id: string;
  active: boolean;
  dragDisabled: boolean;
  activeRef: RefObject<HTMLDivElement | null>;
  fluid?: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: dragDisabled,
  });

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        if (active) activeRef.current = node;
      }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        'group relative flex cursor-grab touch-none flex-col overflow-hidden rounded-md border bg-surface-raised transition-shadow',
        fluid ? 'w-full' : 'w-[150px] shrink-0',
        active ? 'border-copper shadow-card' : 'border-line hover:border-line-strong',
        isDragging && 'z-20 border-copper opacity-40',
      )}
    >
      {children}
    </div>
  );
}
