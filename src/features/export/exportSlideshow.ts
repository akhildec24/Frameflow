import Konva from 'konva';
import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  getFirstEncodableVideoCodec,
} from 'mediabunny';
import { acquireAssetUrl, releaseAssetUrl } from '../../storage/assetRepository';
import { computeContainRect, computeFillCrop, cropToPixels } from '../../lib/geometry';
import { downloadBlob } from '../projects/projectIO';
import { CAPTION_TEXT_FILL, captionLayout, resolveCaptionText } from '../../lib/captions';
import type { Element, MediaAsset, Project, Scene, TransitionType } from '../../lib/types';

export type ExportVideoFormat = 'mp4' | 'webm';

type LoadedSource = HTMLImageElement | HTMLVideoElement;

// MediaRecorder candidates per container, in order of preference. Only used
// when WebCodecs encoding is unavailable.
const MEDIARECORDER_MIMES: Record<ExportVideoFormat, string[]> = {
  mp4: ['video/mp4'],
  webm: ['video/webm;codecs=vp9', 'video/webm'],
};

function loadImage(url: string): Promise<LoadedSource | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function loadVideoPoster(url: string, trimStartMs: number): Promise<LoadedSource | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    let settled = false;
    const settle = (source: LoadedSource | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(source);
    };
    // Never let a decode/seek stall the whole export.
    const timer = setTimeout(() => settle(video.readyState >= 2 ? video : null), 5000);

    video.onerror = () => settle(null);
    video.onloadeddata = () => {
      const target = Math.min(trimStartMs / 1000, Math.max(0, video.duration - 0.05));
      // If the requested frame is already the current one, no seeked event fires.
      if (target > 0 && video.duration > 0 && Math.abs(video.currentTime - target) > 0.01) {
        video.onseeked = () => settle(video);
        video.currentTime = target;
      } else {
        settle(video);
      }
    };
    video.src = url;
  });
}

interface LoadedMedia {
  sources: Map<string, LoadedSource | null>;
  release: () => void;
}

/** Acquires blob URLs and decodes every media asset referenced by the project's scenes. */
async function loadProjectMedia(project: Project): Promise<LoadedMedia> {
  const assetTrims = new Map<string, number>();
  for (const scene of project.scenes) {
    for (const element of scene.elements) {
      if (element.kind === 'media' && !assetTrims.has(element.assetId)) {
        assetTrims.set(element.assetId, element.trimStartMs);
      }
    }
  }

  const acquiredKeys: string[] = [];
  const sources = new Map<string, LoadedSource | null>();

  await Promise.all(
    [...assetTrims.keys()].map(async (assetId) => {
      const asset: MediaAsset | undefined = project.assets[assetId];
      if (!asset || asset.status !== 'ready' || asset.type === 'audio') {
        sources.set(assetId, null);
        return;
      }
      try {
        const url = await acquireAssetUrl(asset.storageKey);
        acquiredKeys.push(asset.storageKey);
        sources.set(
          assetId,
          asset.type === 'image' ? await loadImage(url) : await loadVideoPoster(url, assetTrims.get(assetId) ?? 0),
        );
      } catch {
        sources.set(assetId, null);
      }
    }),
  );

  return { sources, release: () => acquiredKeys.forEach(releaseAssetUrl) };
}

function naturalSizeOf(source: LoadedSource): { width: number; height: number } {
  return 'videoWidth' in source
    ? { width: source.videoWidth || 1, height: source.videoHeight || 1 }
    : { width: source.naturalWidth || 1, height: source.naturalHeight || 1 };
}

