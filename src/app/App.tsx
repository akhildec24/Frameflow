import { useCallback, useState } from 'react';
import { TooltipProvider } from '../components/ui/Tooltip';
import { ToastProvider } from '../components/ui/Toast';
import { Launcher } from '../features/projects/Launcher';
import { Editor } from './Editor';

const LAST_PROJECT_KEY = 'frameflow:lastProjectId';

export default function App() {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() =>
    window.localStorage.getItem(LAST_PROJECT_KEY),
  );

  const openProject = useCallback((id: string) => {
    window.localStorage.setItem(LAST_PROJECT_KEY, id);
    setActiveProjectId(id);
  }, []);

  const closeProject = useCallback(() => {
    window.localStorage.removeItem(LAST_PROJECT_KEY);
    setActiveProjectId(null);
  }, []);

  return (
    <ToastProvider>
      <TooltipProvider>
        {activeProjectId ? (
          <Editor key={activeProjectId} projectId={activeProjectId} onClose={closeProject} />
        ) : (
          <Launcher onOpenProject={openProject} />
        )}
      </TooltipProvider>
    </ToastProvider>
  );
}
