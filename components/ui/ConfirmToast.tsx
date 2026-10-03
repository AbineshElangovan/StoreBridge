'use client';

import React from 'react';
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

  if (!open) return null;

  const themePrimary = currentTheme?.primaryColor || 'var(--color-primary, #047857)';
  const themeDark = currentTheme?.darkColor || 'var(--color-primary-dark, #022c22)';

  const confirmBtnStyles = variant === 'warning'
    ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
    : variant === 'standalone'
    ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
    : 'text-white border-transparent hover:opacity-90';

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
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-2xl w-[94%] sm:w-auto animate-fadeIn px-2">
      <div 
        className="bg-white text-gray-900 border-x border-t border-gray-200 rounded-2xl shadow-2xl px-5 py-4 min-h-[80px] flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6"
        style={{ borderBottom: `4px solid ${borderBottomColor}` }}
      >
        <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${iconStyle} mt-0.5 sm:mt-0`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-sm font-bold text-gray-900 block truncate sm:whitespace-normal">
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
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all cursor-pointer border border-gray-300 disabled:opacity-50 whitespace-nowrap"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={confirmBtnStyle}
            className={`px-4.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm border disabled:opacity-50 whitespace-nowrap ${confirmBtnStyles}`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
