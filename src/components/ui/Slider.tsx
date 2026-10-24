import * as RadixSlider from '@radix-ui/react-slider';
import { cn } from '../../lib/cn';

interface SliderProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  formatValue?: (value: number) => string;
}

export function Slider({
  label,
  value,
  onChange,
  onCommit,
  min = 0,
  max = 100,
  step = 1,
  className,
  formatValue,
}: SliderProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <div className="flex items-center justify-between text-2xs text-ink-secondary">
          <span>{label}</span>
          <span className="tabular-nums text-ink">{formatValue ? formatValue(value) : value}</span>
        </div>
      ) : null}
      <RadixSlider.Root
        className="relative flex h-4 w-full touch-none select-none items-center"
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        onValueCommit={([v]) => onCommit?.(v)}
      >
        <RadixSlider.Track className="relative h-1 grow rounded-pill bg-line-strong">
          <RadixSlider.Range className="absolute h-full rounded-pill bg-copper" />
        </RadixSlider.Track>
        <RadixSlider.Thumb
          className={cn(
            'block h-3.5 w-3.5 rounded-full border-2 border-copper bg-surface-raised shadow-card',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50',
          )}
        />
      </RadixSlider.Root>
    </div>
  );
}
