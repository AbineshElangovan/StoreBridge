'use client';

import React from 'react';

export interface PerformanceData {
  unitsSold: number;
  revenue: number;
  avgDailySales: number;
  lastSale: string | null;
}

interface ProductPerformanceProps {
  performance: PerformanceData;
}

export function ProductPerformance({ performance }: ProductPerformanceProps) {
  const formattedRevenue = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(performance?.revenue || 0);

  const formatLastSale = (dateStr: string | null) => {
    if (!dateStr) return 'No sales yet';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Recent';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-2xs">
      <div className="mb-4">
        <h3 className="text-base font-bold text-gray-900 tracking-tight">
          Performance
        </h3>
        <p className="text-xs text-gray-500 font-medium mt-0.5">
          Last 30 days.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3.5 sm:p-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Units sold
          </p>
          <p className="text-xl sm:text-2xl font-black text-gray-900">
            {(performance?.unitsSold || 0).toLocaleString()}
          </p>
        </div>

        <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3.5 sm:p-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Revenue
          </p>
          <p className="text-xl sm:text-2xl font-black text-gray-900">
            {formattedRevenue}
          </p>
        </div>

        <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3.5 sm:p-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Avg daily sales
          </p>
          <p className="text-xl sm:text-2xl font-black text-gray-900">
            {performance?.avgDailySales || 0}
          </p>
        </div>

        <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3.5 sm:p-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Last sale
          </p>
          <p className="text-xs sm:text-sm font-extrabold text-gray-900 truncate">
            {formatLastSale(performance?.lastSale)}
          </p>
        </div>
      </div>
    </div>
  );
}
