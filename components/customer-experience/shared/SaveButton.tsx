'use client';
import React from 'react';
import { useTheme } from '@/components/providers/ThemeContext';

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
  const { currentTheme } = useTheme();
  const isLimeTheme = currentTheme?.id === 'emerald_forest';
  const buttonTextColor = isLimeTheme ? '#142403' : '#ffffff';
  const primaryColor = currentTheme?.primaryColor || 'var(--color-primary, #a7cd18)';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        backgroundColor: disabled || loading ? undefined : primaryColor,
        color: disabled || loading ? undefined : buttonTextColor,
      }}
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm shadow-xs transition-all duration-150 cursor-pointer ${
        disabled || loading
          ? 'bg-gray-400 text-white cursor-not-allowed opacity-75'
          : 'hover:brightness-105 active:scale-[0.98]'
      }`}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4"
          style={{ color: buttonTextColor }}
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
