'use client';

import React from 'react';

interface PreorderBadgeProps {
  size?: 'sm' | 'md';
  className?: string;
}

export function PreorderBadge({ size = 'sm', className = '' }: PreorderBadgeProps) {
  if (size === 'md') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs whitespace-nowrap select-none ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
        Pre-order
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs whitespace-nowrap select-none ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
      Pre-order
    </span>
  );
}

export default PreorderBadge;

