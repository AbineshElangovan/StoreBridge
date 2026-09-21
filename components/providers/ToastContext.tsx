"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Toast } from '@/components/common/Toast';

export interface ToastOptions {
  message: string;
  error?: boolean;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, isError?: boolean, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    error: boolean;
    duration: number;
  } | null>(null);

  const showToast = useCallback((message: string, isError = false, duration = 3500) => {
    setToast({
      id: Date.now(),
      message,
      error: isError,
      duration,
    });
  }, []);

  const showSuccess = useCallback((message: string, duration = 3500) => {
    showToast(message, false, duration);
  }, [showToast]);

  const showError = useCallback((message: string, duration = 4000) => {
    showToast(message, true, duration);
  }, [showToast]);

  const handleDismiss = useCallback(() => {
    setToast(null);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError }}>
      {children}
      {toast && (
        <Toast
          key={toast.id}
          content={toast.message}
          error={toast.error}
          duration={toast.duration}
          onDismiss={handleDismiss}
        />
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if rendered outside provider so it doesn't crash
    return {
      showToast: (msg: string) => console.log('[Toast fallback]', msg),
      showSuccess: (msg: string) => console.log('[Toast success fallback]', msg),
      showError: (msg: string) => console.error('[Toast error fallback]', msg),
    };
  }
  return context;
}
