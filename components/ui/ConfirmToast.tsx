'use client';

import React, { useEffect, useRef } from 'react';
import { useTheme } from '@/components/providers/ThemeContext';

interface ConfirmToastProps {
  open: boolean;
  message: string;
  subMessage?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info' | 'master' | 'standalone';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmToast({
  open,
  message,
  subMessage,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmToastProps) {
  const { currentTheme } = useTheme();
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  // Auto-focus confirm button and attach keyboard listeners for Enter & Escape
  useEffect(() => {
    if (!open) return;

    // Auto-focus confirm button as soon as dialog renders
    const focusTimer = setTimeout(() => {
      confirmBtnRef.current?.focus();
    }, 40);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        // If focus is specifically on the Cancel button, let it cancel
        if (
          document.activeElement &&
          document.activeElement.getAttribute('data-confirm-toast-cancel') === 'true'
        ) {
          e.preventDefault();
          e.stopPropagation();
          if (!loading) onCancel();
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        if (!loading) {
          onConfirm();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (!loading) {
          onCancel();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open, loading, onConfirm, onCancel]);

  if (!open) return null;

  const themePrimary = currentTheme?.primaryColor || 'var(--color-primary, #047857)';
  const themeDark = currentTheme?.darkColor || 'var(--color-primary-dark, #022c22)';

  const confirmBtnStyles = variant === 'warning'
    ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600 focus:ring-amber-500'
    : variant === 'standalone'
    ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 focus:ring-blue-500'
    : 'text-white border-transparent hover:opacity-90 focus:ring-indigo-500';

  const confirmBtnStyle: React.CSSProperties = (variant === 'danger' || variant === 'master' || !variant || variant === 'info')
    ? {
        backgroundColor: themePrimary,
        borderColor: themeDark,
        color: '#ffffff',
      }
    : {};

  const borderBottomColor = variant === 'warning'
    ? '#d97706'
    : variant === 'standalone'
    ? '#2563eb'
    : themePrimary;

  const iconStyle = variant === 'danger'
    ? 'bg-red-50 border-red-200 text-red-500'
    : variant === 'warning'
    ? 'bg-amber-50 border-amber-200 text-amber-600'
    : 'bg-red-50 border-red-200 text-red-500';

  return (
    <>
      {/* Semi-transparent backdrop to isolate focus & dismiss on backdrop click */}
      <div
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-[0.5px] z-[9998] animate-fadeIn transition-opacity"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!loading) onCancel();
        }}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-toast-message"
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-2xl w-[94%] sm:w-auto animate-fadeIn px-2"
      >
        <div 
          className="bg-white text-gray-900 border-x border-t border-gray-200 rounded-2xl shadow-2xl px-5 py-4 min-h-[80px] flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6"
          style={{ borderBottom: `4px solid ${borderBottomColor}` }}
        >
          <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${iconStyle} mt-0.5 sm:mt-0 shadow-2xs`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <span id="confirm-toast-message" className="text-sm font-bold text-gray-900 block truncate sm:whitespace-normal">
                {message}
              </span>
              {subMessage && (
                <span className="text-xs text-gray-500 font-medium block mt-0.5 leading-relaxed">
                  {subMessage}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 shrink-0 self-end sm:self-center">
            <button
              type="button"
              data-confirm-toast-cancel="true"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!loading) onCancel();
              }}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all cursor-pointer border border-gray-300 disabled:opacity-50 whitespace-nowrap active:scale-95"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmBtnRef}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!loading) onConfirm();
              }}
              disabled={loading}
              style={confirmBtnStyle}
              className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm border disabled:opacity-50 whitespace-nowrap active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 ${confirmBtnStyles}`}
            >
              {loading ? 'Processing...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
