'use client';

import React from 'react';

interface NumberSettingInputProps {
  id: string;
  label: string;
  value: number | string;
  onChange: (val: string) => void;
  error?: string | null;
  helpText?: string;
  disabled?: boolean;
  min?: number;
  placeholder?: string;
  /** Optional preset quick-pick values shown as chips below the input */
  quickPicks?: number[];
  /** Unit label to show inside quick-pick chips, e.g. "days" */
  quickPickUnit?: string;
}

export const NumberSettingInput: React.FC<NumberSettingInputProps> = ({
  id,
  label,
  value,
  onChange,
  error,
  helpText,
  disabled = false,
  min = 1,
  placeholder = 'Enter value',
  quickPicks,
  quickPickUnit = 'days'
}) => {
  const activeVal = String(value);
  return (
    <div className="space-y-1">
      <style jsx global>{`
        /* Hide browser number spinners */
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
      
      <label htmlFor={id} className="block text-sm font-semibold text-gray-900">
        {label}
      </label>
      
      <div className="relative w-full max-w-full">
        <input
          id={id}
          type="number"
          min={min}
          step="1"
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            const cleanVal = e.target.value.replace(/^0+(?=\d)/, '');
            onChange(cleanVal);
          }}
          className={`w-full px-3 py-2 text-sm font-medium rounded-lg border transition-all duration-150 outline-none ${
            error
              ? 'border-red-500 bg-red-50/50 text-red-900 focus:ring-2 focus:ring-red-200'
              : 'border-gray-300 bg-white text-gray-900 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20'
          } ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' : ''}`}
        />
      </div>

      {quickPicks && quickPicks.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {quickPicks.map((pick) => {
            const isActive = activeVal === String(pick);
            return (
              <button
                key={pick}
                type="button"
                disabled={disabled}
                onClick={() => onChange(String(pick))}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isActive
                    ? 'text-white border-transparent shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
                }`}
                style={isActive ? { backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-primary)' } : {}}
              >
                {pick} {quickPickUnit}
              </button>
            );
          })}
        </div>
      )}

      {error ? (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1 mt-1">
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      ) : helpText ? (
        <div 
          className="mt-1.5 px-2.5 py-1.5 rounded-lg text-xs flex items-start gap-1.5 w-full border bg-white/80 backdrop-blur-xs transition-colors shadow-2xs"
          style={{
            borderColor: 'var(--border-color)',
          }}
        >
          <span 
            className="font-bold text-[11px] shrink-0 mt-0.5"
            style={{ color: 'var(--color-primary)' }}
          >
            Note:
          </span>
          <span className="font-medium text-[11px] text-gray-600 leading-tight">
            {helpText}
          </span>
        </div>
      ) : null}
    </div>
  );
};
