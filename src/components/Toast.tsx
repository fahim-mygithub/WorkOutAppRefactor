import React, { useEffect, useState } from 'react';
import { Check, X, AlertTriangle, Info } from 'lucide-react';

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

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <Check className="w-5 h-5 text-success" />;
      case 'error':
        return <X className="w-5 h-5 text-danger" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'info':
        return <Info className="w-5 h-5 text-accent" />;
    }
  };

  const getBgColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-surface-raised border-success/40';
      case 'error':
        return 'bg-surface-raised border-danger/40';
      case 'warning':
        return 'bg-surface-raised border-warning/40';
      case 'info':
        return 'bg-surface-raised border-accent/40';
    }
  };

  return (
    <div
      className={`
        fixed top-20 left-1/2 transform -translate-x-1/2 z-50
        flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border
        min-w-[300px] max-w-[400px]
        transition-all duration-300 ease-in-out
        ${getBgColor()}
        ${isVisible && !isExiting
          ? 'translate-y-0 opacity-100 scale-100'
          : 'translate-y-[-20px] opacity-0 scale-95'
        }
      `}
    >
      {getIcon()}
      <span className="text-ink text-sm font-medium flex-1">{toast.message}</span>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => onRemove(toast.id), 300);
        }}
        className="text-ink-muted hover:text-ink p-1 rounded"
      >
        <X className="w-4 h-4" />
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