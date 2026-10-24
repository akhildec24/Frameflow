import * as RadixDropdown from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export const Dropdown = RadixDropdown.Root;
export const DropdownTrigger = RadixDropdown.Trigger;

export function DropdownContent({
  children,
  align = 'start',
  className,
}: {
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  return (
    <RadixDropdown.Portal>
      <RadixDropdown.Content
        align={align}
        sideOffset={6}
        className={cn(
          'z-50 min-w-[180px] rounded-md border border-line bg-surface-raised/85 p-1 shadow-popover backdrop-blur-xl',
          'animate-popover-in',
          className,
        )}
      >
        {children}
      </RadixDropdown.Content>
    </RadixDropdown.Portal>
  );
}

export function DropdownItem({
  children,
  onSelect,
  destructive,
  disabled,
}: {
  children: ReactNode;
  onSelect?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <RadixDropdown.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm text-ink outline-none',
        'data-[highlighted]:bg-surface-hover',
        'data-[disabled]:opacity-40 data-[disabled]:pointer-events-none',
        destructive && 'text-[#9A4530] data-[highlighted]:bg-copper-soft',
      )}
    >
      {children}
    </RadixDropdown.Item>
  );
}

export const DropdownSeparator = () => <RadixDropdown.Separator className="my-1 h-px bg-line" />;
