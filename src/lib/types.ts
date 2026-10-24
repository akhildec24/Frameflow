export type UUID = string;

export type ProjectMode = 'video' | 'slideshow' | 'presentation';
export type MediaType = 'image' | 'video' | 'audio';
export type FitMode = 'contain' | 'cover' | 'free';
export type TransitionType = 'cut' | 'crossfade' | 'slide' | 'zoom';
export type SceneAdvance = 'manual' | 'timed';
export type TextAlign = 'left' | 'centre' | 'right';

export interface CropPan {
  /** 0 to 1. Chooses where the visible crop window sits along the axis with spare image to show. */
  x: number;
  y: number;
}

export interface Transform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  /**
   * Pan/zoom for `cover` and `free` fit, resolved against the element's
   * current box size at render time so crop framing survives resizing
   * without distortion. `contain` ignores these. `zoom` is >= 1; 1 means
   * the minimum crop needed to cover the box with no distortion.
   */
  pan?: CropPan;
  zoom?: number;
  fit: FitMode;
}

export interface ElementBase {
  id: UUID;
  name: string;
  transform: Transform;
  startMs: number;
  durationMs: number;
  zIndex: number;
  opacity: number;
  locked: boolean;
  hidden: boolean;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  colour: string;
  align: TextAlign;
  lineHeight: number;
  letterSpacing: number;
  background?: string;
}

export type CaptionPosition = 'top' | 'bottom';
export type CaptionStyle = 'bar' | 'pill';

export interface CaptionConfig {
  show: boolean;
  position: CaptionPosition;
  style: CaptionStyle;
  /** User override; empty/undefined falls back to the asset's embedded caption. */
  text?: string;
}

export type MediaElement = ElementBase & {
  kind: 'media';
  assetId: UUID;
  trimStartMs: number;
  muted: boolean;
  volume: number;
  caption?: CaptionConfig;
};

export type TextElement = ElementBase & {
  kind: 'text';
  content: string;
  style: TextStyle;
};

export type Element = MediaElement | TextElement;

export interface SceneTransition {
  type: TransitionType;
  durationMs: number;
}

export interface Scene {
  id: UUID;
  name: string;
  durationMs: number;
  background: string;
  elements: Element[];
  transitionOut?: SceneTransition;
  advance: SceneAdvance;
}

export interface MediaAsset {
  id: UUID;
  name: string;
  type: MediaType;
  mimeType: string;
  width?: number;
  height?: number;
  durationMs?: number;
  sizeBytes: number;
  storageKey: string;
  thumbnailDataUrl?: string;
  /** Caption text embedded in the file's metadata (IPTC/XMP/EXIF). */
  caption?: string;
  hash?: string;
  createdAt: string;
  /** Set when the asset could not be fully processed (e.g. unsupported codec). */
  status: 'ready' | 'processing' | 'error';
  errorMessage?: string;
}

export interface Project {
  id: UUID;
  schemaVersion: number;
  name: string;
  mode: ProjectMode;
  width: number;
  height: number;
  fps: 24 | 25 | 30;
  scenes: Scene[];
  assets: Record<UUID, MediaAsset>;
  activeSceneId: UUID;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: UUID;
  name: string;
  mode: ProjectMode;
  width: number;
  height: number;
  durationMs: number;
  updatedAt: string;
  thumbnailDataUrl?: string;
}

export const CURRENT_SCHEMA_VERSION = 1;
