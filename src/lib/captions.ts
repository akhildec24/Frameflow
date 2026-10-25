import type { CaptionConfig, Element, MediaAsset } from './types';

// ---------------------------------------------------------------------------
// Caption extraction — reads embedded metadata near the file head. Caption
// text is authored by cameras/editors in four common places, tried in order:
// IPTC IIM 2:120, XMP dc:description / photoshop:Caption / dc:title, EXIF
// ImageDescription / UserComment, and PNG iTXt/tEXt chunks.
// ---------------------------------------------------------------------------

const SCAN_BYTES = 1_500_000; // metadata always lives in the head of the file
const utf8 = new TextDecoder('utf-8');
const latin1 = new TextDecoder('latin1');

/** Reads embedded caption text from an image file, or undefined if none. */
export async function extractCaption(file: File): Promise<string | undefined> {
  try {
    const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, SCAN_BYTES)).arrayBuffer());
    return parseCaptionBytes(bytes);
  } catch {
    return undefined;
  }
}

/** Pure parser over raw file bytes — exported for tests. */
export function parseCaptionBytes(bytes: Uint8Array): string | undefined {
  return iptcCaption(bytes) ?? xmpCaption(bytes) ?? pngTextCaption(bytes) ?? exifCaption(bytes);
}

const tidy = (value: string | null | undefined): string | undefined => {
  // eslint-disable-next-line no-control-regex -- intentional: strips binary junk from metadata fields
  const text = value?.replace(/[\u0000-\u001F\u007F\uFFFD]/g, ' ').replace(/\s+/g, ' ').trim();
  return text && text.length > 1 ? text : undefined;
};

/** False-positive tag hits decode to symbol-stuffed fragments like "xŽ@;Å8" —
 *  latin-1 mojibake still counts as "letters", so a char-level gate passes it.
 *  Real captions are sequences of word-shaped tokens instead: letters/digits
 *  inside, punctuation at the edges. A couple of odd tokens ("&", "—") is fine;
 *  junk is mostly non-words. */
const WORD_TOKEN = /^[.,;:!?'’'“”"()&@+]*[\p{L}\p{N}]+(?:[.\-–—/'’][\p{L}\p{N}]+)*[.,;:!?'’'“”"()&@+]*$/u;

function plausibleCaption(text: string): boolean {
  if (!/\p{L}/u.test(text)) return false;
  const tokens = text.split(/\s+/).filter(Boolean);
  let wordChars = 0;
  for (const token of tokens) {
    if (WORD_TOKEN.test(token)) wordChars += token.length;
  }
  return wordChars / text.length >= 0.7;
}

/** Normalise + gate: returns undefined when the value is really binary junk. */
const cleanText = (value: string | null | undefined): string | undefined => {
  const text = tidy(value);
  return text && plausibleCaption(text) ? text : undefined;
};

// --- IPTC IIM ----------------------------------------------------------

const IPTC_TAG_CAPTION = 0x78; // 2:120 Caption/Abstract
const IPTC_TAG_HEADLINE = 0x69; // 2:105 Headline (fallback)

/** IPTC IIM records live inside JPEG APP13 (Photoshop IRB) segments —
 *  scanning the whole file produced false hits inside compressed image data. */
function* app13Payloads(bytes: Uint8Array): Generator<Uint8Array> {
  for (let i = 0; i + 4 <= bytes.length; i += 1) {
    if (bytes[i] !== 0xff || bytes[i + 1] !== 0xed) continue;
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2 || i + 4 + len - 2 > bytes.length) continue;
    yield bytes.subarray(i + 4, i + 4 + len - 2);
    i += 2 + len; // continue past the segment
  }
}

function iptcCaption(bytes: Uint8Array): string | undefined {
  let headline: string | undefined;
  for (const seg of app13Payloads(bytes)) {
    for (let i = 0; i + 5 < seg.length; i += 1) {
      if (seg[i] !== 0x1c || seg[i + 1] !== 0x02) continue;
      const tag = seg[i + 2];
      if (tag !== IPTC_TAG_CAPTION && tag !== IPTC_TAG_HEADLINE) continue;
      const len = (seg[i + 3] << 8) | seg[i + 4];
      if (len <= 0 || len > 4000 || i + 5 + len > seg.length) continue;
      const raw = seg.subarray(i + 5, i + 5 + len);
      // IPTC text is usually UTF-8, occasionally latin-1.
      const decoded = utf8.decode(raw);
      const text = cleanText(decoded.includes('\uFFFD') ? latin1.decode(raw) : decoded);
      if (!text) continue;
      if (tag === IPTC_TAG_CAPTION) return text;
      headline ??= text;
      i += 4 + len;
    }
  }
  return headline;
}

// --- XMP ---------------------------------------------------------------

function xmlUnescape(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function pickXmpField(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const value = cleanText(match?.[1] && xmlUnescape(match[1]));
    if (value) return value;
  }
  return undefined;
}

