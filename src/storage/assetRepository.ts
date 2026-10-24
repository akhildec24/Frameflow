import { db } from './db';
import { createId } from '../lib/id';
import { createLimiter } from '../lib/concurrency';
import { extractCaption } from '../lib/captions';
import {
  detectMediaType,
  hashFile,
  loadAudioMeta,
  loadImageMeta,
  loadVideoMeta,
} from '../lib/media';
import type { MediaAsset } from '../lib/types';

const importLimiter = createLimiter(3);

export interface ImportResult {
  asset: MediaAsset;
  duplicateOfExisting?: boolean;
}

/**
 * Processes one file into a MediaAsset plus stored blob. Concurrency is
 * bounded by `importLimiter` so large batches never decode everything at
 * once. Unsupported files resolve to a `status: 'error'` asset rather than
 * throwing, so a batch import can report per-file results.
 */
export async function importAssetFile(
  file: File,
  existingHashes: Map<string, MediaAsset>,
): Promise<ImportResult> {
  return importLimiter(async () => {
    const type = detectMediaType(file.type, file.name);
    const id = createId();
    const createdAt = new Date().toISOString();

    if (!type) {
      return {
        asset: {
          id,
          name: file.name,
          type: 'image',
          mimeType: file.type || 'unknown',
          sizeBytes: file.size,
          storageKey: id,
          createdAt,
          status: 'error',
          errorMessage: `Unsupported file type (${file.type || 'unknown'}). Use JPEG, PNG, WebP, MP4, WebM, MOV, MP3, WAV or AAC.`,
        },
      };
    }

    let hash: string | undefined;
    try {
      hash = await hashFile(file);
    } catch {
      hash = undefined;
    }

    if (hash && existingHashes.has(hash)) {
      return { asset: existingHashes.get(hash)!, duplicateOfExisting: true };
    }

    try {
      let width: number | undefined;
      let height: number | undefined;
      let durationMs: number | undefined;
      let thumbnailDataUrl: string | undefined;
      let caption: string | undefined;

      if (type === 'image') {
        const meta = await loadImageMeta(file);
        width = meta.width;
        height = meta.height;
        thumbnailDataUrl = meta.thumbnailDataUrl;
        caption = await extractCaption(file);
      } else if (type === 'video') {
        const meta = await loadVideoMeta(file);
        width = meta.width;
        height = meta.height;
        durationMs = meta.durationMs;
        thumbnailDataUrl = meta.thumbnailDataUrl;
      } else {
        const meta = await loadAudioMeta(file);
        durationMs = meta.durationMs;
      }

      await db.blobs.put({ key: id, blob: file });

      const asset: MediaAsset = {
        id,
        name: file.name,
        type,
        mimeType: file.type,
        width,
        height,
        durationMs,
        sizeBytes: file.size,
        storageKey: id,
        thumbnailDataUrl,
        caption,
        hash,
        createdAt,
        status: 'ready',
      };
      return { asset };
    } catch (error) {
      return {
        asset: {
          id,
          name: file.name,
          type,
          mimeType: file.type,
          sizeBytes: file.size,
          storageKey: id,
          createdAt,
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Import failed unexpectedly.',
        },
      };
    }
  });
}

export async function deleteAssetBlob(storageKey: string): Promise<void> {
  await db.blobs.delete(storageKey);
}

// --- Object URL cache -------------------------------------------------
// Blob URLs are recreated on demand and reference-counted so the same asset
// used by multiple components only ever has one live blob: URL, revoked once
// nothing references it any more.

interface CacheEntry {
  url: string;
  refCount: number;
}

const urlCache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<string>>();

export async function acquireAssetUrl(storageKey: string): Promise<string> {
  const existing = urlCache.get(storageKey);
  if (existing) {
    existing.refCount += 1;
    return existing.url;
  }

  const inFlight = pending.get(storageKey);
  if (inFlight) {
    const url = await inFlight;
    const entry = urlCache.get(storageKey);
    if (entry) entry.refCount += 1;
    return url;
  }

  const load = (async () => {
    const record = await db.blobs.get(storageKey);
    if (!record) throw new Error('Referenced media file is missing from local storage.');
    const url = URL.createObjectURL(record.blob);
    urlCache.set(storageKey, { url, refCount: 1 });
    return url;
  })();

  pending.set(storageKey, load);
  try {
    return await load;
  } finally {
    pending.delete(storageKey);
  }
}

export function releaseAssetUrl(storageKey: string): void {
  const entry = urlCache.get(storageKey);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    URL.revokeObjectURL(entry.url);
    urlCache.delete(storageKey);
  }
}
