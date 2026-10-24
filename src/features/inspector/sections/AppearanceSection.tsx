import { Crop, Check } from 'lucide-react';
import { Slider } from '../../../components/ui/Slider';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Button } from '../../../components/ui/Button';
import { useEditorStore } from '../../../state/editorStore';
import type { MediaElement } from '../../../lib/types';

const FIT_OPTIONS = [
  { value: 'cover' as const, label: 'Fill' },
  { value: 'contain' as const, label: 'Fit' },
  { value: 'free' as const, label: 'Free' },
];

export function AppearanceSection({ element }: { element: MediaElement }) {
  const updateElement = useEditorStore((s) => s.updateElement);
  const cropEditingElementId = useEditorStore((s) => s.cropEditingElementId);
  const setCropEditingElement = useEditorStore((s) => s.setCropEditingElement);
  const isCropEditing = cropEditingElementId === element.id;

  const setOpacity = (opacity: number) =>
    updateElement(element.id, (el) => {
      el.opacity = opacity / 100;
    });

  const setFit = (fit: (typeof FIT_OPTIONS)[number]['value']) =>
    updateElement(element.id, (el) => {
      el.transform.fit = fit;
      if (fit !== 'free') el.transform.zoom = 1;
    });

  const setZoom = (zoom: number) =>
    updateElement(element.id, (el) => {
      el.transform.zoom = zoom;
    });

  return (
    <section className="flex flex-col gap-3 border-b border-line p-3">
      <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-secondary">Appearance</h3>

      <Slider
        label="Opacity"
        value={Math.round(element.opacity * 100)}
        min={0}
        max={100}
        onChange={setOpacity}
        formatValue={(v) => `${v}%`}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-2xs text-ink-secondary">Crop mode</span>
        <SegmentedControl options={FIT_OPTIONS} value={element.transform.fit} onChange={setFit} />
      </div>

      {element.transform.fit === 'free' ? (
        <Slider
          label="Zoom"
          value={element.transform.zoom ?? 1}
          min={1}
          max={4}
          step={0.05}
          onChange={setZoom}
          formatValue={(v) => `${v.toFixed(2)}x`}
        />
      ) : null}

      {element.transform.fit !== 'contain' ? (
        <Button
          variant={isCropEditing ? 'copper' : 'outline'}
          size="sm"
          onClick={() => setCropEditingElement(isCropEditing ? null : element.id)}
        >
          {isCropEditing ? <Check size={14} strokeWidth={1.9} /> : <Crop size={14} strokeWidth={1.75} />}
          {isCropEditing ? 'Done adjusting crop' : 'Adjust crop'}
        </Button>
      ) : null}
      {isCropEditing ? (
        <p className="text-2xs text-ink-secondary">Drag the image on the canvas to reposition the crop.</p>
      ) : null}
    </section>
  );
}
