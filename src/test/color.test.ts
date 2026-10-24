import { describe, expect, it } from 'vitest';
import { hexToHsv, hexToRgb, hsvToHex, normalizeHex, rgbToHex, rgbToHsv } from '../lib/color';

describe('color conversions', () => {
  it('hexToRgb parses known colours', () => {
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#c66f42')).toEqual({ r: 198, g: 111, b: 66 });
    expect(hexToRgb('nope')).toBeNull();
  });

  it('rgbToHex round-trips', () => {
    expect(rgbToHex(198, 111, 66)).toBe('#c66f42');
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
  });

  it('hsv round-trips primaries and greys', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#808080', '#c66f42']) {
      const { h, s, v } = hexToHsv(hex);
      expect(hsvToHex(h, s, v)).toBe(hex);
    }
  });

  it('pure hue values sit on the wheel', () => {
    expect(rgbToHsv(255, 0, 0).h).toBeCloseTo(0);
    expect(rgbToHsv(0, 255, 0).h).toBeCloseTo(120);
    expect(rgbToHsv(0, 0, 255).h).toBeCloseTo(240);
  });

  it('normalizeHex accepts shorthand and bare digits', () => {
    expect(normalizeHex('#abc')).toBe('#aabbcc');
    expect(normalizeHex('abc')).toBe('#aabbcc');
    expect(normalizeHex('C66F42')).toBe('#c66f42');
    expect(normalizeHex('#c66f42')).toBe('#c66f42');
    expect(normalizeHex('#12')).toBeNull();
    expect(normalizeHex('banana')).toBeNull();
  });
});
