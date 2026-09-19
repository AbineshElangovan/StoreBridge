'use client';

import React from 'react';

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
  if (!open) return null;

  const confirmBtnStyles = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 text-white border-red-600'
    : variant === 'warning'
    ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
    : variant === 'standalone'
    ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
    : variant === 'master'
    ? 'bg-[#059669] hover:bg-[#047857] text-white border-emerald-600'
    : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600';

  const borderStyle = variant === 'danger'
    ? 'border-red-600'
    : variant === 'warning'
    ? 'border-amber-600'
    : variant === 'standalone'
    ? 'border-blue-600'
    : 'border-emerald-600';

  const iconStyle = variant === 'danger'
    ? 'bg-red-50 border-red-200 text-red-600'
    : variant === 'warning'
    ? 'bg-amber-50 border-amber-200 text-amber-600'
    : 'bg-emerald-50 border-emerald-200 text-emerald-600';

  return (
    <div className="fixed top-0 left-1/2 -translate-x-1/2 z-[9999] max-w-xl w-[92%] sm:w-auto animate-fadeIn">
      <div className={`bg-white text-gray-900 border-b-4 ${borderStyle} border-x border-gray-200 rounded-b-2xl shadow-2xl px-6 py-4.5 min-h-[100px] flex items-center justify-between gap-6`}>
        <div className="flex items-center gap-3.5">
          <div className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${iconStyle}`}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-bold text-gray-900 whitespace-nowrap block sm:inline">
              {message}
            </span>
            {subMessage && (
              <span className="text-xs text-gray-600 font-medium block mt-0.5 sm:mt-0 sm:inline sm:ml-2">
                {subMessage}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4.5 py-2.5 rounded-xl text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all cursor-pointer border border-gray-300 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md border disabled:opacity-50 ${confirmBtnStyles}`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
