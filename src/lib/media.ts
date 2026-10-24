import type { MediaType } from './types';

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const SUPPORTED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/aac', 'audio/mp4'];

// Fallback when the browser reports an empty or generic MIME type (common for
// files delivered through folder drag & drop).
const EXTENSION_TYPES: Record<string, MediaType> = {
  jpg: 'image', jpeg: 'image', png: 'image', webp: 'image',
  mp4: 'video', webm: 'video', mov: 'video', m4v: 'video',
  mp3: 'audio', wav: 'audio', aac: 'audio', m4a: 'audio',
};

export function detectMediaType(mimeType: string, fileName = ''): MediaType | null {
  if (SUPPORTED_IMAGE_TYPES.includes(mimeType)) return 'image';
  if (SUPPORTED_VIDEO_TYPES.includes(mimeType)) return 'video';
  if (SUPPORTED_AUDIO_TYPES.includes(mimeType)) return 'audio';
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TYPES[ext] ?? null;
}

const THUMBNAIL_SIZE = 240;

export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface ImageMeta {
  width: number;
  height: number;
  thumbnailDataUrl: string;
}

export async function loadImageMeta(file: File): Promise<ImageMeta> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, THUMBNAIL_SIZE / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return {
      width: bitmap.width,
      height: bitmap.height,
      thumbnailDataUrl: canvas.toDataURL('image/jpeg', 0.82),
    };
  } finally {
    bitmap.close();
  }
}

interface VideoMeta {
  width: number;
  height: number;
  durationMs: number;
  thumbnailDataUrl: string;
}

export async function loadVideoMeta(file: File): Promise<VideoMeta> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Unable to read video metadata'));
    });

    const seekTo = Math.min(0.1, Math.max(0, (video.duration || 0) * 0.1));
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error('Unable to seek video for thumbnail'));
      video.currentTime = seekTo;
    });

    const canvas = document.createElement('canvas');
    const scale = Math.min(1, THUMBNAIL_SIZE / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return {
      width: video.videoWidth,
      height: video.videoHeight,
      durationMs: Math.round((video.duration || 0) * 1000),
      thumbnailDataUrl: canvas.toDataURL('image/jpeg', 0.82),
    };
  } finally {
    URL.revokeObjectURL(url);
    video.src = '';
  }
}

interface AudioMeta {
  durationMs: number;
}

export async function loadAudioMeta(file: File): Promise<AudioMeta> {
  const url = URL.createObjectURL(file);
  const audio = document.createElement('audio');
  audio.preload = 'metadata';
  audio.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      audio.onloadedmetadata = () => resolve();
      audio.onerror = () => reject(new Error('Unable to read audio metadata'));
    });
    return { durationMs: Math.round((audio.duration || 0) * 1000) };
  } finally {
    URL.revokeObjectURL(url);
    audio.src = '';
  }
}
