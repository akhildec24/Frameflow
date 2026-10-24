import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Panel({ className, children, ...props }: PanelProps) {
  return (
    <div
      className={cn('rounded-md border border-line bg-surface-raised shadow-card', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function PanelHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex h-10 items-center justify-between border-b border-line px-3', className)}>
      {children}
    </div>
  );
}

export function PanelTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-2xs font-semibold uppercase tracking-wide text-ink-secondary">{children}</h2>;
}
