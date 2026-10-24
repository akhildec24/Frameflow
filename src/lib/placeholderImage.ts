export interface PlaceholderSpec {
  width: number;
  height: number;
  label: string;
  from: string;
  to: string;
}

/** Renders a simple generated gradient tile with a label, used for bundled demo media. */
export async function renderPlaceholderImage(spec: PlaceholderSpec): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const gradient = ctx.createLinearGradient(0, 0, spec.width, spec.height);
  gradient.addColorStop(0, spec.from);
  gradient.addColorStop(1, spec.to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, spec.width, spec.height);

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `600 ${Math.round(spec.width * 0.06)}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'bottom';
  ctx.fillText(spec.label, spec.width * 0.06, spec.height * 0.92);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to render placeholder image'))),
      'image/jpeg',
      0.86,
    );
  });
}
