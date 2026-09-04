'use client';

import React from 'react';

interface StockHealthBadgeProps {
  status: string;
  stockQuantity?: number;
}

export function StockHealthBadge({ status, stockQuantity }: StockHealthBadgeProps) {
  const normalized = (status || '').toUpperCase().replace(/[\s\-]+/g, '_');

  if (normalized === 'OUT_OF_STOCK') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
        Out of stock
      </span>
    );
  }

  if (normalized === 'CRITICAL' || normalized === 'LOW') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
        {stockQuantity !== undefined ? `${stockQuantity} ` : ''}Low
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
      {stockQuantity !== undefined ? `${stockQuantity} ` : ''}Healthy
    </span>
  );
}
