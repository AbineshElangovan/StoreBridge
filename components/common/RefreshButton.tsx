'use client';

import React, { useState } from 'react';
import { RefreshIcon } from '@shopify/polaris-icons';

export interface RefreshButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Optional async or sync click handler */
  onRefresh?: () => Promise<any> | void;
  /** Explicit external loading/refreshing state */
  isRefreshing?: boolean;
  /** Label when idle (default: 'Refresh') */
  label?: string;
  /** Label while spinning/refreshing (default: 'Refreshing...') */
  refreshingLabel?: string;
  /** If true, only renders the circular icon button without text */
  iconOnly?: boolean;
  /** Visual variant styling */
  variant?: 'white' | 'primary' | 'secondary' | 'ghost' | 'dark' | 'outline';
  /** Button size */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Icon size override (in px, e.g. 14, 16) */
  iconSize?: number;
  /** Minimum duration (in ms) to spin so user always sees a smooth rotation */
  minSpinDuration?: number;
  /** Optional custom class name */
  className?: string;
}

export function RefreshButton({
  onRefresh,
  isRefreshing: externalIsRefreshing,
  onClick,
  label = 'Refresh',
  refreshingLabel = 'Refreshing...',
  iconOnly = false,
  variant = 'white',
  size = 'md',
  iconSize,
  minSpinDuration = 700,
  className = '',
  disabled,
  title,
  children,
  ...rest
}: RefreshButtonProps) {
  const [internalSpinning, setInternalSpinning] = useState(false);

  // Active spin state is true if either external prop is true OR internal spin is active
  const isSpinning = Boolean(externalIsRefreshing || internalSpinning);
  const isDisabled = Boolean(disabled || isSpinning);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) return;

    // Trigger internal spin
    setInternalSpinning(true);
    const startTime = Date.now();

    try {
      if (onRefresh) {
        await onRefresh();
      } else if (onClick) {
        await (onClick as any)(e);
      }
    } finally {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, minSpinDuration - elapsed);

      if (remaining > 0) {
        setTimeout(() => {
          setInternalSpinning(false);
        }, remaining);
      } else {
        setInternalSpinning(false);
      }
    }
  };

  // Size configurations
  let sizeStyles = 'px-3.5 py-2 text-xs gap-2 rounded-xl';
  let defaultIconPx = 15;

  if (size === 'xs') {
    sizeStyles = iconOnly ? 'p-1 rounded-md' : 'px-2 py-1 text-[11px] gap-1 rounded-lg';
    defaultIconPx = 13;
  } else if (size === 'sm') {
    sizeStyles = iconOnly ? 'p-1.5 rounded-lg' : 'px-2.5 py-1.5 text-xs gap-1.5 rounded-lg';
    defaultIconPx = 14;
  } else if (size === 'lg') {
    sizeStyles = iconOnly ? 'p-3 rounded-2xl' : 'px-5 py-2.5 text-sm gap-2.5 rounded-2xl';
    defaultIconPx = 18;
  } else if (iconOnly) {
    sizeStyles = 'p-2 rounded-xl';
    defaultIconPx = 16;
  }

  const resolvedIconPx = iconSize || defaultIconPx;

  // Variant configurations
  let variantStyles = 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-2xs hover:shadow-xs';
  let iconColor = 'text-gray-600';

  if (variant === 'primary') {
    variantStyles = 'bg-[var(--color-primary,#0db69d)] hover:brightness-95 text-white font-bold shadow-xs border border-transparent';
    iconColor = 'text-white fill-white';
  } else if (variant === 'ghost') {
    variantStyles = 'bg-transparent hover:bg-gray-200/60 text-gray-600 hover:text-gray-900 border border-transparent shadow-none';
    iconColor = 'text-gray-500 hover:text-gray-900';
  } else if (variant === 'dark') {
    variantStyles = 'bg-slate-900 hover:bg-slate-800 text-white font-semibold border border-slate-800 shadow-xs';
    iconColor = 'text-white fill-white';
  } else if (variant === 'outline') {
    variantStyles = 'bg-transparent hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-2xs';
    iconColor = 'text-gray-600';
  } else if (variant === 'secondary') {
    variantStyles = 'bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200/80 shadow-2xs';
    iconColor = 'text-gray-700';
  }

  const tooltipTitle = title || (isSpinning ? refreshingLabel : label);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      title={tooltipTitle}
      aria-label={tooltipTitle}
      className={`inline-flex items-center justify-center font-semibold transition-all duration-200 ease-out select-none cursor-pointer focus:outline-none hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none ${sizeStyles} ${variantStyles} ${className}`}
      {...rest}
    >
      {/* Official Shopify Polaris Rotating Refresh Icon */}
      <div
        style={{ width: `${resolvedIconPx}px`, height: `${resolvedIconPx}px` }}
        className={`shrink-0 flex items-center justify-center transition-transform ${iconColor} ${
          isSpinning ? 'animate-spin origin-center' : ''
        }`}
      >
        <RefreshIcon className="w-full h-full fill-current text-current" />
      </div>

      {/* Button Text (when not icon-only) */}
      {!iconOnly && (
        <span className="truncate">
          {children || (isSpinning ? refreshingLabel : label)}
        </span>
      )}
    </button>
  );
}

