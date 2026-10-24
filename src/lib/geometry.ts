export interface FractionalCrop {
  /** Fractions (0 to 1) of the asset's natural width/height. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export interface Size {
  width: number;
  height: number;
}

/**
 * Computes a crop rectangle (normalised 0 to 1 against the asset's natural
 * size) that fills a box of the given size without distortion. `panX`/`panY`
 * (0 to 1) choose where the visible window sits along whichever axis has
 * spare image to show. `zoom` (>= 1) shrinks the crop window to zoom in
 * further than the minimum needed to cover the box.
 */
export function computeFillCrop(
  natural: Size,
  box: Size,
  panX = 0.5,
  panY = 0.5,
  zoom = 1,
): FractionalCrop {
  const naturalAspect = natural.width / natural.height;
  const boxAspect = box.width / box.height;
  const k = boxAspect / naturalAspect;

  let widthFraction: number;
  let heightFraction: number;
  if (k <= 1) {
    heightFraction = 1;
    widthFraction = k;
  } else {
    widthFraction = 1;
    heightFraction = 1 / k;
  }

  const z = Math.max(1, zoom);
  widthFraction = clamp(widthFraction / z, 0.02, 1);
  heightFraction = clamp(heightFraction / z, 0.02, 1);

  const x = clamp(panX, 0, 1) * (1 - widthFraction);
  const y = clamp(panY, 0, 1) * (1 - heightFraction);

  return { x, y, width: widthFraction, height: heightFraction };
}

/** Converts a fractional crop window into source-pixel units for Konva's `crop` prop. */
export function cropToPixels(crop: FractionalCrop, natural: Size) {
  return {
    x: crop.x * natural.width,
    y: crop.y * natural.height,
    width: crop.width * natural.width,
    height: crop.height * natural.height,
  };
}

/**
 * Computes the centred, letterboxed rectangle (in box-local pixel units) for
 * an asset rendered with `contain` fit inside a box of the given size.
 */
export function computeContainRect(natural: Size, box: Size) {
  const naturalAspect = natural.width / natural.height;
  const boxAspect = box.width / box.height;
  let width: number;
  let height: number;
  if (naturalAspect > boxAspect) {
    width = box.width;
    height = box.width / naturalAspect;
  } else {
    height = box.height;
    width = box.height * naturalAspect;
  }
  return {
    x: (box.width - width) / 2,
    y: (box.height - height) / 2,
    width,
    height,
  };
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function normaliseRect(x0: number, y0: number, x1: number, y1: number): Rect {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0),
  };
}

/** Snaps a value to the nearest target within a threshold, else returns the original value. */
export function snapValue(value: number, targets: number[], threshold: number): { value: number; snapped: boolean; target?: number } {
  for (const target of targets) {
    if (Math.abs(value - target) <= threshold) {
      return { value: target, snapped: true, target };
    }
  }
  return { value, snapped: false };
}
