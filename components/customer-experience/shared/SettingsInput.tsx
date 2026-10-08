'use client';
import React from 'react';

export interface SettingsInputProps {
  label: string;
  description?: string;
  value: string | number;
  onChange: (val: string) => void;
  type?: 'text' | 'number';
  placeholder?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  required?: boolean;
  suffix?: string;
}

export function SettingsInput({
  label,
  description,
  value,
  onChange,
  type = 'text',
  placeholder,
  min,
  max,
  disabled = false,
  required = false,
  suffix,
}: SettingsInputProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-900 block">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {suffix && <span className="text-xs text-gray-500 font-medium">{suffix}</span>}
      </div>
      {description && <p className="text-xs text-gray-500">{description}</p>}
      <div className="relative">
        <input
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          disabled={disabled}
          className="w-full px-3.5 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-xl shadow-2xs focus:border-[var(--color-primary,#008060)] focus:ring-1 focus:ring-[var(--color-primary,#008060)] outline-none transition duration-150 disabled:bg-gray-100 disabled:text-gray-400"
        />
      </div>
    </div>
  );
}
