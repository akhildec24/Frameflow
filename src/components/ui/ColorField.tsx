import { useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { clamp01, hexToHsv, hsvToHex, hsvToRgb, normalizeHex } from '../../lib/color';
import { cn } from '../../lib/cn';

/** App-palette quick picks shown above the picker controls. */
const SWATCHES = [
  '#17160f', '#4a463c', '#8a8478', '#d6d1c6', '#f7f6f2', '#ffffff',
  '#c66f42', '#e39b6b', '#8c2f39', '#d9a441', '#5a7d4f', '#3e5c76',
];

interface ColorFieldProps {
  value: string;
  onChange: (hex: string) => void;
  'aria-label'?: string;
}

/**
 * Design-system colour field: a swatch + hex readout that opens a custom
 * popover picker (saturation/value area, hue strip, hex input, palette swatches).
 */
export function ColorField({ value, onChange, 'aria-label': ariaLabel }: ColorFieldProps) {
  const [open, setOpen] = useState(false);
  const hsv = hexToHsv(value);

  const emit = (next: { h?: number; s?: number; v?: number }) => {
    onChange(hsvToHex(next.h ?? hsv.h, next.s ?? hsv.s, next.v ?? hsv.v));
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={ariaLabel ?? 'Pick colour'}
          className="flex h-8 w-full items-center gap-2 rounded-sm border border-line bg-surface px-2 text-left transition-colors hover:border-line-strong"
        >
          <span
            className="h-5 w-5 shrink-0 rounded-xs border border-line-strong/40"
            style={{ background: value }}
          />
          <span className="tabular-nums truncate text-xs text-ink-secondary">{value}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="left"
          align="start"
          sideOffset={10}
          className="z-50 w-[224px] animate-popover-in rounded-lg border border-line bg-surface-raised p-3 shadow-popover"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SatValuePad hsv={hsv} onPick={emit} />
          <HueStrip hue={hsv.h} onPick={(h) => emit({ h })} />
          <HexInput value={value} onCommit={onChange} />
          <div className="grid grid-cols-6 gap-1.5 pt-1">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={swatch}
                onClick={() => onChange(swatch)}
                className={cn(
                  'h-5 w-full rounded-xs border transition-transform hover:scale-110',
                  swatch.toLowerCase() === value.toLowerCase()
                    ? 'border-ink ring-1 ring-ink'
                    : 'border-line-strong/40',
                )}
                style={{ background: swatch }}
              />
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function SatValuePad({
  hsv,
  onPick,
}: {
  hsv: { h: number; s: number; v: number };
  onPick: (next: { s: number; v: number }) => void;
}) {
  const dragging = useRef(false);
  const pureHue = hsvToHex(hsv.h, 1, 1);
  const thumb = hsvToRgb(hsv.h, hsv.s, hsv.v);
  // Dark thumb on bright colours, light thumb on dark ones.
  const thumbBorder = hsv.v > 0.6 && hsv.s < 0.4 ? 'border-ink/60' : 'border-surface';

  const apply = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onPick({
      s: clamp01((e.clientX - rect.left) / rect.width),
      v: 1 - clamp01((e.clientY - rect.top) / rect.height),
    });
  };

  return (
    <div
      role="slider"
      aria-label="Saturation and brightness"
      aria-valuetext={`${Math.round(hsv.s * 100)}% saturation, ${Math.round(hsv.v * 100)}% brightness`}
      className="relative h-32 w-full cursor-crosshair touch-none overflow-hidden rounded-sm"
      style={{
        background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), ${pureHue}`,
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        apply(e);
      }}
      onPointerMove={(e) => dragging.current && apply(e)}
      onPointerUp={() => (dragging.current = false)}
    >
      <span
        className={cn('pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-popover', thumbBorder)}
        style={{
          left: `${hsv.s * 100}%`,
          top: `${(1 - hsv.v) * 100}%`,
          background: `rgb(${Math.round(thumb.r)}, ${Math.round(thumb.g)}, ${Math.round(thumb.b)})`,
        }}
      />
    </div>
  );
}

function HueStrip({ hue, onPick }: { hue: number; onPick: (h: number) => void }) {
  const dragging = useRef(false);

  const apply = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onPick(clamp01((e.clientX - rect.left) / rect.width) * 360);
  };

  return (
    <div
      role="slider"
      aria-label="Hue"
      aria-valuenow={Math.round(hue)}
      aria-valuemin={0}
      aria-valuemax={360}
      className="relative mt-2.5 h-3.5 w-full cursor-pointer touch-none rounded-full"
      style={{
        background:
          'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        apply(e);
      }}
      onPointerMove={(e) => dragging.current && apply(e)}
      onPointerUp={() => (dragging.current = false)}
    >
      <span
        className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface shadow-popover"
        style={{
          left: `${(hue / 360) * 100}%`,
          background: hsvToHex(hue, 1, 1),
        }}
      />
    </div>
  );
}

function HexInput({ value, onCommit }: { value: string; onCommit: (hex: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [prevValue, setPrevValue] = useState(value);

  // Sync the draft when the committed colour changes (render-time adjustment,
  // avoids a flash of stale text vs an effect).
  if (prevValue !== value) {
    setPrevValue(value);
    setDraft(value);
  }

  const commit = () => {
    const parsed = normalizeHex(draft);
    if (parsed) onCommit(parsed);
    else setDraft(value); // revert invalid input
  };

  return (
    <input
      type="text"
      value={draft}
      spellCheck={false}
      aria-label="Hex value"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setDraft(value);
      }}
      className="tabular-nums mt-2.5 h-8 w-full rounded-sm border border-line bg-surface px-2 text-xs text-ink outline-none focus:border-focus"
    />
  );
}