/** Mirrors CanvasElementView's Konva prop mapping so exported frames match the editor. */
function buildElementNode(element: Element, project: Project, sources: Map<string, LoadedSource | null>): Konva.Group | Konva.Shape {
  const { transform } = element;
  const flip = {
    scaleX: transform.flipX ? -1 : 1,
    scaleY: transform.flipY ? -1 : 1,
    offsetX: transform.flipX ? transform.width : 0,
    offsetY: transform.flipY ? transform.height : 0,
  };

  if (element.kind === 'text') {
    return new Konva.Text({
      text: element.content,
      width: transform.width,
      height: transform.height,
      fontFamily: element.style.fontFamily,
      fontSize: element.style.fontSize,
      fontStyle: element.style.fontWeight >= 600 ? 'bold' : 'normal',
      fill: element.style.colour,
      align: element.style.align === 'centre' ? 'center' : element.style.align,
      lineHeight: element.style.lineHeight,
      letterSpacing: element.style.letterSpacing * element.style.fontSize,
      ...flip,
    });
  }

  const asset = project.assets[element.assetId];
  const source = sources.get(element.assetId) ?? null;

  if (!asset || asset.status === 'error') {
    return new Konva.Rect({ width: transform.width, height: transform.height, fill: '#EFEBDF', stroke: '#D6D1C6', dash: [4, 4] });
  }
  if (!source) {
    return new Konva.Rect({ width: transform.width, height: transform.height, fill: '#EFEBDF' });
  }

  const natural = naturalSizeOf(source);
  const mediaNode =
    transform.fit === 'contain'
      ? new Konva.Image({
          image: source,
          ...computeContainRect(natural, { width: transform.width, height: transform.height }),
        })
      : new Konva.Image({
          image: source,
          width: transform.width,
          height: transform.height,
          crop: cropToPixels(
            computeFillCrop(
              natural,
              { width: transform.width, height: transform.height },
              transform.pan?.x ?? 0.5,
              transform.pan?.y ?? 0.5,
              transform.zoom ?? 1,
            ),
            natural,
          ),
          ...flip,
        });

  const captionText = resolveCaptionText(element, asset);
  if (!captionText || !element.caption) return mediaNode;

  const box = captionLayout(transform.width, transform.height, element.caption, captionText);
  return new Konva.Group({ listening: false }).add(
    mediaNode,
    new Konva.Rect({
      x: box.bar.x,
      y: box.bar.y,
      width: box.bar.width,
      height: box.bar.height,
      cornerRadius: box.bar.radius,
      fill: box.barGradient ? undefined : box.barFill,
      stroke: box.barStroke,
      strokeWidth: box.barStroke ? 1 : 0,
      fillLinearGradientStartPoint: box.barGradient
        ? { x: box.barGradient.startX, y: box.barGradient.startY }
        : undefined,
      fillLinearGradientEndPoint: box.barGradient ? { x: box.barGradient.endX, y: box.barGradient.endY } : undefined,
      fillLinearGradientColorStops: box.barGradient?.stops,
    }),
    new Konva.Text({
      x: box.text.x,
      y: box.text.y,
      width: box.text.width,
      height: box.text.height,
      text: captionText,
      fontFamily: box.fontFamily,
      fontSize: box.fontSize,
      fontStyle: '500',
      fill: CAPTION_TEXT_FILL,
      align: box.textAlign,
      verticalAlign: 'middle',
      wrap: 'none',
      ellipsis: true,
    }),
  );
}

