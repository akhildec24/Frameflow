import { useEffect } from 'react';
import { useEditorStore } from './editorStore';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

/** Global editor keyboard shortcuts: undo/redo, duplicate and delete. */
export function useEditorShortcuts() {
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds);
  const removeElements = useEditorStore((s) => s.removeElements);
  const duplicateElements = useEditorStore((s) => s.duplicateElements);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const clearSelection = useEditorStore((s) => s.clearSelection);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }

      if (meta && event.key.toLowerCase() === 'd') {
        if (selectedElementIds.length) {
          event.preventDefault();
          duplicateElements(selectedElementIds);
        }
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedElementIds.length) {
          event.preventDefault();
          removeElements(selectedElementIds);
        }
        return;
      }

      if (event.key === 'Escape') {
        clearSelection();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedElementIds, removeElements, duplicateElements, undo, redo, clearSelection]);
}
