import { createId } from '../../lib/id';
import type { MediaAsset, MediaElement, Scene, TextElement, TextStyle, Transform } from '../../lib/types';

const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Inter Variable',
  fontSize: 42,
  fontWeight: 620,
  colour: '#252522',
  align: 'left',
  lineHeight: 1.2,
  letterSpacing: -0.01,
};

function nextZIndex(scene: Scene): number {
  return scene.elements.reduce((max, el) => Math.max(max, el.zIndex), 0) + 1;
}

export function createMediaElement(
  asset: MediaAsset,
  scene: Scene,
  canvas: { width: number; height: number },
  options?: { fullBleed?: boolean },
): MediaElement {
  const assetAspect = asset.width && asset.height ? asset.width / asset.height : canvas.width / canvas.height;
  const targetWidth = options?.fullBleed ? canvas.width : canvas.width * 0.6;
  const targetHeight = options?.fullBleed ? canvas.height : targetWidth / assetAspect;

  const transform: Transform = {
    x: (canvas.width - targetWidth) / 2,
    y: (canvas.height - targetHeight) / 2,
    width: targetWidth,
    height: targetHeight,
    rotation: 0,
    flipX: false,
    flipY: false,
    fit: 'cover',
  };

  return {
    id: createId(),
    name: asset.name,
    transform,
    startMs: 0,
    durationMs: asset.type === 'video' ? Math.min(asset.durationMs ?? 4000, 8000) : 4000,
    zIndex: nextZIndex(scene),
    opacity: 1,
    locked: false,
    hidden: false,
    kind: 'media',
    assetId: asset.id,
    trimStartMs: 0,
    muted: false,
    volume: 1,
    caption: asset.caption ? { show: true, position: 'bottom' as const, style: 'bar' as const } : undefined,
  };
}

export function createTextElement(scene: Scene, canvas: { width: number; height: number }): TextElement {
  const width = canvas.width * 0.5;
  const height = canvas.height * 0.18;
  const transform: Transform = {
    x: (canvas.width - width) / 2,
    y: (canvas.height - height) / 2,
    width,
    height,
    rotation: 0,
    flipX: false,
    flipY: false,
    fit: 'contain',
  };

  return {
    id: createId(),
    name: 'Text',
    transform,
    startMs: 0,
    durationMs: 4000,
    zIndex: nextZIndex(scene),
    opacity: 1,
    locked: false,
    hidden: false,
    kind: 'text',
    content: 'Add a heading',
    style: { ...DEFAULT_TEXT_STYLE },
  };
}

export function createEmptyScene(name: string): Scene {
  return {
    id: createId(),
    name,
    durationMs: 4000,
    background: '#FFFFFF',
    elements: [],
    advance: 'manual',
  };
}
