import { AlertCircle, Check, Film } from 'lucide-react';
import type { MediaAsset } from '../../lib/types';
import { formatTimecode } from '../../lib/time';
import { Tooltip } from '../../components/ui/Tooltip';
import { cn } from '../../lib/cn';

export const ASSET_DRAG_MIME = 'application/x-frameflow-asset';

interface AssetThumbnailProps {
  asset: MediaAsset;
  onAdd: () => void;
  selected?: boolean;
  onToggleSelect?: () => void;
}

export function AssetThumbnail({ asset, onAdd, selected = false, onToggleSelect }: AssetThumbnailProps) {
  const isError = asset.status === 'error';

  const content = (
    <button
      type="button"
      draggable={!isError}
      onDragStart={(e) => {
        e.dataTransfer.setData(ASSET_DRAG_MIME, asset.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => !isError && onAdd()}
      disabled={isError}
      className={cn(
        'group flex flex-col overflow-hidden rounded-sm border bg-surface text-left transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-70',
        selected ? 'border-copper ring-1 ring-copper' : 'border-line',
      )}
    >
      <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-canvas-surround">
        {asset.thumbnailDataUrl ? (
          <img src={asset.thumbnailDataUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Film size={18} strokeWidth={1.5} className="text-ink-muted" />
        )}
        {isError ? (
          <span className="absolute inset-0 flex items-center justify-center bg-ink/60">
            <AlertCircle size={18} strokeWidth={1.75} className="text-copper-soft" />
          </span>
        ) : null}
        {asset.type === 'video' && asset.durationMs ? (
          <span className="tabular-nums absolute bottom-1 right-1 rounded-xs bg-ink/75 px-1 text-2xs text-surface">
            {formatTimecode(asset.durationMs)}
          </span>
        ) : null}
        {onToggleSelect && !isError ? (
          <span
            role="checkbox"
            aria-checked={selected}
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onToggleSelect();
              }
            }}
            className={cn(
              'absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-xs border transition-colors',
              selected
                ? 'border-copper bg-copper text-surface'
                : 'border-surface/80 bg-ink/45 group-hover:bg-ink/65',
            )}
          >
            {selected ? <Check size={13} strokeWidth={2.25} /> : null}
          </span>
        ) : null}
      </span>
      <span className="truncate px-1.5 py-1 text-2xs text-ink">{asset.name}</span>
    </button>
  );

  if (isError) {
    return <Tooltip content={asset.errorMessage ?? 'Import failed'}>{content}</Tooltip>;
  }
  return content;
}