function xmpCaption(bytes: Uint8Array): string | undefined {
  const text = utf8.decode(bytes);
  if (!text.includes('xmp')) return undefined;
  return (
    pickXmpField(text, [
      /<dc:description[^>]*>\s*<rdf:Alt[^>]*>\s*<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i,
      /<dc:description[^>]*>([\s\S]*?)<\/dc:description>/i,
      /dc:description="([^"]+)"/i,
    ]) ??
    pickXmpField(text, [
      /<photoshop:Caption[^>]*>([\s\S]*?)<\/photoshop:Caption>/i,
      /photoshop:Caption="([^"]+)"/i,
    ]) ??
    pickXmpField(text, [
      /<dc:title[^>]*>\s*<rdf:Alt[^>]*>\s*<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i,
    ])
  );
}

// --- PNG text chunks ---------------------------------------------------

const PNG_TEXT_KEYWORDS = new Set(['description', 'caption', 'title', 'subject']);

function pngTextCaption(bytes: Uint8Array): string | undefined {
  // PNG signature: 8 bytes, then [len u32][type 4][data][crc 4] chunks.
  if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return undefined;
  let xmpFallback: string | undefined;
  let offset = 8;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (offset + 12 <= bytes.length) {
    const len = view.getUint32(offset);
    const type = latin1.decode(bytes.subarray(offset + 4, offset + 8));
    const data = bytes.subarray(offset + 8, offset + 8 + len);
    if (offset + 12 + len > bytes.length) break;

    if (type === 'iTXt' || type === 'tEXt') {
      const nul = data.indexOf(0);
      if (nul > 0 && nul < 80) {
        const keyword = latin1.decode(data.subarray(0, nul)).toLowerCase();
        if (type === 'iTXt' && keyword === 'xml:com.adobe.xmp') {
          // PNGs carry XMP as an iTXt chunk — parse it like the XMP path.
          const body = data.subarray(nul + 1);
          const xmpText = utf8.decode(body.subarray(body.indexOf(0) + 5));
          xmpFallback ??= pickXmpField(xmpText, [
            /<dc:description[^>]*>\s*<rdf:Alt[^>]*>\s*<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i,
            /<photoshop:Caption[^>]*>([\s\S]*?)<\/photoshop:Caption>/i,
          ]);
        } else if (PNG_TEXT_KEYWORDS.has(keyword)) {
          if (type === 'tEXt') {
            const text = cleanText(latin1.decode(data.subarray(nul + 1)));
            if (text) return text;
          } else {
            // iTXt after keyword: comp flag(1) + comp method(1) + lang\0 + translated\0 + UTF-8 text
            let cursor = nul + 3;
            cursor = data.indexOf(0, cursor) + 1; // language tag
            cursor = data.indexOf(0, cursor) + 1; // translated keyword
            if (cursor > 0 && cursor <= data.length) {
              const text = cleanText(utf8.decode(data.subarray(cursor)));
              if (text) return text;
            }
          }
        }
      }
    }
    if (type === 'IDAT') break; // captions live before pixel data
    offset += 12 + len;
  }
  return xmpFallback;
}

// --- EXIF ---------------------------------------------------------------

/** Minimal TIFF/IFD0 reader for ImageDescription (0x010E) and UserComment (0x9286). */
function exifCaption(bytes: Uint8Array): string | undefined {
  const start = findSequence(bytes, [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]); // "Exif\0\0"
  if (start < 0) return undefined;
  const tiff = start + 6;
  if (tiff + 8 > bytes.length) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset + tiff, bytes.length - tiff);
  const little = view.getUint16(0) === 0x4949; // 'II'
  if (view.getUint16(2, little) !== 42) return undefined;
  const ifd0 = view.getUint32(4, little);
  if (ifd0 + 2 > view.byteLength) return undefined;

  const count = view.getUint16(ifd0, little);
  let userComment: string | undefined;
  for (let i = 0; i < count; i += 1) {
    const entry = ifd0 + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, little);
    if (tag !== 0x010e && tag !== 0x9286) continue;
    const num = view.getUint32(entry + 4, little);
    const raw =
      num <= 4
        ? new Uint8Array(bytes.buffer, bytes.byteOffset + tiff + entry + 8, num)
        : num + view.getUint32(entry + 8, little) <= view.byteLength
          ? new Uint8Array(bytes.buffer, bytes.byteOffset + tiff + view.getUint32(entry + 8, little), num)
          : undefined;
    if (!raw) continue;
    if (tag === 0x010e) {
      const text = cleanText(latin1.decode(raw));
      if (text) return text;
    } else {
      userComment ??= decodeUserComment(raw);
    }
  }
  return userComment;
}

function decodeUserComment(raw: Uint8Array): string | undefined {
  const prefix = latin1.decode(raw.subarray(0, 8)).replace(/\0+$/g, '').toUpperCase();
  const body = raw.subarray(8);
  if (prefix.startsWith('UNICODE')) return cleanText(new TextDecoder('utf-16be').decode(body));
  if (prefix.startsWith('JIS')) return undefined; // JIS is rare; skip rather than mangle
  return cleanText(utf8.decode(body));
}

