import { db } from './db';
import { projectSchema } from '../lib/schema';
import { computeSceneBoundaries } from '../lib/time';
import type { Project, ProjectSummary } from '../lib/types';

export async function listProjectSummaries(): Promise<ProjectSummary[]> {
  const records = await db.projects.orderBy('updatedAt').reverse().toArray();
  const summaries: ProjectSummary[] = [];
  for (const record of records) {
    const project = record.data;
    const boundaries = computeSceneBoundaries(project.scenes);
    const durationMs = boundaries.length ? Math.max(...boundaries.map((b) => b.endMs)) : 0;
    const firstThumbnail = Object.values(project.assets).find((a) => a.thumbnailDataUrl)?.thumbnailDataUrl;
    summaries.push({
      id: project.id,
      name: project.name,
      mode: project.mode,
      width: project.width,
      height: project.height,
      durationMs,
      updatedAt: project.updatedAt,
      thumbnailDataUrl: firstThumbnail,
    });
  }
  return summaries;
}

export async function getProject(id: string): Promise<Project | null> {
  const record = await db.projects.get(id);
  if (!record) return null;
  const parsed = projectSchema.safeParse(record.data);
  if (!parsed.success) {
    console.error('Project failed schema validation', id, parsed.error);
    return null;
  }
  return parsed.data as Project;
}

export async function saveProject(project: Project): Promise<void> {
  await db.projects.put({ id: project.id, updatedAt: project.updatedAt, data: project });
}

export async function deleteProject(id: string): Promise<void> {
  const project = await getProject(id);
  await db.projects.delete(id);
  if (!project) return;
  // Reclaim media blobs that are not referenced by any remaining project.
  const remaining = await db.projects.toArray();
  const stillReferenced = new Set<string>();
  for (const record of remaining) {
    for (const asset of Object.values(record.data.assets)) {
      stillReferenced.add(asset.storageKey);
    }
  }
  const keysToDelete = Object.values(project.assets)
    .map((a) => a.storageKey)
    .filter((key) => !stillReferenced.has(key));
  if (keysToDelete.length) {
    await db.blobs.bulkDelete(keysToDelete);
  }
}
