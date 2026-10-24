import type { Scene } from './types';

/** Converts integer milliseconds to a frame index at the given frame rate. */
export function msToFrames(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps);
}

/** Converts a frame index to integer milliseconds at the given frame rate. */
export function framesToMs(frames: number, fps: number): number {
  return Math.round((frames / fps) * 1000);
}

/** Formats milliseconds as mm:ss.cc timecode text with tabular numerals intent. */
export function formatTimecode(ms: number): string {
  const totalCentiseconds = Math.max(0, Math.round(ms / 10));
  const minutes = Math.floor(totalCentiseconds / 6000);
  const seconds = Math.floor((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;
  const pad = (value: number, size = 2) => value.toString().padStart(size, '0');
  return `${pad(minutes)}:${pad(seconds)}.${pad(centiseconds)}`;
}

export interface SceneBoundary {
  sceneId: string;
  startMs: number;
  endMs: number;
  durationMs: number;
}

/**
 * Computes the deterministic global start/end time for every scene, taking
 * transition overlap into account. A transition on a scene's `transitionOut`
 * overlaps that scene's end with the following scene's start, so the overlap
 * duration is subtracted once from the running total.
 */
export function computeSceneBoundaries(scenes: Scene[]): SceneBoundary[] {
  const boundaries: SceneBoundary[] = [];
  let cursor = 0;
  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];
    const startMs = cursor;
    const endMs = startMs + scene.durationMs;
    boundaries.push({ sceneId: scene.id, startMs, endMs, durationMs: scene.durationMs });
    const overlap = scene.transitionOut && scene.transitionOut.type !== 'cut'
      ? Math.min(scene.transitionOut.durationMs, scene.durationMs)
      : 0;
    cursor = endMs - overlap;
  }
  return boundaries;
}

export function getProjectDurationMs(scenes: Scene[]): number {
  const boundaries = computeSceneBoundaries(scenes);
  if (boundaries.length === 0) return 0;
  return Math.max(...boundaries.map((b) => b.endMs));
}
