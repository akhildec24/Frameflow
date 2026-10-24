import { Toolbar } from '../features/editor/Toolbar';
import { MediaLibraryPanel } from '../features/media/MediaLibraryPanel';
import { CanvasStage } from '../features/canvas/CanvasStage';
import { Inspector } from '../features/inspector/Inspector';
import { SceneStrip } from '../features/timeline/SceneStrip';
import { useAutosave } from '../state/useAutosave';
import { useEditorShortcuts } from '../state/useEditorShortcuts';

interface EditorShellProps {
  onClose: () => void;
}

export function EditorShell({ onClose }: EditorShellProps) {
  useAutosave();
  useEditorShortcuts();

  return (
    <div className="flex h-screen flex-col bg-workspace">
      <Toolbar onClose={onClose} />
      <div className="flex min-h-0 flex-1">
        <MediaLibraryPanel />
        <CanvasStage />
        <Inspector />
      </div>
      <SceneStrip />
    </div>
  );
}
