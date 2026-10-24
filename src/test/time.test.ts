import { describe, expect, it } from 'vitest';
import { computeSceneBoundaries, formatTimecode, framesToMs, getProjectDurationMs, msToFrames } from '../lib/time';
import type { Scene } from '../lib/types';

function makeScene(partial: Partial<Scene>): Scene {
  return {
    id: partial.id ?? 'scene',
    name: partial.name ?? 'Scene',
    durationMs: partial.durationMs ?? 4000,
    background: '#FFFFFF',
    elements: [],
    advance: 'manual',
    transitionOut: partial.transitionOut,
  };
}

describe('msToFrames / framesToMs', () => {
  it('round-trips at 30fps', () => {
    expect(msToFrames(1000, 30)).toBe(30);
    expect(framesToMs(30, 30)).toBe(1000);
  });
});

describe('formatTimecode', () => {
  it('formats milliseconds as mm:ss.cc', () => {
    expect(formatTimecode(0)).toBe('00:00.00');
    expect(formatTimecode(1500)).toBe('00:01.50');
    expect(formatTimecode(65250)).toBe('01:05.25');
  });
});

describe('computeSceneBoundaries', () => {
  it('lays out scenes back to back with cut transitions', () => {
    const scenes = [
      makeScene({ id: 'a', durationMs: 4000 }),
      makeScene({ id: 'b', durationMs: 3000 }),
      makeScene({ id: 'c', durationMs: 5000 }),
    ];
    const boundaries = computeSceneBoundaries(scenes);
    expect(boundaries).toEqual([
      { sceneId: 'a', startMs: 0, endMs: 4000, durationMs: 4000 },
      { sceneId: 'b', startMs: 4000, endMs: 7000, durationMs: 3000 },
      { sceneId: 'c', startMs: 7000, endMs: 12000, durationMs: 5000 },
    ]);
    expect(getProjectDurationMs(scenes)).toBe(12000);
  });

  it('overlaps global duration by the transition duration for non-cut transitions', () => {
    const scenes = [
      makeScene({ id: 'a', durationMs: 4000, transitionOut: { type: 'crossfade', durationMs: 1000 } }),
      makeScene({ id: 'b', durationMs: 3000 }),
    ];
    const boundaries = computeSceneBoundaries(scenes);
    expect(boundaries[0]).toEqual({ sceneId: 'a', startMs: 0, endMs: 4000, durationMs: 4000 });
    expect(boundaries[1].startMs).toBe(3000);
    expect(getProjectDurationMs(scenes)).toBe(6000);
  });
});
