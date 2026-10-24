import { createId } from '../../lib/id';
import { createEmptyScene } from '../canvas/elementFactory';
import { CURRENT_SCHEMA_VERSION } from '../../lib/types';
import type { Project, ProjectMode } from '../../lib/types';

export interface ResolutionPreset {
  label: string;
  width: number;
  height: number;
  ratio: string;
}

export const RESOLUTION_PRESETS: ResolutionPreset[] = [
  { label: 'Widescreen video', width: 1920, height: 1080, ratio: '16:9' },
  { label: 'Social reel', width: 1080, height: 1920, ratio: '9:16' },
  { label: 'Square', width: 1080, height: 1080, ratio: '1:1' },
  { label: 'Portrait post', width: 1080, height: 1350, ratio: '4:5' },
  { label: 'Standard', width: 1600, height: 1200, ratio: '4:3' },
];

export const NEW_PROJECT_KINDS: Array<{ label: string; mode: ProjectMode; description: string }> = [
  { label: 'Blank video', mode: 'video', description: 'Time-based playback and export.' },
  { label: 'Slideshow', mode: 'slideshow', description: 'Timed scenes with optional soundtrack.' },
  { label: 'Presentation', mode: 'presentation', description: 'Manual scene advancement for meetings.' },
  { label: 'Social reel', mode: 'video', description: 'Portrait video for social platforms.' },
];

export function createNewProject(options: {
  name: string;
  mode: ProjectMode;
  width: number;
  height: number;
  fps: 24 | 25 | 30;
}): Project {
  const now = new Date().toISOString();
  const scene = createEmptyScene('Scene 1');
  return {
    id: createId(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name: options.name,
    mode: options.mode,
    width: options.width,
    height: options.height,
    fps: options.fps,
    scenes: [scene],
    assets: {},
    activeSceneId: scene.id,
    createdAt: now,
    updatedAt: now,
  };
}
