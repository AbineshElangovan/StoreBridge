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
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-700 text-white border border-rose-800 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-200"></span>
        Out of stock
      </span>
    );
  }

  if (normalized === 'CRITICAL' || normalized === 'LOW') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-600 text-white border border-amber-700 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-200"></span>
        {stockQuantity !== undefined ? `${stockQuantity} ` : ''}Low
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-700 text-white border border-emerald-800 shadow-2xs">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-200"></span>
      {stockQuantity !== undefined ? `${stockQuantity} ` : ''}Healthy
    </span>
  );
}
