import { NumberField } from '../../../components/ui/NumberField';
import { useEditorStore } from '../../../state/editorStore';
import type { Element } from '../../../lib/types';

export function TimingSection({ element }: { element: Element }) {
  const updateElement = useEditorStore((s) => s.updateElement);

  return (
    <section className="flex flex-col gap-2.5 border-b border-line p-3">
      <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-secondary">Timing</h3>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Start"
          value={element.startMs}
          min={0}
          step={100}
          onChange={(startMs) => updateElement(element.id, (el) => { el.startMs = Math.max(0, startMs); })}
          suffix="ms"
        />
        <NumberField
          label="Duration"
          value={element.durationMs}
          min={100}
          step={100}
          onChange={(durationMs) => updateElement(element.id, (el) => { el.durationMs = Math.max(100, durationMs); })}
          suffix="ms"
        />
      </div>
      <p className="text-2xs text-ink-muted">
        Applied once the scene timeline and playback milestone lands.
      </p>
    </section>
  );
}
