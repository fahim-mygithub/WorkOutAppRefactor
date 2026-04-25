import { useState, useCallback } from 'react';
import { Toast } from '../components/Toast';

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newToast: Toast = {
      ...toast,
      id,
    };

    setToasts(prev => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showSuccess = useCallback((message: string, duration?: number) => {
    return addToast({ message, type: 'success', duration });
  }, [addToast]);

  const showError = useCallback((message: string, duration?: number) => {
    return addToast({ message, type: 'error', duration });
  }, [addToast]);

  const showWarning = useCallback((message: string, duration?: number) => {
    return addToast({ message, type: 'warning', duration });
  }, [addToast]);

  const showInfo = useCallback((message: string, duration?: number) => {
    return addToast({ message, type: 'info', duration });
  }, [addToast]);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    clearAll,
  };
};