import React, { useEffect, useState } from 'react';
import { Check, X, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../lib/utils';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

// Tempo: a floating raised card. Only the glyph carries the state hue (ice for
// info, the semantic tokens for real outcomes); the card itself stays quiet.
const TOAST_ICON: Record<Toast['type'], React.ReactNode> = {
  success: <Check className="h-5 w-5 text-success" aria-hidden="true" />,
  error: <X className="h-5 w-5 text-danger" aria-hidden="true" />,
  warning: <AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />,
  info: <Info className="h-5 w-5 text-accent-2" aria-hidden="true" />,
};

export const ToastComponent: React.FC<ToastProps> = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Show toast
    setTimeout(() => setIsVisible(true), 10);

    // Auto-remove after duration
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, toast.duration || 3000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const isUrgent = toast.type === 'error' || toast.type === 'warning';

  return (
    <div
      role={isUrgent ? 'alert' : 'status'}
      className={cn(
        'fixed left-1/2 top-20 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl bg-surface-raised py-2 pl-4 pr-1 shadow-e3',
        'transition-[opacity,transform] duration-smooth ease-spring-soft motion-reduce:transition-none',
        isVisible && !isExiting ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0',
      )}
    >
      {TOAST_ICON[toast.type]}
      <span className="flex-1 text-body-sm font-medium text-ink">{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => onRemove(toast.id), 300);
        }}
        className="flex h-touch-min w-touch-min shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-snap hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <>
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{ zIndex: 50 - index }} // Stack toasts properly
        >
          <ToastComponent toast={toast} onRemove={onRemove} />
        </div>
      ))}
    </>
  );
};
