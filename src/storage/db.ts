import Dexie, { type Table } from 'dexie';
import type { Project } from '../lib/types';

export interface ProjectRecord {
  id: string;
  updatedAt: string;
  data: Project;
}

export interface BlobRecord {
  key: string;
  blob: Blob;
}

export interface SettingRecord {
  key: string;
  value: unknown;
}

/**
 * Local-first persistence. Project documents (scenes, elements, asset
 * metadata) live in `projects`; binary media lives separately in `blobs`
 * keyed by `MediaAsset.storageKey` so project JSON never embeds large bytes.
 */
class FrameflowDatabase extends Dexie {
  projects!: Table<ProjectRecord, string>;
  blobs!: Table<BlobRecord, string>;
  settings!: Table<SettingRecord, string>;

  constructor() {
    super('frameflow');

    // schemaVersion 1: initial shape.
    this.version(1).stores({
      projects: 'id, updatedAt',
      blobs: 'key',
      settings: 'key',
    });
  }
}

export const db = new FrameflowDatabase();
