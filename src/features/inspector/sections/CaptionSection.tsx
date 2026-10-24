import { Copy, Eye, EyeOff } from 'lucide-react';
import { IconButton } from '../../../components/ui/IconButton';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { useEditorStore } from '../../../state/editorStore';
import { embeddedCaption } from '../../../lib/captions';
import type { CaptionConfig, MediaElement } from '../../../lib/types';

const POSITION_OPTIONS = [
  { value: 'bottom', label: 'Bottom' },
  { value: 'top', label: 'Top' },
] as const;

const STYLE_OPTIONS = [
  { value: 'bar', label: 'Bar' },
  { value: 'pill', label: 'Pill' },
] as const;

/** Caption controls for media elements — text resolves to the file's embedded caption unless overridden. */
export function CaptionSection({ element }: { element: MediaElement }) {
  const updateElement = useEditorStore((s) => s.updateElement);
  const applyCaptionToAllSlides = useEditorStore((s) => s.applyCaptionToAllSlides);
  const asset = useEditorStore((s) => s.project?.assets[element.assetId]);
  const embedded = embeddedCaption(asset);
  const fileName = asset?.name?.replace(/\.[^.]+$/, '').trim();
  const cfg = element.caption;
  const show = cfg?.show ?? false;

  const patch = (p: Partial<CaptionConfig>) =>
    updateElement(element.id, (el) => {
      if (el.kind === 'media') {
        el.caption = { show: false, position: 'bottom', style: 'bar', ...cfg, ...p };
      }
    });

  return (
    <section className="flex flex-col gap-2.5 border-b border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-secondary">Caption</h3>
        <IconButton
          label={show ? 'Hide caption' : 'Show caption'}
          icon={show ? <Eye size={15} strokeWidth={1.75} /> : <EyeOff size={15} strokeWidth={1.75} />}
          active={show}
          size="sm"
          onClick={() => patch({ show: !show })}
        />
      </div>

      <textarea
        key={`${element.id}:${cfg?.text ?? ''}`}
        rows={2}
        defaultValue={cfg?.text ?? ''}
        placeholder={embedded ?? fileName ?? 'Caption text…'}
        onBlur={(e) => {
          const text = e.target.value;
          if (text !== (cfg?.text ?? '')) patch({ text });
        }}
        className="w-full resize-none rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none placeholder:text-ink-muted focus:border-copper"
      />

      <div className="flex flex-wrap gap-1.5">
        {embedded ? (
          <button
            type="button"
            onClick={() => patch({ text: embedded })}
            className="rounded-pill border border-line px-2 py-0.5 text-2xs text-ink-secondary transition-colors hover:border-copper hover:text-ink"
          >
            From file
          </button>
        ) : null}
        {fileName ? (
          <button
            type="button"
            onClick={() => patch({ text: fileName })}
            className="rounded-pill border border-line px-2 py-0.5 text-2xs text-ink-secondary transition-colors hover:border-copper hover:text-ink"
          >
            Use filename
          </button>
        ) : null}
      </div>

      <SegmentedControl
        options={[...POSITION_OPTIONS]}
        value={cfg?.position ?? 'bottom'}
        onChange={(position) => patch({ position })}
      />
      <SegmentedControl
        options={[...STYLE_OPTIONS]}
        value={cfg?.style ?? 'bar'}
        onChange={(style) => patch({ style })}
      />

      {embedded ? (
        <p className="text-2xs leading-snug text-ink-muted" title={embedded}>
          Embedded: {embedded.length > 90 ? `${embedded.slice(0, 90)}…` : embedded}
        </p>
      ) : (
        <p className="text-2xs text-ink-muted">No caption embedded — type one above, or use the file name.</p>
      )}

      <button
        type="button"
        onClick={() =>
          applyCaptionToAllSlides({ show, position: cfg?.position ?? 'bottom', style: cfg?.style ?? 'bar' })
        }
        className="flex items-center justify-center gap-1.5 rounded-md border border-line py-1.5 text-2xs text-ink-secondary transition-colors hover:border-copper hover:text-ink"
      >
        <Copy size={12} strokeWidth={1.75} />
        Apply to all slides
      </button>
    </section>
  );
}