function findSequence(haystack: Uint8Array, needle: number[]): number {
  outer: for (let i = 0; i + needle.length <= haystack.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Resolving + layout — shared by the Konva canvas and the export renderer so
// captions look identical in both.
// ---------------------------------------------------------------------------

/** Embedded caption text from an asset — gated so binary junk never shows. */
export function embeddedCaption(asset: MediaAsset | undefined): string | undefined {
  return cleanText(asset?.caption);
}

/** Effective caption text: user override, then embedded metadata, then the file name. */
export function resolveCaptionText(element: Element, asset?: MediaAsset): string | undefined {
  if (element.kind !== 'media' || element.caption?.show !== true) return undefined;
  const fileName = asset?.name?.replace(/\.[^.]+$/, '');
  return tidy(element.caption.text) ?? embeddedCaption(asset) ?? tidy(fileName);
}

export interface CaptionLayout {
  fontSize: number;
  fontFamily: string;
  bar: { x: number; y: number; width: number; height: number; radius: number };
  text: { x: number; y: number; width: number; height: number };
  barFill?: string;
  /** Cinematic fade for the bar style — set when the bar should use a gradient. */
  barGradient?: { startX: number; startY: number; endX: number; endY: number; stops: (number | string)[] };
  barStroke?: string;
  textAlign: 'left' | 'center';
}

export const CAPTION_FONT = 'Inter Variable';

let measureCtx: CanvasRenderingContext2D | null | undefined;

/** Real glyph width in the browser; per-char estimate only where canvas is
 *  unavailable (Node tests). Matches the renderers' 500-weight text. */
function measureTextWidth(text: string, fontSize: number): number {
  if (measureCtx === undefined) {
    // jsdom logs "not implemented" for getContext — skip it there.
    measureCtx =
      typeof document !== 'undefined' && !navigator.userAgent.includes('jsdom')
        ? document.createElement('canvas').getContext('2d')
        : null;
  }
  if (measureCtx) {
    measureCtx.font = `500 ${fontSize}px "${CAPTION_FONT}", sans-serif`;
    return measureCtx.measureText(text).width;
  }
  return text.length * fontSize * 0.62;
}
export const CAPTION_PILL_FILL = 'rgba(12, 12, 12, 0.58)';
export const CAPTION_PILL_STROKE = 'rgba(255, 255, 255, 0.16)';
export const CAPTION_TEXT_FILL = '#F7F6F2';

const BAR_GRADIENT_BASE = 'rgba(10, 10, 10, 0.78)';
const BAR_GRADIENT_MID = 'rgba(10, 10, 10, 0.42)';
const BAR_GRADIENT_CLEAR = 'rgba(10, 10, 10, 0)';

function edgeGradient(y0: number, y1: number, fadeUp: boolean): CaptionLayout['barGradient'] {
  // Bottom bar fades upward into the image; top bar fades downward.
  return fadeUp
    ? { startX: 0, startY: y0, endX: 0, endY: y1, stops: [0, BAR_GRADIENT_CLEAR, 0.55, BAR_GRADIENT_MID, 1, BAR_GRADIENT_BASE] }
    : { startX: 0, startY: y0, endX: 0, endY: y1, stops: [0, BAR_GRADIENT_BASE, 0.45, BAR_GRADIENT_MID, 1, BAR_GRADIENT_CLEAR] };
}

/** Computes bar/pill geometry relative to the element's own bounds. */
export function captionLayout(
  width: number,
  height: number,
  config: Pick<CaptionConfig, 'position' | 'style'>,
  text: string,
): CaptionLayout {
  const fontSize = Math.max(11, Math.min(30, Math.round(height * 0.042)));
  const padX = Math.round(fontSize * 0.9);

  if (config.style === 'pill') {
    const pillH = Math.round(fontSize * 2.1);
    const estTextW = measureTextWidth(text, fontSize) + 2;
    const pillW = Math.min(width * 0.92, estTextW + padX * 2);
    const y = config.position === 'top' ? Math.round(fontSize * 0.8) : height - pillH - Math.round(fontSize * 0.8);
    return {
      fontSize,
      fontFamily: CAPTION_FONT,
      bar: { x: (width - pillW) / 2, y, width: pillW, height: pillH, radius: pillH / 2 },
      text: { x: (width - pillW) / 2 + padX, y, width: pillW - padX * 2, height: pillH },
      barFill: CAPTION_PILL_FILL,
      barStroke: CAPTION_PILL_STROKE,
      textAlign: 'center',
    };
  }

  const barH = Math.round(fontSize * 2.4);
  const y = config.position === 'top' ? 0 : height - barH;
  return {
    fontSize,
    fontFamily: CAPTION_FONT,
    bar: { x: 0, y, width, height: barH, radius: 0 },
    text: { x: padX, y, width: width - padX * 2, height: barH },
    barGradient: edgeGradient(y, y + barH, config.position === 'bottom'),
    textAlign: 'left',
  };
}
