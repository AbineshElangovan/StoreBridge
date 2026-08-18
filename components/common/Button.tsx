"use client";

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'white' | 'destructive' | 'plain' | 'outline';
  size?: 'slim' | 'medium' | 'large';
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'medium',
  loading = false,
  disabled = false,
  icon,
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  // Base styles
  let baseClass = "inline-flex items-center justify-center font-semibold transition-all rounded-lg select-none cursor-pointer focus:outline-none";

  // Size styles
  let sizeClass = "px-3.5 py-1.5 text-xs gap-1.5";
  if (size === 'slim') {
    sizeClass = "px-2.5 py-1 text-xs gap-1";
  } else if (size === 'large') {
    sizeClass = "px-5 py-2.5 text-sm gap-2";
  }

  // Variant styles
  let variantClass = "";
  if (variant === 'primary') {
    variantClass = "bg-[#0db69d] hover:bg-[#0b9c86] text-white shadow-xs active:bg-[#09806e]";
  } else if (variant === 'destructive') {
    variantClass = "bg-[#991b1b] hover:bg-[#7f1d1d] text-white shadow-xs active:bg-[#6b1414]";
  } else if (variant === 'plain') {
    variantClass = "bg-transparent text-gray-600 hover:text-gray-900 shadow-none border-none p-0";
  } else if (variant === 'outline') {
    variantClass = "bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 shadow-2xs";
  } else {
    // Secondary / White
    variantClass = "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 shadow-2xs active:bg-gray-100";
  }

  // Disabled / Loading
  const isDisabled = disabled || loading;
  if (isDisabled) {
    variantClass += " opacity-50 cursor-not-allowed pointer-events-none";
  }

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`${baseClass} ${sizeClass} ${variantClass} ${className}`}
      {...rest}
    >
      {loading && (
        <svg
          className="animate-spin -ml-0.5 mr-1.5 h-3.5 w-3.5 text-current"
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
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      )}
      {!loading && icon && <span className="inline-flex items-center">{icon}</span>}
      {children}
    </button>
  );
}
