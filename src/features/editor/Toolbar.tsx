import { useState } from 'react';
import { ChevronLeft, Clapperboard, Download, FileJson, MoreHorizontal, PlayCircle, Presentation, Redo2, Undo2 } from 'lucide-react';
import { useEditorStore } from '../../state/editorStore';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Tooltip } from '../../components/ui/Tooltip';
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from '../../components/ui/Dropdown';
import { downloadProjectJson } from '../projects/projectIO';
import { exportProjectToVideo, type ExportVideoFormat } from '../export/exportSlideshow';
import { useToast } from '../../components/ui/useToast';
import type { ProjectMode } from '../../lib/types';

const MODE_OPTIONS: Array<{ value: ProjectMode; label: string }> = [
  { value: 'video', label: 'Video' },
  { value: 'slideshow', label: 'Slides' },
  { value: 'presentation', label: 'Present' },
];

interface ToolbarProps {
  onClose: () => void;
}

export function Toolbar({ onClose }: ToolbarProps) {
  const project = useEditorStore((s) => s.project);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const renameProject = useEditorStore((s) => s.renameProject);
  const setProjectFormat = useEditorStore((s) => s.setProjectFormat);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const past = useEditorStore((s) => s.past);
  const future = useEditorStore((s) => s.future);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(project?.name ?? '');
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null);
  const { show } = useToast();

  if (!project) return null;

  const handleExport = async (format: ExportVideoFormat) => {
    if (exportProgress) return;
    setExportProgress({ done: 0, total: project.scenes.length });
    show({ title: `Exporting ${format.toUpperCase()}`, description: 'Rendering slides to a video file.', tone: 'info' });
    try {
      const { fileName } = await exportProjectToVideo(project, format, (done, total) => setExportProgress({ done, total }));
      show({ title: 'Export complete', description: `${fileName} has been downloaded.`, tone: 'success' });
    } catch (error) {
      show({ title: 'Export failed', description: error instanceof Error ? error.message : 'Unexpected export error.', tone: 'error' });
    } finally {
      setExportProgress(null);
    }
  };

  const commitName = () => {
    setEditingName(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== project.name) renameProject(trimmed);
    else setDraftName(project.name);
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-workspace/80 px-3 backdrop-blur-xl">
      <IconButton label="Back to projects" icon={<ChevronLeft size={18} strokeWidth={1.75} />} onClick={onClose} />

      <div className="flex items-center gap-2 pr-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-ink text-surface">
          <Clapperboard size={14} strokeWidth={1.9} />
        </span>
        {editingName ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="h-7 w-44 rounded-sm border border-focus bg-surface px-2 text-sm text-ink outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraftName(project.name);
              setEditingName(true);
            }}
            className="rounded-sm px-1.5 text-sm font-medium text-ink hover:bg-surface-hover"
          >
            {project.name}
          </button>
        )}
        <span className="inline-block w-[11ch] text-2xs text-ink-muted">
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : 'Saved'}
        </span>
        <Dropdown>
          <DropdownTrigger asChild>
            <IconButton label="Project options" icon={<MoreHorizontal size={15} strokeWidth={1.75} />} size="sm" showTooltip={false} />
          </DropdownTrigger>
          <DropdownContent>
            <DropdownItem
              onSelect={() => {
                downloadProjectJson(project);
                show({ title: 'Project JSON exported', description: 'Media files are not included in this file.', tone: 'info' });
              }}
            >
              <FileJson size={14} strokeWidth={1.75} />
              Export project JSON
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>

      <div className="flex items-center gap-1 border-l border-line pl-3">
        <Tooltip content="Undo" shortcut="⌘Z">
          <span>
            <IconButton label="Undo" icon={<Undo2 size={16} strokeWidth={1.75} />} disabled={!past.length} onClick={undo} showTooltip={false} size="sm" />
          </span>
        </Tooltip>
        <Tooltip content="Redo" shortcut="⌘⇧Z">
          <span>
            <IconButton label="Redo" icon={<Redo2 size={16} strokeWidth={1.75} />} disabled={!future.length} onClick={redo} showTooltip={false} size="sm" />
          </span>
        </Tooltip>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <SegmentedControl
          options={MODE_OPTIONS}
          value={project.mode}
          onChange={(mode) => setProjectFormat(mode, project.width, project.height)}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="tabular-nums rounded-pill border border-line bg-surface-raised px-2.5 py-1 text-2xs text-ink-secondary">
          {project.width}&times;{project.height}
        </span>
        <Tooltip content="Full-screen presentation arrives in a later milestone">
          <span>
            <Button variant="outline" size="sm" disabled>
              <Presentation size={15} strokeWidth={1.75} />
              Present
            </Button>
          </span>
        </Tooltip>
        <Tooltip content="Timed preview playback arrives in a later milestone">
          <span>
            <Button variant="outline" size="sm" disabled>
              <PlayCircle size={15} strokeWidth={1.75} />
              Preview
            </Button>
          </span>
        </Tooltip>
        <Dropdown>
          <Tooltip content="Export slides as a video file">
            <span>
              <DropdownTrigger asChild>
                <Button variant="dark" size="sm" disabled={!!exportProgress}>
                  <Download size={15} strokeWidth={1.75} />
                  {exportProgress ? `Exporting ${exportProgress.done}/${exportProgress.total}` : 'Export'}
                </Button>
              </DropdownTrigger>
            </span>
          </Tooltip>
          <DropdownContent align="end">
            <DropdownItem onSelect={() => void handleExport('mp4')}>
              MP4 video
            </DropdownItem>
            <DropdownItem onSelect={() => void handleExport('webm')}>
              WebM video
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>
    </header>
  );
}
