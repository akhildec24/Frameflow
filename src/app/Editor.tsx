import { useEffect, useState } from 'react';
import { useEditorStore } from '../state/editorStore';
import { getProject } from '../storage/projectRepository';
import { EditorShell } from './EditorShell';
import { Button } from '../components/ui/Button';

interface EditorProps {
  projectId: string;
  onClose: () => void;
}

export function Editor({ projectId, onClose }: EditorProps) {
  const loadProject = useEditorStore((s) => s.loadProject);
  const closeProject = useEditorStore((s) => s.closeProject);
  const project = useEditorStore((s) => s.project);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    let cancelled = false;
    getProject(projectId).then((loaded) => {
      if (cancelled) return;
      if (loaded) {
        loadProject(loaded);
        setStatus('ready');
      } else {
        setStatus('missing');
      }
    });
    return () => {
      cancelled = true;
      closeProject();
    };
  }, [projectId, loadProject, closeProject]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-frame text-sm text-surface/70">
        Loading project&hellip;
      </div>
    );
  }

  if (status === 'missing' || !project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-frame text-surface">
        <p className="text-sm">This project could not be found. It may have been deleted.</p>
        <Button variant="dark" onClick={onClose}>
          Back to projects
        </Button>
      </div>
    );
  }

  return <EditorShell onClose={onClose} />;
}
