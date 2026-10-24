import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import { ColorField } from '../../../components/ui/ColorField';
import { NumberField } from '../../../components/ui/NumberField';
import { Slider } from '../../../components/ui/Slider';
import { IconButton } from '../../../components/ui/IconButton';
import { useEditorStore } from '../../../state/editorStore';
import type { TextElement } from '../../../lib/types';

const FONT_OPTIONS = ['Inter Variable', 'Georgia', 'ui-monospace'];

export function TextSection({ element }: { element: TextElement }) {
  const updateElement = useEditorStore((s) => s.updateElement);

  const setStyle = (patch: Partial<TextElement['style']>) =>
    updateElement(element.id, (el) => {
      if (el.kind === 'text') Object.assign(el.style, patch);
    });

  return (
    <section className="flex flex-col gap-3 border-b border-line p-3">
      <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-secondary">Text</h3>

      <label className="flex flex-col gap-1">
        <span className="text-2xs text-ink-secondary">Font</span>
        <select
          value={element.style.fontFamily}
          onChange={(e) => setStyle({ fontFamily: e.target.value })}
          className="h-8 rounded-sm border border-line bg-surface px-2 text-sm text-ink outline-none focus:border-focus"
        >
          {FONT_OPTIONS.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Size"
          value={element.style.fontSize}
          min={6}
          onChange={(fontSize) => setStyle({ fontSize })}
          suffix="px"
        />
        <NumberField
          label="Weight"
          value={element.style.fontWeight}
          min={100}
          max={900}
          step={10}
          onChange={(fontWeight) => setStyle({ fontWeight })}
        />
      </div>

      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-2xs text-ink-secondary">Colour</span>
          <ColorField
            value={element.style.colour}
            aria-label="Text colour"
            onChange={(colour) => setStyle({ colour })}
          />
        </label>
        <div className="flex gap-1">
          <IconButton
            label="Align left"
            icon={<AlignLeft size={15} strokeWidth={1.75} />}
            active={element.style.align === 'left'}
            onClick={() => setStyle({ align: 'left' })}
          />
          <IconButton
            label="Align centre"
            icon={<AlignCenter size={15} strokeWidth={1.75} />}
            active={element.style.align === 'centre'}
            onClick={() => setStyle({ align: 'centre' })}
          />
          <IconButton
            label="Align right"
            icon={<AlignRight size={15} strokeWidth={1.75} />}
            active={element.style.align === 'right'}
            onClick={() => setStyle({ align: 'right' })}
          />
        </div>
      </div>

      <Slider
        label="Line height"
        value={element.style.lineHeight}
        min={0.8}
        max={2.2}
        step={0.05}
        onChange={(lineHeight) => setStyle({ lineHeight })}
        formatValue={(v) => v.toFixed(2)}
      />
      <Slider
        label="Letter spacing"
        value={element.style.letterSpacing}
        min={-0.05}
        max={0.3}
        step={0.005}
        onChange={(letterSpacing) => setStyle({ letterSpacing })}
        formatValue={(v) => v.toFixed(3)}
      />
    </section>
  );
}
