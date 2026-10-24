import { describe, expect, it } from 'vitest';
import { captionLayout, parseCaptionBytes, resolveCaptionText } from '../lib/captions';
import type { MediaAsset, MediaElement } from '../lib/types';

const encoder = new TextEncoder();

function exifWithDescription(text: string): Uint8Array {
  const desc = encoder.encode(`${text}\0`);
  const tiff = new Uint8Array(8 + 2 + 12 + 4 + desc.length);
  const dv = new DataView(tiff.buffer);
  tiff[0] = 0x49; // 'I' — little-endian
  tiff[1] = 0x49;
  dv.setUint16(2, 42, true);
  dv.setUint32(4, 8, true); // IFD0 offset
  dv.setUint16(8, 1, true); // one entry
  dv.setUint16(10, 0x010e, true); // ImageDescription
  dv.setUint16(12, 2, true); // ASCII
  dv.setUint32(14, desc.length, true);
  dv.setUint32(18, 26, true); // value offset = 8 + 2 + 12 + 4
  tiff.set(desc, 26);
  const out = new Uint8Array(6 + tiff.length);
  out.set([0x45, 0x78, 0x69, 0x66, 0, 0], 0); // "Exif\0\0"
  out.set(tiff, 6);
  return out;
}

describe('parseCaptionBytes', () => {
  it('reads XMP dc:description and unescapes entities', () => {
    const bytes = encoder.encode(
      '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description>' +
        '<dc:description><rdf:Alt><rdf:li xml:lang="x-default">Sunset &amp; friends</rdf:li></rdf:Alt></dc:description>' +
        '</rdf:Description></rdf:RDF></x:xmpmeta>',
    );
    expect(parseCaptionBytes(bytes)).toBe('Sunset & friends');
  });

  const app13 = (record: number[]): Uint8Array => {
    const out = new Uint8Array(4 + record.length);
    out[0] = 0xff;
    out[1] = 0xed;
    out[2] = (record.length + 2) >> 8;
    out[3] = (record.length + 2) & 0xff;
    out.set(record, 4);
    return out;
  };

  it('reads IPTC 2:120 caption records inside APP13 segments', () => {
    const caption = encoder.encode('Wedding day!');
    expect(parseCaptionBytes(app13([0x1c, 0x02, 0x78, 0x00, caption.length, ...caption]))).toBe('Wedding day!');
  });

  it('ignores IPTC-looking bytes outside APP13 (compressed image data)', () => {
    const caption = encoder.encode('Wedding day!');
    const bytes = new Uint8Array([0x1c, 0x02, 0x78, 0x00, caption.length, ...caption]);
    expect(parseCaptionBytes(bytes)).toBeUndefined();
  });

  it('rejects binary junk decoded from a false-positive tag', () => {
    const junk = app13([0x1c, 0x02, 0x78, 0x00, 5, 0xa7, 0xc4, 0x7c, 0x5b, 0x45]);
    expect(parseCaptionBytes(junk)).toBeUndefined();
  });

  it('reads EXIF ImageDescription', () => {
    expect(parseCaptionBytes(exifWithDescription('Beach trip 2024'))).toBe('Beach trip 2024');
  });

  it('returns undefined for files without captions', () => {
    expect(parseCaptionBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]))).toBeUndefined();
  });
});

describe('resolveCaptionText', () => {
  const mediaEl = { kind: 'media', caption: { show: true, position: 'bottom', style: 'bar' } } as MediaElement;
  const asset = { caption: 'From the file' } as MediaAsset;

  it('uses the embedded caption when shown with no override', () => {
    expect(resolveCaptionText(mediaEl, asset)).toBe('From the file');
  });

  it('prefers the user override text', () => {
    const el = { ...mediaEl, caption: { ...mediaEl.caption!, text: 'Custom words' } } as MediaElement;
    expect(resolveCaptionText(el, asset)).toBe('Custom words');
  });

  it('hides when show is false or text is empty', () => {
    const hidden = { ...mediaEl, caption: { ...mediaEl.caption!, show: false } } as MediaElement;
    expect(resolveCaptionText(hidden, asset)).toBeUndefined();
    expect(resolveCaptionText(mediaEl, { id: 'x' } as MediaAsset)).toBeUndefined();
  });

  it('falls back to the file name (extension stripped)', () => {
    expect(resolveCaptionText(mediaEl, { name: 'beach day.JPG' } as MediaAsset)).toBe('beach day');
  });
});

describe('captionLayout', () => {
  it('places the bar along the element edge', () => {
    const bottom = captionLayout(1000, 500, { position: 'bottom', style: 'bar' }, 'Hello');
    expect(bottom.bar.x).toBe(0);
    expect(bottom.bar.width).toBe(1000);
    expect(bottom.bar.y + bottom.bar.height).toBe(500);
    const top = captionLayout(1000, 500, { position: 'top', style: 'bar' }, 'Hello');
    expect(top.bar.y).toBe(0);
  });

  it('centres the pill horizontally with rounded ends', () => {
    const pill = captionLayout(1000, 500, { position: 'bottom', style: 'pill' }, 'A short caption');
    expect(pill.bar.x).toBeGreaterThan(0);
    expect(pill.bar.x + pill.bar.width).toBeLessThan(1000);
    expect(pill.bar.radius).toBe(pill.bar.height / 2);
    expect(pill.textAlign).toBe('center');
  });
});