function renderSceneFrame(scene: Scene, project: Project, sources: Map<string, LoadedSource | null>): HTMLCanvasElement {
  const stage = new Konva.Stage({ container: document.createElement('div'), width: project.width, height: project.height });
  const layer = new Konva.Layer({ listening: false });
  layer.add(new Konva.Rect({ x: 0, y: 0, width: project.width, height: project.height, fill: scene.background || '#000000' }));

  const ordered = [...scene.elements].sort((a, b) => a.zIndex - b.zIndex);
  for (const element of ordered) {
    if (element.hidden) continue;
    const { transform } = element;
    layer.add(
      new Konva.Group({ x: transform.x, y: transform.y, rotation: transform.rotation, opacity: element.opacity })
        .add(buildElementNode(element, project, sources)),
    );
  }

  stage.add(layer);
  layer.draw();
  // Copy to a standalone canvas — destroying the stage may wipe the layer's canvas.
  const frame = layer.toCanvas({ x: 0, y: 0, width: project.width, height: project.height, pixelRatio: 1 });
  stage.destroy();
  return frame;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Blends two rendered scene frames: progress 0 shows `from`, 1 shows `to`. */
function drawTransitionFrame(
  ctx: CanvasRenderingContext2D,
  from: HTMLCanvasElement,
  to: HTMLCanvasElement,
  type: TransitionType,
  progress: number,
  width: number,
  height: number,
): void {
  switch (type) {
    case 'crossfade':
      ctx.globalAlpha = 1;
      ctx.drawImage(from, 0, 0);
      ctx.globalAlpha = progress;
      ctx.drawImage(to, 0, 0);
      ctx.globalAlpha = 1;
      break;
    case 'slide':
      // Outgoing exits left while the next slide enters from the right.
      ctx.drawImage(from, -width * progress, 0);
      ctx.drawImage(to, width * (1 - progress), 0);
      break;
    case 'zoom': {
      const scale = 0.9 + 0.1 * progress;
      ctx.globalAlpha = 1;
      ctx.drawImage(from, 0, 0);
      ctx.globalAlpha = progress;
      ctx.drawImage(to, (width * (1 - scale)) / 2, (height * (1 - scale)) / 2, width * scale, height * scale);
      ctx.globalAlpha = 1;
      break;
    }
  }
}

interface SceneVideoSource {
  el: HTMLVideoElement;
  trimStart: number;
  duration: number;
}

/** Video elements referenced by a scene, with each element's trim offset. */
function sceneVideoSources(scene: Scene, sources: Map<string, LoadedSource | null>): SceneVideoSource[] {
  const out: SceneVideoSource[] = [];
  for (const el of scene.elements) {
    if (el.kind !== 'media') continue;
    const src = sources.get(el.assetId);
    if (src instanceof HTMLVideoElement) {
      out.push({ el: src, trimStart: el.trimStartMs / 1000, duration: src.duration || Infinity });
    }
  }
  return out;
}

/** Deterministic frame-accurate seek — waits for 'seeked'. */
function seekVideo(video: HTMLVideoElement, timeSecs: number): Promise<void> {
  if (Math.abs(video.currentTime - timeSecs) < 0.02) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener('seeked', done);
      video.removeEventListener('error', done);
      clearTimeout(timer);
      resolve();
    };
    video.addEventListener('seeked', done, { once: true });
    video.addEventListener('error', done, { once: true });
    const timer = setTimeout(done, 2000); // never hang export on a stalled seek
    video.currentTime = timeSecs;
  });
}

/**
 * Deterministic path: encode one keyframed frame per scene through WebCodecs
 * and mux with mediabunny. Runs as fast as the encoder can go — a 17-slide
 * deck exports in a couple of seconds with exact slide timing.
 */
