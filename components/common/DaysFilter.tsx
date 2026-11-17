'use client';

import React from 'react';

export type DaysRange = '7' | '14' | '30' | '90' | 'all';

export interface DaysOption {
  label: string;
  value: DaysRange;
  days: number | null;
}

export const DEFAULT_DAYS_OPTIONS: DaysOption[] = [
  { label: '7 Days', value: '7', days: 7 },
  { label: '14 Days', value: '14', days: 14 },
  { label: '30 Days', value: '30', days: 30 },
  { label: '90 Days', value: '90', days: 90 },
  { label: 'All Time', value: 'all', days: null },
];

export interface DaysFilterProps {
  value: DaysRange;
  onChange: (val: DaysRange) => void;
  options?: DaysOption[];
  size?: 'sm' | 'md';
  className?: string;
  label?: string;
  variant?: 'dropdown' | 'pills';
}

/**
 * Reusable, responsive Days-based filter dropdown (with pills support)
 * Matches Shopify / Polaris UI guidelines with clean borders, calendar icon, and smooth styling.
 */
export function DaysFilter({
  value,
  onChange,
  options = DEFAULT_DAYS_OPTIONS,
  size = 'sm',
  className = '',
  label,
  variant = 'dropdown',
}: DaysFilterProps) {
  const isSmall = size === 'sm';

  // Pill button group variant
  if (variant === 'pills') {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        {label && (
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mr-1 select-none">
            {label}:
          </span>
        )}
        <div className="inline-flex items-center p-0.5 bg-gray-100 rounded-lg border border-gray-200/80 shadow-2xs">
          {options.map((opt) => {
            const isActive = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange(opt.value)}
                className={`transition-all duration-150 select-none cursor-pointer rounded-md font-semibold ${
                  isSmall ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs'
                } ${
                  isActive
                    ? 'bg-[var(--color-primary)] text-white shadow-xs font-bold border border-[var(--color-primary-dark,var(--color-primary))]'
                    : 'text-gray-600 hover:text-gray-900 border border-transparent hover:bg-gray-200/60'
                }`}
                aria-pressed={isActive}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Dropdown variant (clean Shopify / Polaris dropdown select)
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {label && (
        <span className="text-xs font-semibold text-gray-600 select-none whitespace-nowrap">
          {label}:
        </span>
      )}
      <div className="relative inline-flex items-center">
        {/* Calendar Icon */}
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-500">
          <svg
            className={isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>

        {/* Dropdown Select */}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as DaysRange)}
          aria-label={label || 'Select days filter'}
          className={`appearance-none bg-white font-semibold text-gray-700 border border-gray-300 hover:border-gray-400 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all cursor-pointer ${
            isSmall
              ? 'pl-7.5 pr-6.5 py-1 text-xs h-[28px]'
              : 'pl-8.5 pr-7.5 py-1.5 text-xs sm:text-sm h-[34px]'
          }`}
          style={{ minWidth: isSmall ? '102px' : '118px' }}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="text-gray-800 py-1">
              {opt.label}
            </option>
          ))}
        </select>

        {/* Chevron Down Icon */}
        <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-gray-400">
          <svg
            className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
