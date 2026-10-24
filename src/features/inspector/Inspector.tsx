import { Layers2, Lock, EyeOff, Trash2, Copy } from 'lucide-react';
import { useEditorStore } from '../../state/editorStore';
import type { Element } from '../../lib/types';
import { TransformSection } from './sections/TransformSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { CaptionSection } from './sections/CaptionSection';
import { TextSection } from './sections/TextSection';
import { TimingSection } from './sections/TimingSection';
import { LayerSection } from './sections/LayerSection';
import { SceneInspector } from './SceneInspector';
import { IconButton } from '../../components/ui/IconButton';

export function Inspector() {
  const project = useEditorStore((s) => s.project);
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds);
  const toggleLock = useEditorStore((s) => s.toggleLock);
  const toggleHidden = useEditorStore((s) => s.toggleHidden);
  const duplicateElements = useEditorStore((s) => s.duplicateElements);
  const removeElements = useEditorStore((s) => s.removeElements);

  if (!project) return null;

  const scene = project.scenes.find((s) => s.id === project.activeSceneId) ?? project.scenes[0];
  const selectedElements = scene?.elements.filter((el) => selectedElementIds.includes(el.id)) ?? [];

  return (
    <aside className="flex w-[288px] shrink-0 flex-col overflow-y-auto border-l border-line bg-surface-raised">
      {selectedElements.length === 0 ? (
        scene ? <SceneInspector scene={scene} /> : <EmptyState />
      ) : selectedElements.length === 1 ? (
        <SingleSelection element={selectedElements[0]} />
      ) : (
        <div className="flex flex-col gap-3 p-3">
          <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-secondary">
            {selectedElements.length} elements selected
          </h3>
          <div className="flex flex-wrap gap-1">
            <IconButton
              label="Lock all"
              icon={<Lock size={15} strokeWidth={1.75} />}
              onClick={() => selectedElementIds.forEach((id) => toggleLock(id))}
            />
            <IconButton
              label="Hide all"
              icon={<EyeOff size={15} strokeWidth={1.75} />}
              onClick={() => selectedElementIds.forEach((id) => toggleHidden(id))}
            />
            <IconButton
              label="Duplicate all"
              icon={<Copy size={15} strokeWidth={1.75} />}
              onClick={() => duplicateElements(selectedElementIds)}
            />
            <IconButton
              label="Delete all"
              icon={<Trash2 size={15} strokeWidth={1.75} />}
              onClick={() => removeElements(selectedElementIds)}
            />
          </div>
          <p className="text-2xs text-ink-secondary">
            Select a single element to edit its position, appearance and text.
          </p>
        </div>
      )}
    </aside>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <Layers2 size={20} strokeWidth={1.5} className="text-ink-muted" />
      <p className="text-xs text-ink-secondary">
        Select an element on the canvas, or add media or text from the library, to see its properties here.
      </p>
    </div>
  );
}

function SingleSelection({ element }: { element: Element }) {
  return (
    <>
      <div className="flex h-10 items-center border-b border-line px-3">
        <p className="truncate text-sm font-medium text-ink">{element.name}</p>
      </div>
      <TransformSection element={element} />
      {element.kind === 'media' ? <AppearanceSection element={element} /> : null}
      {element.kind === 'media' ? <CaptionSection element={element} /> : null}
      {element.kind === 'text' ? <TextSection element={element} /> : null}
      <TimingSection element={element} />
      <LayerSection element={element} />
    </>
  );
}