async function encodeScenes(
  project: Project,
  sources: Map<string, LoadedSource | null>,
  format: ExportVideoFormat,
  onProgress?: (completedScenes: number, totalScenes: number) => void,
): Promise<Blob> {
  const codec = await getFirstEncodableVideoCodec(format === 'mp4' ? ['avc', 'hevc'] : ['vp9', 'vp8', 'av1'], {
    width: project.width,
    height: project.height,
    quality: QUALITY_HIGH,
    frameRate: project.fps,
  });
  if (!codec) {
    throw new Error(`This browser cannot encode ${format.toUpperCase()} video. Try the latest Chrome or Edge.`);
  }

  const canvas = document.createElement('canvas');
  canvas.width = project.width;
  canvas.height = project.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create a drawing surface for export.');

  const target = new BufferTarget();
  const output = new Output({
    format: format === 'mp4' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(),
    target,
  });
  const source = new CanvasSource(canvas, { codec, quality: QUALITY_HIGH });
  output.addVideoTrack(source);
  await output.start();

  try {
    let timestamp = 0;
    const scenes = project.scenes;

    for (let i = 0; i < scenes.length; i += 1) {
      const duration = Math.max(0.3, scenes[i].durationMs / 1000);
      // The transition consumes the tail of this slide's slot, then the next
      // slide holds for its full duration.
      const transition = i < scenes.length - 1 ? scenes[i].transitionOut : undefined;
      const transitionSecs =
        transition && transition.type !== 'cut'
          ? Math.min(transition.durationMs / 1000, duration, Math.max(0.3, scenes[i + 1].durationMs / 1000))
          : 0;
      const holdSecs = duration - transitionSecs;
      const videos = sceneVideoSources(scenes[i], sources);

      if (videos.length > 0) {
        // Video scenes emit frames at project fps, seeking deterministically.
        for (const v of videos) await seekVideo(v.el, v.trimStart);
        const frames = Math.max(1, Math.round(holdSecs * project.fps));
        const stepDur = holdSecs / frames;
        for (let f = 0; f < frames; f += 1) {
          const t = f * stepDur;
          for (const v of videos) {
            const target = Math.min(v.trimStart + t, Math.max(0, v.duration - stepDur));
            await seekVideo(v.el, target);
          }
          ctx.drawImage(renderSceneFrame(scenes[i], project, sources), 0, 0);
          await source.add(timestamp, stepDur, { keyFrame: f === 0 });
          timestamp += stepDur;
        }
      } else if (holdSecs > 0.01) {
        const frame = renderSceneFrame(scenes[i], project, sources);
        ctx.drawImage(frame, 0, 0);
        await source.add(timestamp, holdSecs, { keyFrame: true });
        timestamp += holdSecs;
      }
      onProgress?.(i + 1, scenes.length);

      if (transitionSecs > 0 && transition) {
        const frame = renderSceneFrame(scenes[i], project, sources);
        const nextFrame = renderSceneFrame(scenes[i + 1], project, sources);
        const steps = Math.max(2, Math.min(30, Math.round(transitionSecs * project.fps)));
        const stepSecs = transitionSecs / steps;
        for (let s = 1; s <= steps; s += 1) {
          drawTransitionFrame(ctx, frame, nextFrame, transition.type, s / steps, project.width, project.height);
          await source.add(timestamp, stepSecs, { keyFrame: s === steps });
          timestamp += stepSecs;
        }
      }
    }
    await output.finalize();
  } catch (error) {
    try {
      await output.cancel();
    } catch {
      // Best-effort cleanup.
    }
    throw error;
  }

  if (!target.buffer || target.buffer.byteLength === 0) {
    throw new Error('Encoding produced an empty file.');
  }
  return new Blob([target.buffer], { type: format === 'mp4' ? 'video/mp4' : 'video/webm' });
}

