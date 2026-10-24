import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Tooltip } from './Tooltip';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  active?: boolean;
  size?: 'sm' | 'md';
  showTooltip?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, label, icon, active, size = 'md', showTooltip = true, disabled, ...props }, ref) => {
    const button = (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center rounded-sm text-ink-secondary transition-colors duration-150',
          'hover:bg-surface-hover hover:text-ink',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60',
          'disabled:opacity-35 disabled:pointer-events-none',
          size === 'md' ? 'h-9 w-9' : 'h-7 w-7',
          active && 'bg-surface-soft text-ink',
          className,
        )}
        {...props}
      >
        {icon}
      </button>
    );

    if (!showTooltip) return button;
    return <Tooltip content={label}>{button}</Tooltip>;
  },
);
IconButton.displayName = 'IconButton';
