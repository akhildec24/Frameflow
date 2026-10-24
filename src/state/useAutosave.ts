import { useEffect, useRef } from 'react';
import { useEditorStore } from './editorStore';
import { saveProject } from '../storage/projectRepository';

const DEBOUNCE_MS = 800;

/** Debounced autosave: persists the active project to IndexedDB shortly after edits settle. */
export function useAutosave() {
  const project = useEditorStore((s) => s.project);
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus);
  const timer = useRef<number | null>(null);
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (!project) return;
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    setSaveStatus('saving');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      try {
        await saveProject(project);
        setSaveStatus('saved');
      } catch (error) {
        console.error('Autosave failed', error);
        setSaveStatus('error');
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [project, setSaveStatus]);
}
