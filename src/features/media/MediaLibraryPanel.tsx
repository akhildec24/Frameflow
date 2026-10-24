import { useCallback, useRef, useState } from 'react';
import { AlertCircle, Clapperboard, Film, Image as ImageIcon, Music, Plus, Search, Type, Upload, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useEditorStore } from '../../state/editorStore';
import { importAssetFile } from '../../storage/assetRepository';
import { collectDroppedFiles } from '../../lib/dropFiles';
import { useToast } from '../../components/ui/useToast';
import { cn } from '../../lib/cn';
import type { MediaAsset } from '../../lib/types';
import { AssetThumbnail } from './AssetThumbnail';
import { TransitionSection } from '../inspector/SceneInspector';

export function MediaLibraryPanel() {
  const project = useEditorStore((s) => s.project);
  const activeScene = project ? project.scenes.find((s) => s.id === project.activeSceneId) ?? project.scenes[0] : undefined;
  const addAssets = useEditorStore((s) => s.addAssets);
  const renameAsset = useEditorStore((s) => s.renameAsset);
  const addMediaElement = useEditorStore((s) => s.addMediaElement);
  const createSlideshowFromAssets = useEditorStore((s) => s.createSlideshowFromAssets);
  const addTextElement = useEditorStore((s) => s.addTextElement);
  const { show } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [pendingAsset, setPendingAsset] = useState<MediaAsset | null>(null);

  const toggleAssetSelected = useCallback((assetId: string) => {
    setSelectedAssetIds((prev) =>
      prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId],
    );
  }, []);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (!files.length || !project) return;
      setImporting(true);

      const existingHashes = new Map<string, MediaAsset>();
      for (const asset of Object.values(project.assets)) {
        if (asset.hash) existingHashes.set(asset.hash, asset);
      }

      const results: MediaAsset[] = [];
      let duplicateCount = 0;
      let errorCount = 0;

      for (const file of files) {
        const result = await importAssetFile(file, existingHashes);
        if (result.duplicateOfExisting) {
          // Same bytes, different name — honour the rename on the stored asset.
          if (result.asset.name !== file.name) renameAsset(result.asset.id, file.name);
          duplicateCount += 1;
          continue;
        }
        if (result.asset.status === 'error') errorCount += 1;
        results.push(result.asset);
        if (result.asset.hash) existingHashes.set(result.asset.hash, result.asset);
      }

      if (results.length) {
        addAssets(results);
        const newIds = results
          .filter((a) => a.status === 'ready' && a.type !== 'audio')
          .map((a) => a.id);
        if (newIds.length) {
          setSelectedAssetIds((prev) => [...prev, ...newIds]);
        }
      }
      setImporting(false);

      if (duplicateCount) {
        show({ title: 'Skipped duplicates', description: `${duplicateCount} file(s) already exist in this project.`, tone: 'info' });
      }
      if (errorCount) {
        show({ title: 'Some files could not be imported', description: `${errorCount} file(s) had an unsupported format or failed to process.`, tone: 'error' });
      }
      if (results.length) {
        const parts = (['image', 'video', 'audio'] as const)
          .map((type) => ({ type, count: results.filter((a) => a.status === 'ready' && a.type === type).length }))
          .filter(({ count }) => count > 0)
          .map(({ type, count }) => `${count} ${type}${count === 1 ? '' : 's'}`)
          .join(', ');
        show({ title: 'Media imported', description: `${parts || `${results.length} file(s)`} added to the library.`, tone: 'success' });
      }
    },
    [project, addAssets, renameAsset, show],
  );

  if (!project) return null;

  const assets = Object.values(project.assets);
  const q = query.trim().toLowerCase();
  const mediaAssets = assets.filter(
    (a) => (a.type === 'image' || a.type === 'video') && (!q || a.name.toLowerCase().includes(q)),
  );
  const audioAssets = assets.filter((a) => a.type === 'audio');

  const selectedIdSet = new Set(selectedAssetIds);
  const selectedMediaIds = mediaAssets
    .filter((a) => selectedIdSet.has(a.id))
    .map((a) => a.id);

  const handleCreateSlideshow = () => {
    if (!selectedMediaIds.length) return;
    createSlideshowFromAssets(selectedMediaIds);
    setSelectedAssetIds([]);
    show({
      title: 'Slideshow created',
      description: `${selectedMediaIds.length} slide${selectedMediaIds.length === 1 ? '' : 's'} added, one per selected file.`,
      tone: 'success',
    });
  };

  const sceneHasMedia = activeScene?.elements.some((el) => el.kind === 'media') ?? false;

  const handleAddAsset = (asset: MediaAsset) => {
    if (asset.status !== 'ready') return;
    // Ask first when the slide already has media — layering silently surprises people.
    if (sceneHasMedia) setPendingAsset(asset);
    else addMediaElement(asset);
  };

  const placeOnCurrentSlide = () => {
    if (pendingAsset) addMediaElement(pendingAsset);
    setPendingAsset(null);
  };

  const placeOnNewSlide = () => {
    if (pendingAsset) createSlideshowFromAssets([pendingAsset.id]);
    setPendingAsset(null);
  };

  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-line bg-surface-raised">
      <Tabs defaultValue="media" className="flex min-h-0 flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="text">Text</TabsTrigger>
          <TabsTrigger value="transitions">Transitions</TabsTrigger>
          <TabsTrigger value="audio">Audio</TabsTrigger>
        </TabsList>

        <TabsContent value="media" className="flex min-h-0 flex-1 flex-col">
          <div
            onDragEnter={(e) => {
              if (!e.dataTransfer.types.includes('Files')) return;
              e.preventDefault();
              dragDepth.current += 1;
              setIsDragging(true);
            }}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes('Files')) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDragLeave={() => {
              dragDepth.current = Math.max(0, dragDepth.current - 1);
              if (dragDepth.current === 0) setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              dragDepth.current = 0;
              setIsDragging(false);
              void collectDroppedFiles(e.dataTransfer)
                .then((files) => {
                  if (files.length) {
                    handleFiles(files);
                  } else {
                    show({ title: 'Nothing to import', description: 'No supported media files were found in what you dropped.', tone: 'info' });
                  }
                })
                .catch(() => {
                  if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
                });
            }}
            className={cn('flex min-h-0 flex-1 flex-col transition-colors', isDragging && 'bg-copper-soft/20 ring-1 ring-inset ring-copper/40')}
          >
          <div className="p-2.5">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              <Upload size={14} strokeWidth={1.75} />
              {importing ? 'Importing' : 'Import files'}
            </Button>
          </div>

          <div className="px-2.5 pb-2.5">
            <div className="relative">
              <Search
                size={13}
                strokeWidth={1.75}
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search media…"
                className="w-full rounded-sm border border-line bg-surface py-1.5 pl-7 pr-6 text-2xs text-ink outline-none placeholder:text-ink-muted focus:border-copper"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xs p-0.5 text-ink-secondary transition-colors hover:text-ink"
                >
                  <X size={12} strokeWidth={1.75} />
                </button>
              ) : null}
            </div>
          </div>

          <div
            className={cn(
              'mx-2.5 mb-2.5 flex min-h-[64px] items-center justify-center rounded-sm border border-dashed text-2xs text-ink-muted transition-colors',
              isDragging ? 'border-focus bg-copper-soft/30 text-ink' : 'border-line-strong',
              mediaAssets.length > 0 && 'hidden',
            )}
          >
            Drop images or video here
          </div>

          {selectedMediaIds.length > 0 ? (
            <div className="mx-2.5 mb-2 flex flex-col gap-1.5 rounded-sm border border-copper/50 bg-copper-soft/25 p-2">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-medium text-ink">
                  {selectedMediaIds.length} item{selectedMediaIds.length === 1 ? '' : 's'} selected
                </span>
                <button
                  type="button"
                  aria-label="Clear selection"
                  onClick={() => setSelectedAssetIds([])}
                  className="rounded-xs p-0.5 text-ink-secondary transition-colors hover:text-ink"
                >
                  <X size={13} strokeWidth={1.75} />
                </button>
              </div>
              <Button variant="dark" size="sm" className="w-full" onClick={handleCreateSlideshow}>
                <Clapperboard size={14} strokeWidth={1.75} />
                Create slideshow
              </Button>
            </div>
          ) : null}

          <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto px-2.5 pb-3">
            {mediaAssets.map((asset) => (
              <AssetThumbnail
                key={asset.id}
                asset={asset}
                onAdd={() => handleAddAsset(asset)}
                selected={selectedIdSet.has(asset.id)}
                onToggleSelect={() => toggleAssetSelected(asset.id)}
              />
            ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group flex flex-col overflow-hidden rounded-sm border border-dashed border-line-strong text-left transition-colors hover:border-focus hover:bg-copper-soft/30"
            >
              <span className="flex aspect-square w-full items-center justify-center text-ink-muted transition-colors group-hover:text-ink">
                <Plus size={22} strokeWidth={1.75} />
              </span>
              <span className="px-1.5 py-1 text-2xs text-ink-secondary">Add media</span>
            </button>
            {!mediaAssets.length && q ? (
              <p className="col-span-2 py-6 text-center text-2xs text-ink-muted">
                No files match “{query.trim()}”.
              </p>
            ) : null}
          </div>
          </div>
        </TabsContent>

        <TabsContent value="text" className="flex flex-col gap-2 p-2.5">
          <button
            type="button"
            onClick={addTextElement}
            className="flex items-center gap-2 rounded-sm border border-line px-2.5 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-hover"
          >
            <Type size={15} strokeWidth={1.75} />
            Add heading
          </button>
          <p className="px-0.5 text-2xs text-ink-secondary">
            Double-click any text element on the canvas to edit its content.
          </p>
        </TabsContent>

        <TabsContent value="transitions" className="flex flex-col">
          {activeScene ? (
            <>
              <TransitionSection scene={activeScene} />
              <p className="px-3 pt-2 text-2xs text-ink-secondary">
                Applies to <span className="font-medium text-ink">{activeScene.name}</span>. Pick a slide in the
                scene strip to edit its transition.
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 p-4 text-center">
              <Film size={20} strokeWidth={1.5} className="text-ink-muted" />
              <p className="text-2xs text-ink-secondary">Select a slide to edit its transition.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="audio" className="flex min-h-0 flex-1 flex-col">
          <div className="p-2.5">
            <input
              type="file"
              multiple
              id="audio-input"
              accept="audio/mpeg,audio/wav,audio/x-wav,audio/aac,audio/mp4"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => document.getElementById('audio-input')?.click()}
            >
              <Upload size={14} strokeWidth={1.75} />
              Import audio
            </Button>
          </div>
          <p className="px-2.5 pb-2 text-2xs text-ink-secondary">
            Audio playback and volume arrive with the timeline milestone. Imported files are kept safely in the
            library.
          </p>
          <div className="flex flex-col gap-1.5 overflow-y-auto px-2.5 pb-3">
            {audioAssets.map((asset) => (
              <div key={asset.id} className="flex items-center gap-2 rounded-sm border border-line px-2 py-1.5">
                {asset.status === 'error' ? (
                  <AlertCircle size={14} strokeWidth={1.75} className="shrink-0 text-copper" />
                ) : (
                  <Music size={14} strokeWidth={1.75} className="shrink-0 text-ink-secondary" />
                )}
                <span className="truncate text-2xs text-ink">{asset.name}</span>
              </div>
            ))}
            {audioAssets.length === 0 ? (
              <span className="text-2xs text-ink-muted">No audio imported yet.</span>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>

      <Modal
        open={pendingAsset !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAsset(null);
        }}
        title="Slide already has media"
        description="The current slide already contains an image or video."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={placeOnCurrentSlide}>
              Add to this slide
            </Button>
            <Button variant="dark" size="sm" onClick={placeOnNewSlide}>
              Create new slide
            </Button>
          </>
        }
      >
        <p className="text-xs text-ink-secondary">
          Add <span className="font-medium text-ink">{pendingAsset?.name}</span> on top of it, or
          start a fresh slide instead?
        </p>
      </Modal>
    </aside>
  );
}

export function MediaTypeIcon({ type }: { type: MediaAsset['type'] }) {
  if (type === 'video') return <Film size={14} strokeWidth={1.75} />;
  if (type === 'audio') return <Music size={14} strokeWidth={1.75} />;
  return <ImageIcon size={14} strokeWidth={1.75} />;
}
