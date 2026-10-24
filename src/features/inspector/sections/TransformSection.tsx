import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  FlipHorizontal2,
  FlipVertical2,
} from 'lucide-react';
import { NumberField } from '../../../components/ui/NumberField';
import { IconButton } from '../../../components/ui/IconButton';
import { useEditorStore, type AlignMode } from '../../../state/editorStore';
import type { Element } from '../../../lib/types';
import type { ReactNode } from 'react';

const ALIGN_BUTTONS = [
  { mode: 'left', label: 'Align left', icon: <AlignStartHorizontal size={15} strokeWidth={1.75} /> },
  { mode: 'centerX', label: 'Align centre', icon: <AlignCenterHorizontal size={15} strokeWidth={1.75} /> },
  { mode: 'right', label: 'Align right', icon: <AlignEndHorizontal size={15} strokeWidth={1.75} /> },
  { mode: 'top', label: 'Align top', icon: <AlignStartVertical size={15} strokeWidth={1.75} /> },
  { mode: 'centerY', label: 'Align middle', icon: <AlignCenterVertical size={15} strokeWidth={1.75} /> },
  { mode: 'bottom', label: 'Align bottom', icon: <AlignEndVertical size={15} strokeWidth={1.75} /> },
] as const satisfies ReadonlyArray<{ mode: AlignMode; label: string; icon: ReactNode }>;

export function TransformSection({ element }: { element: Element }) {
  const updateElement = useEditorStore((s) => s.updateElement);
  const alignElements = useEditorStore((s) => s.alignElements);
  const { transform } = element;

  const set = (patch: Partial<typeof transform>) => {
    updateElement(element.id, (el) => {
      Object.assign(el.transform, patch);
    });
  };

  return (
    <section className="flex flex-col gap-2.5 border-b border-line p-3">
      <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-secondary">Transform</h3>
      <div className="grid grid-cols-6 gap-1">
        {ALIGN_BUTTONS.map(({ mode, label, icon }) => (
          <IconButton key={mode} label={label} icon={icon} size="sm" onClick={() => alignElements([element.id], mode)} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="X" value={Math.round(transform.x)} onChange={(x) => set({ x })} suffix="px" />
        <NumberField label="Y" value={Math.round(transform.y)} onChange={(y) => set({ y })} suffix="px" />
        <NumberField
          label="Width"
          value={Math.round(transform.width)}
          min={12}
          onChange={(width) => set({ width })}
          suffix="px"
        />
        <NumberField
          label="Height"
          value={Math.round(transform.height)}
          min={12}
          onChange={(height) => set({ height })}
          suffix="px"
        />
      </div>
      <div className="flex items-end gap-2">
        <NumberField
          label="Rotation"
          value={Math.round(transform.rotation)}
          onChange={(rotation) => set({ rotation })}
          suffix="°"
          className="flex-1"
        />
        <IconButton
          label="Flip horizontal"
          icon={<FlipHorizontal2 size={15} strokeWidth={1.75} />}
          active={transform.flipX}
          onClick={() => set({ flipX: !transform.flipX })}
        />
        <IconButton
          label="Flip vertical"
          icon={<FlipVertical2 size={15} strokeWidth={1.75} />}
          active={transform.flipY}
          onClick={() => set({ flipY: !transform.flipY })}
        />
      </div>
    </section>
  );
}
