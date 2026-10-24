import { describe, expect, it } from 'vitest';
import { clamp, computeContainRect, computeFillCrop, cropToPixels } from '../lib/geometry';

describe('clamp', () => {
  it('clamps values within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('computeFillCrop', () => {
  it('crops a tall portrait image to fill a wide 16:9 box without distortion', () => {
    const natural = { width: 1000, height: 2000 };
    const box = { width: 1920, height: 1080 };
    const crop = computeFillCrop(natural, box, 0.5, 0.5, 1);

    expect(crop.width).toBeCloseTo(1, 5);
    expect(crop.height).toBeCloseTo(0.28125, 4);

    const cropAspect = (crop.width * natural.width) / (crop.height * natural.height);
    expect(cropAspect).toBeCloseTo(box.width / box.height, 2);
  });

  it('crops a wide landscape image to fill a portrait 9:16 box without distortion', () => {
    const natural = { width: 2000, height: 1000 };
    const box = { width: 1080, height: 1920 };
    const crop = computeFillCrop(natural, box, 0.5, 0.5, 1);

    expect(crop.height).toBeCloseTo(1, 5);
    const cropAspect = (crop.width * natural.width) / (crop.height * natural.height);
    expect(cropAspect).toBeCloseTo(box.width / box.height, 2);
  });

  it('pans within the available range and clamps at the edges', () => {
    const natural = { width: 1000, height: 2000 };
    const box = { width: 1920, height: 1080 };

    const topCrop = computeFillCrop(natural, box, 0.5, 0, 1);
    expect(topCrop.y).toBeCloseTo(0, 5);

    const bottomCrop = computeFillCrop(natural, box, 0.5, 1, 1);
    expect(bottomCrop.y).toBeCloseTo(1 - bottomCrop.height, 5);
  });

  it('zooms in to shrink the crop window below the fill minimum', () => {
    const natural = { width: 1000, height: 2000 };
    const box = { width: 1920, height: 1080 };

    const base = computeFillCrop(natural, box, 0.5, 0.5, 1);
    const zoomed = computeFillCrop(natural, box, 0.5, 0.5, 2);

    expect(zoomed.width).toBeLessThan(base.width);
    expect(zoomed.height).toBeLessThan(base.height);
  });
});

describe('cropToPixels', () => {
  it('converts fractional crop to source pixel units', () => {
    const px = cropToPixels({ x: 0.25, y: 0.1, width: 0.5, height: 0.6 }, { width: 1000, height: 500 });
    expect(px).toEqual({ x: 250, y: 50, width: 500, height: 300 });
  });
});

describe('computeContainRect', () => {
  it('letterboxes a wide image inside a tall box without cropping', () => {
    const rect = computeContainRect({ width: 2000, height: 1000 }, { width: 500, height: 500 });
    expect(rect.width).toBe(500);
    expect(rect.height).toBe(250);
    expect(rect.y).toBeCloseTo(125, 5);
  });
});
