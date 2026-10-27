'use client';
import React from 'react';

export interface SaveButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
  loadingLabel?: string;
}

export function SaveButton({
  onClick,
  loading = false,
  disabled = false,
  label = 'Save Changes',
  loadingLabel = 'Saving...',
}: SaveButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm text-[var(--color-primary-text,#000000)] shadow-xs transition-all duration-150 cursor-pointer ${
        disabled || loading
          ? 'bg-gray-400 cursor-not-allowed opacity-75'
          : 'bg-[var(--color-primary,#a7cd18)] hover:brightness-105 active:scale-[0.98]'
      }`}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4 text-[var(--color-primary-text,#000000)]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      <span>{loading ? loadingLabel : label}</span>
    </button>
  );
}
