import { useCallback, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { ToastContext, type ToastItem, type ToastTone } from './useToast';

const TONE_ICON: Record<ToastTone, ReactNode> = {
  info: <Info size={16} strokeWidth={1.75} className="text-focus" />,
  success: <CheckCircle2 size={16} strokeWidth={1.75} className="text-[#4C7A5B]" />,
  error: <AlertTriangle size={16} strokeWidth={1.75} className="text-copper" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      counter.current += 1;
      const id = `toast-${counter.current}`;
      setToasts((prev) => [...prev, { ...toast, id }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="animate-popover-in pointer-events-auto flex items-start gap-2.5 rounded-md border border-line bg-surface-raised/85 p-3 shadow-popover backdrop-blur-xl"
          >
            <span className="mt-0.5">{TONE_ICON[toast.tone]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{toast.title}</p>
              {toast.description ? (
                <p className="mt-0.5 text-xs text-ink-secondary">{toast.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
              className={cn('text-ink-muted hover:text-ink')}
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
