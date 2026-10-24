import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '../../lib/cn';

interface NumberFieldProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
  disabled?: boolean;
}

export function NumberField({
  label,
  value,
  onChange,
  onCommit,
  min = -Infinity,
  max = Infinity,
  step = 1,
  suffix,
  className,
  disabled,
}: NumberFieldProps) {
  const [text, setText] = useState(() => formatNumber(value));
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) setText(formatNumber(value));
  }, [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  const commit = (raw: string) => {
    const parsed = Number.parseFloat(raw);
    const next = Number.isFinite(parsed) ? clamp(parsed) : value;
    setText(formatNumber(next));
    onChange(next);
    onCommit?.(next);
  };

  const step_ = (delta: number) => {
    const next = clamp(Math.round((value + delta * step) * 1000) / 1000);
    onChange(next);
    onCommit?.(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      step_(1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      step_(-1);
    }
  };

  return (
    <label className={cn('flex flex-col gap-1', className)}>
      {label ? <span className="text-2xs text-ink-secondary">{label}</span> : null}
      <span
        className={cn(
          'flex h-8 items-center rounded-sm border border-line bg-surface px-2',
          'focus-within:border-focus focus-within:ring-1 focus-within:ring-focus/40',
          disabled && 'opacity-40',
        )}
      >
        <input
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={text}
          onFocus={() => {
            isFocused.current = true;
          }}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => {
            isFocused.current = false;
            commit(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          className="tabular-nums w-full min-w-0 bg-transparent text-sm text-ink outline-none"
        />
        {suffix ? <span className="text-2xs text-ink-muted">{suffix}</span> : null}
      </span>
    </label>
  );
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Number(value.toFixed(2)).toString();
}
