'use client';
import React from 'react';

export interface SettingsTextareaProps {
  label: string;
  description?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  maxLength?: number;
}

export function SettingsTextarea({
  label,
  description,
  value,
  onChange,
  placeholder,
  rows = 2,
  disabled = false,
  maxLength = 255,
}: SettingsTextareaProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-900 block">{label}</label>
        {maxLength && (
          <span className="text-xs text-gray-400">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
      {description && <p className="text-xs text-gray-500">{description}</p>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        className="w-full px-3.5 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-xl shadow-2xs focus:border-[var(--color-primary,#008060)] focus:ring-1 focus:ring-[var(--color-primary,#008060)] outline-none transition duration-150 resize-y disabled:bg-gray-100 disabled:text-gray-400"
      />
    </div>
  );
}
