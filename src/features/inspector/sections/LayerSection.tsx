import { Copy, Eye, EyeOff, Lock, SendToBack, BringToFront, ChevronUp, ChevronDown, Trash2, Unlock } from 'lucide-react';
import { IconButton } from '../../../components/ui/IconButton';
import { useEditorStore } from '../../../state/editorStore';
import type { Element } from '../../../lib/types';

export function LayerSection({ element }: { element: Element }) {
  const toggleLock = useEditorStore((s) => s.toggleLock);
  const toggleHidden = useEditorStore((s) => s.toggleHidden);
  const reorderZ = useEditorStore((s) => s.reorderZ);
  const duplicateElements = useEditorStore((s) => s.duplicateElements);
  const removeElements = useEditorStore((s) => s.removeElements);

  return (
    <section className="flex flex-col gap-2.5 p-3">
      <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-secondary">Layer</h3>
      <div className="flex flex-wrap items-center gap-1">
        <IconButton
          label="Send to back"
          icon={<SendToBack size={15} strokeWidth={1.75} />}
          onClick={() => reorderZ(element.id, 'back')}
        />
        <IconButton
          label="Send backward"
          icon={<ChevronDown size={15} strokeWidth={1.75} />}
          onClick={() => reorderZ(element.id, 'backward')}
        />
        <IconButton
          label="Bring forward"
          icon={<ChevronUp size={15} strokeWidth={1.75} />}
          onClick={() => reorderZ(element.id, 'forward')}
        />
        <IconButton
          label="Bring to front"
          icon={<BringToFront size={15} strokeWidth={1.75} />}
          onClick={() => reorderZ(element.id, 'front')}
        />
        <span className="mx-1 h-5 w-px bg-line" />
        <IconButton
          label={element.locked ? 'Unlock element' : 'Lock element'}
          icon={element.locked ? <Unlock size={15} strokeWidth={1.75} /> : <Lock size={15} strokeWidth={1.75} />}
          active={element.locked}
          onClick={() => toggleLock(element.id)}
        />
        <IconButton
          label={element.hidden ? 'Show element' : 'Hide element'}
          icon={element.hidden ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
          active={element.hidden}
          onClick={() => toggleHidden(element.id)}
        />
        <IconButton
          label="Duplicate"
          icon={<Copy size={15} strokeWidth={1.75} />}
          onClick={() => duplicateElements([element.id])}
        />
        <IconButton
          label="Delete"
          icon={<Trash2 size={15} strokeWidth={1.75} />}
          onClick={() => removeElements([element.id])}
        />
      </div>
    </section>
  );
}
