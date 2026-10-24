import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { NEW_PROJECT_KINDS, RESOLUTION_PRESETS, createNewProject } from './createProject';
import { saveProject } from '../../storage/projectRepository';
import type { ProjectMode } from '../../lib/types';
import { cn } from '../../lib/cn';

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (projectId: string) => void;
}

const FPS_OPTIONS: Array<24 | 25 | 30> = [24, 25, 30];

export function NewProjectDialog({ open, onOpenChange, onCreated }: NewProjectDialogProps) {
  const [kindIndex, setKindIndex] = useState(0);
  const [presetIndex, setPresetIndex] = useState(0);
  const [fps, setFps] = useState<24 | 25 | 30>(30);
  const [name, setName] = useState('Untitled project');
  const [creating, setCreating] = useState(false);

  const kind = NEW_PROJECT_KINDS[kindIndex];
  const preset = RESOLUTION_PRESETS[presetIndex];
  const showFps = kind.mode !== 'presentation';

  const handleCreate = async () => {
    setCreating(true);
    try {
      const project = createNewProject({
        name: name.trim() || 'Untitled project',
        mode: kind.mode as ProjectMode,
        width: preset.width,
        height: preset.height,
        fps,
      });
      await saveProject(project);
      onCreated(project.id);
      onOpenChange(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New project"
      description="Choose a starting point. You can change format later."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="dark" onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating' : 'Create project'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-2xs text-ink-secondary">Project name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 rounded-sm border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-focus focus:ring-1 focus:ring-focus/40"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-2xs text-ink-secondary">Project type</span>
          <div className="grid grid-cols-2 gap-2">
            {NEW_PROJECT_KINDS.map((item, index) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setKindIndex(index)}
                className={cn(
                  'rounded-sm border px-3 py-2 text-left transition-colors',
                  index === kindIndex
                    ? 'border-focus bg-copper-soft/40'
                    : 'border-line hover:bg-surface-hover',
                )}
              >
                <p className="text-sm font-medium text-ink">{item.label}</p>
                <p className="text-2xs text-ink-secondary">{item.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-2xs text-ink-secondary">Resolution</span>
          <div className="flex flex-wrap gap-1.5">
            {RESOLUTION_PRESETS.map((item, index) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setPresetIndex(index)}
                className={cn(
                  'rounded-pill border px-2.5 py-1 text-2xs font-medium transition-colors',
                  index === presetIndex
                    ? 'border-ink bg-ink text-surface'
                    : 'border-line text-ink-secondary hover:bg-surface-hover',
                )}
              >
                {item.ratio} · {item.width}x{item.height}
              </button>
            ))}
          </div>
        </div>

        {showFps ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-2xs text-ink-secondary">Frame rate</span>
            <div className="flex gap-1.5">
              {FPS_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFps(option)}
                  className={cn(
                    'h-8 w-16 rounded-sm border text-xs font-medium transition-colors',
                    option === fps
                      ? 'border-ink bg-ink text-surface'
                      : 'border-line text-ink-secondary hover:bg-surface-hover',
                  )}
                >
                  {option} fps
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
