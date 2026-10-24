import { db } from '../../storage/db';
import { saveProject } from '../../storage/projectRepository';
import { createId } from '../../lib/id';
import { renderPlaceholderImage } from '../../lib/placeholderImage';
import { hashFile } from '../../lib/media';
import { createEmptyScene, createMediaElement, createTextElement } from '../canvas/elementFactory';
import { CURRENT_SCHEMA_VERSION } from '../../lib/types';
import type { MediaAsset, Project } from '../../lib/types';

const SEEDED_KEY = 'seededSampleProjectV1';

const SCENE_SPECS = [
  { name: 'Opening', label: 'Scene 1 - Opening', from: '#D9CBB8', to: '#B9875B' },
  { name: 'Detail', label: 'Scene 2 - Detail', from: '#C9D3C4', to: '#7C9A82' },
  { name: 'Closing', label: 'Scene 3 - Closing', from: '#D6CAD9', to: '#8C7BA6' },
];

async function buildPlaceholderAsset(
  spec: { name: string; label: string; from: string; to: string },
  width: number,
  height: number,
): Promise<MediaAsset> {
  const blob = await renderPlaceholderImage({ width, height, label: spec.label, from: spec.from, to: spec.to });
  const file = new File([blob], `${spec.name.toLowerCase()}.jpg`, { type: 'image/jpeg' });
  const id = createId();
  const hash = await hashFile(file);

  const bitmap = await createImageBitmap(file);
  const thumbCanvas = document.createElement('canvas');
  const scale = Math.min(1, 240 / Math.max(bitmap.width, bitmap.height));
  thumbCanvas.width = Math.round(bitmap.width * scale);
  thumbCanvas.height = Math.round(bitmap.height * scale);
  const ctx = thumbCanvas.getContext('2d');
  ctx?.drawImage(bitmap, 0, 0, thumbCanvas.width, thumbCanvas.height);
  bitmap.close();

  await db.blobs.put({ key: id, blob: file });

  return {
    id,
    name: file.name,
    type: 'image',
    mimeType: 'image/jpeg',
    width,
    height,
    sizeBytes: file.size,
    storageKey: id,
    thumbnailDataUrl: thumbCanvas.toDataURL('image/jpeg', 0.82),
    hash,
    createdAt: new Date().toISOString(),
    status: 'ready',
  };
}

/** Seeds a sample project with generated placeholder media on first run only. */
export async function ensureSeedProject(): Promise<void> {
  const already = await db.settings.get(SEEDED_KEY);
  if (already) return;

  const projectCount = await db.projects.count();
  if (projectCount > 0) {
    await db.settings.put({ key: SEEDED_KEY, value: true });
    return;
  }

  const width = 1920;
  const height = 1080;
  const now = new Date().toISOString();

  const assets: Record<string, MediaAsset> = {};
  const scenes = [];

  for (const spec of SCENE_SPECS) {
    const asset = await buildPlaceholderAsset(spec, width, height);
    assets[asset.id] = asset;
    const scene = createEmptyScene(spec.name);
    scene.elements.push(createMediaElement(asset, scene, { width, height }));
    scenes.push(scene);
  }

  const titleElement = createTextElement(scenes[0], { width, height });
  titleElement.content = 'Frameflow sample project';
  titleElement.transform.x = width * 0.08;
  titleElement.transform.y = height * 0.76;
  titleElement.transform.width = width * 0.5;
  titleElement.style.fontSize = 56;
  titleElement.style.colour = '#FBFAF7';
  scenes[0].elements.push(titleElement);

  const project: Project = {
    id: createId(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name: 'Sample project',
    mode: 'slideshow',
    width,
    height,
    fps: 30,
    scenes,
    assets,
    activeSceneId: scenes[0].id,
    createdAt: now,
    updatedAt: now,
  };

  await saveProject(project);
  await db.settings.put({ key: SEEDED_KEY, value: true });
}
