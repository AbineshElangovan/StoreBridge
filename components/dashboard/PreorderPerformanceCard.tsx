'use client';

import React from 'react';
import { Icon } from '@shopify/polaris';
import {
  CartIcon,
  ClockIcon,
  CashDollarIcon,
} from '@shopify/polaris-icons';
import type { PreorderMetrics } from '@/services/preorder/preorder-service';

export interface PreorderPerformanceCardProps {
  metrics?: PreorderMetrics;
}

export function PreorderPerformanceCard({ metrics }: PreorderPerformanceCardProps) {
  const safeMetrics: PreorderMetrics = metrics || {
    totalPreorders: 0,
    pendingPreorders: 0,
    revenue: 0,
    pendingRevenue: 0,
    totalRevenue: 0,
    awaitingStockCount: 0,
    allocatedStockCount: 0,
    fulfilledCount: 0,
    currency: 'INR',
  };

  const {
    totalPreorders = 0,
    pendingPreorders = 0,
    revenue = 0,
    pendingRevenue = 0,
  } = safeMetrics;

  const formattedRevenue = `₹${Number(revenue || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const formattedPendingRevenue = `₹${Number(pendingRevenue || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {/* 1. Total Pre-orders */}
      <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-xs flex flex-col justify-between hover:border-purple-200 hover:shadow-sm transition-all duration-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-purple-900 tracking-tight uppercase">Total Pre-orders</span>
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100/60">
            <Icon source={CartIcon} tone="base" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {totalPreorders.toLocaleString('en-IN')}
          </span>
          <p className="text-xs text-purple-700 font-semibold mt-1">Orders created</p>
        </div>
      </div>

      {/* 2. Pending Pre-orders */}
      <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-xs flex flex-col justify-between hover:border-amber-200 hover:shadow-sm transition-all duration-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-amber-900 tracking-tight uppercase">Pending Pre-orders</span>
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100/60">
            <Icon source={ClockIcon} tone="base" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {pendingPreorders.toLocaleString('en-IN')}
          </span>
          <p className="text-xs text-amber-700 font-semibold mt-1">Awaiting fulfillment</p>
        </div>
      </div>

      {/* 3. Pre-order Revenue */}
      <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs flex flex-col justify-between hover:border-emerald-200 hover:shadow-sm transition-all duration-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-900 tracking-tight uppercase">Pre-order Revenue</span>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100/60">
            <Icon source={CashDollarIcon} tone="base" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight truncate block" title={formattedRevenue}>
            {formattedRevenue}
          </span>
          <p className="text-xs text-emerald-700 font-semibold mt-1">Payments collected</p>
        </div>
      </div>

      {/* 4. Pending Revenue */}
      <div className="bg-white p-5 rounded-2xl border border-sky-100 shadow-xs flex flex-col justify-between hover:border-sky-200 hover:shadow-sm transition-all duration-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-sky-900 tracking-tight uppercase">Pending Revenue</span>
          <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100/60">
            <Icon source={CashDollarIcon} tone="base" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight truncate block" title={formattedPendingRevenue}>
            {formattedPendingRevenue}
          </span>
          <p className="text-xs text-sky-700 font-semibold mt-1">Remaining balance due</p>
        </div>
      </div>
    </div>
  );
}
