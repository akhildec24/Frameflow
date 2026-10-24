import { projectSchema } from '../../lib/schema';
import type { Project } from '../../lib/types';

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can race the download and produce an empty file.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function downloadProjectJson(project: Project): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `${project.name.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'project'}.frameflow.json`);
}

export interface ProjectImportResult {
  project: Project;
  missingAssetCount: number;
}

/**
 * Parses and validates an imported project JSON file. Project JSON never
 * contains media bytes, so imported assets are marked for re-linking; the
 * caller should surface that the originals need to be re-imported.
 */
export async function readProjectJsonFile(file: File): Promise<ProjectImportResult> {
  const text = await file.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }

  const parsed = projectSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error('That file does not match the Frameflow project format.');
  }

  const project = parsed.data as Project;
  return { project, missingAssetCount: Object.keys(project.assets).length };
}
