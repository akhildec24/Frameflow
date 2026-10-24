import { useRef, useState } from 'react';
import { FileUp, Film, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from '../../components/ui/Dropdown';
import { NewProjectDialog } from './NewProjectDialog';
import { useProjects } from './useProjects';
import { formatTimecode } from '../../lib/time';
import { useToast } from '../../components/ui/useToast';
import { readProjectJsonFile } from './projectIO';
import { createId } from '../../lib/id';

interface LauncherProps {
  onOpenProject: (id: string) => void;
}

export function Launcher({ onOpenProject }: LauncherProps) {
  const { summaries, loading, remove, saveProject, refresh } = useProjects();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { show } = useToast();
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleDelete = async (id: string, name: string) => {
    await remove(id);
    show({ title: 'Project deleted', description: `"${name}" and its unused media were removed.`, tone: 'info' });
  };

  const handleImportFile = async (file: File) => {
    try {
      const { project } = await readProjectJsonFile(file);
      const now = new Date().toISOString();
      const imported = { ...project, id: createId(), createdAt: now, updatedAt: now };
      await saveProject(imported);
      await refresh();
      show({
        title: 'Project imported',
        description: 'Project JSON does not include media files; re-import them from the library.',
        tone: 'info',
      });
    } catch (error) {
      show({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Could not read that file.',
        tone: 'error',
      });
    }
  };

  return (
    <div className="min-h-screen bg-frame p-6">
      <div className="mx-auto max-w-5xl rounded-lg bg-workspace p-6 shadow-card">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-ink text-surface">
              <Film size={16} strokeWidth={1.75} />
            </span>
            <h1 className="text-lg font-semibold tracking-[-0.02em] text-ink">Frameflow</h1>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportFile(file);
                e.target.value = '';
              }}
            />
            <Button variant="outline" onClick={() => importInputRef.current?.click()}>
              <FileUp size={16} strokeWidth={1.75} />
              Import project JSON
            </Button>
            <Button variant="dark" onClick={() => setDialogOpen(true)}>
              <Plus size={16} strokeWidth={1.9} />
              New project
            </Button>
          </div>
        </header>

        {loading ? (
          <p className="py-16 text-center text-sm text-ink-secondary">Loading projects&hellip;</p>
        ) : summaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-line-strong py-20">
            <p className="text-sm text-ink-secondary">No projects yet.</p>
            <Button variant="dark" onClick={() => setDialogOpen(true)}>
              <Plus size={16} strokeWidth={1.9} />
              Create your first project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {summaries.map((project) => (
              <div
                key={project.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenProject(project.id)}
                onKeyDown={(e) => e.key === 'Enter' && onOpenProject(project.id)}
                className="group cursor-pointer overflow-hidden rounded-md border border-line bg-surface-raised shadow-card transition-transform hover:-translate-y-0.5"
              >
                <div className="relative aspect-video w-full bg-canvas-surround">
                  {project.thumbnailDataUrl ? (
                    <img
                      src={project.thumbnailDataUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-ink-muted">
                      <Film size={22} strokeWidth={1.5} />
                    </div>
                  )}
                  <div
                    className="absolute left-2 top-2 rounded-pill bg-ink/80 px-2 py-0.5 text-2xs text-surface"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {project.width}x{project.height}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{project.name}</p>
                    <p className="text-2xs text-ink-secondary">
                      {project.mode} &middot; {formatTimecode(project.durationMs)} &middot;{' '}
                      {new Date(project.updatedAt).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Dropdown>
                      <DropdownTrigger asChild>
                        <IconButton
                          label="Project options"
                          icon={<MoreHorizontal size={16} strokeWidth={1.75} />}
                          size="sm"
                          showTooltip={false}
                        />
                      </DropdownTrigger>
                      <DropdownContent align="end">
                        <DropdownItem destructive onSelect={() => handleDelete(project.id, project.name)}>
                          <Trash2 size={14} strokeWidth={1.75} />
                          Delete project
                        </DropdownItem>
                      </DropdownContent>
                    </Dropdown>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={onOpenProject} />
    </div>
  );
}