/** Records all scenes through one MediaRecorder/canvas pair and returns the blob. */
async function recordScenes(
  project: Project,
  sources: Map<string, LoadedSource | null>,
  mimeType: string,
  onProgress?: (completedScenes: number, totalScenes: number) => void,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = project.width;
  canvas.height = project.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create a drawing surface for export.');

  const stream = canvas.captureStream(project.fps);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 });

  const chunks: Blob[] = [];
  let recorderError: Error | null = null;
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.onerror = (event) => {
    const detail = (event as { error?: DOMException }).error;
    recorderError = detail instanceof Error ? detail : new Error('Video recording failed.');
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  // Redraw the current slide every frame so the capture stream stays fed;
  // captureStream only guarantees frames while the canvas is painted.
  let drawing = true;
  let currentFrame: HTMLCanvasElement | null = null;
  const pump = () => {
    if (!drawing) return;
    if (currentFrame) ctx.drawImage(currentFrame, 0, 0);
    requestAnimationFrame(pump);
  };

  const scenes = project.scenes;
  const blend = document.createElement('canvas');
  blend.width = project.width;
  blend.height = project.height;
  const blendCtx = blend.getContext('2d');

  try {
    recorder.start(250);
    requestAnimationFrame(pump);

    for (let i = 0; i < scenes.length; i += 1) {
      if (recorderError) throw recorderError;
      const frame = renderSceneFrame(scenes[i], project, sources);
      currentFrame = frame;
      const durationMs = Math.max(300, scenes[i].durationMs);
      const transition = i < scenes.length - 1 ? scenes[i].transitionOut : undefined;
      const transitionMs =
        transition && transition.type !== 'cut'
          ? Math.min(transition.durationMs, durationMs, Math.max(300, scenes[i + 1].durationMs))
          : 0;
      const videos = sceneVideoSources(scenes[i], sources);
      for (const v of videos) {
        v.el.currentTime = v.trimStart;
        void v.el.play().catch(() => {});
      }

      // Video scenes re-render periodically while the video plays live.
      let remaining = durationMs - transitionMs;
      while (remaining > 0 && !recorderError) {
        const slice = Math.min(videos.length > 0 ? 66 : remaining, remaining);
        if (videos.length > 0) currentFrame = renderSceneFrame(scenes[i], project, sources);
        await sleep(slice);
        remaining -= slice;
      }
      for (const v of videos) v.el.pause();
      onProgress?.(i + 1, scenes.length);

      if (transitionMs > 0 && transition && blendCtx) {
        const from = videos.length > 0 ? renderSceneFrame(scenes[i], project, sources) : frame;
        const nextFrame = renderSceneFrame(scenes[i + 1], project, sources);
        const steps = Math.max(2, Math.min(30, Math.round(transitionMs / 100)));
        for (let s = 1; s <= steps; s += 1) {
          drawTransitionFrame(blendCtx, from, nextFrame, transition.type, s / steps, project.width, project.height);
          currentFrame = blend;
          await sleep(transitionMs / steps);
          if (recorderError) throw recorderError;
        }
      }
    }
    // Give the recorder a moment to flush the final frames.
    await sleep(120);
  } finally {
    drawing = false;
    if (recorder.state !== 'inactive') recorder.stop();
    stream.getTracks().forEach((track) => track.stop());
  }

  // If the recorder errored, onstop may never fire — don't hang on it.
  await Promise.race([stopped, sleep(1500)]);
  if (recorderError) throw recorderError;

  const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
  if (blob.size === 0) {
    throw new Error('The recorder produced no video data.');
  }
  return blob;
}

/**
 * Renders every scene to a video file in the requested container and triggers
 * a download. Prefers WebCodecs via mediabunny, falls back to MediaRecorder.
 */
export async function exportProjectToVideo(
  project: Project,
  format: ExportVideoFormat,
  onProgress?: (completedScenes: number, totalScenes: number) => void,
): Promise<{ fileName: string }> {
  if (project.scenes.length === 0) {
    throw new Error('Add at least one slide before exporting.');
  }

  const { sources, release } = await loadProjectMedia(project);
  try {
    let blob: Blob | null = null;
    let lastError: unknown = null;

    if (typeof VideoEncoder !== 'undefined') {
      try {
        blob = await encodeScenes(project, sources, format, onProgress);
      } catch (error) {
        lastError = error;
        console.warn(`[frameflow] WebCodecs ${format} export failed, trying MediaRecorder:`, error);
      }
    }

    if (!blob && typeof MediaRecorder !== 'undefined') {
      const mimes = MEDIARECORDER_MIMES[format].filter((mime) => MediaRecorder.isTypeSupported(mime));
      for (const mime of mimes) {
        try {
          blob = await recordScenes(project, sources, mime, onProgress);
          break;
        } catch (error) {
          lastError = error;
          console.warn(`[frameflow] Export via ${mime} failed:`, error);
        }
      }
    }

    if (!blob) {
      throw lastError instanceof Error ? lastError : new Error('This browser cannot record video. Try the latest Chrome or Edge.');
    }

    const safeName = project.name.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'slideshow';
    const fileName = `${safeName}.${format}`;
    downloadBlob(blob, fileName);
    return { fileName };
  } finally {
    release();
  }
}
