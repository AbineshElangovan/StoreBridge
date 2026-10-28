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
      <div className="group bg-white p-5 rounded-2xl border border-purple-100/90 shadow-xs flex flex-col justify-between hover:border-purple-300 hover:shadow-xl hover:shadow-purple-500/15 hover:-translate-y-1.5 transition-all duration-300 ease-out cursor-pointer select-none">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-purple-900 tracking-tight uppercase transition-colors duration-300 group-hover:text-purple-600">
            Total Pre-orders
          </span>
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100/60 transition-all duration-300 group-hover:scale-110 group-hover:bg-purple-100 group-hover:text-purple-800 group-hover:rotate-6">
            <Icon source={CartIcon} tone="base" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight transition-all duration-300 transform origin-left inline-block group-hover:scale-105 group-hover:text-purple-600">
            {totalPreorders.toLocaleString('en-IN')}
          </span>
          <p className="text-xs text-purple-700 font-semibold mt-1 transition-colors duration-300 group-hover:text-purple-950">
            Orders created
          </p>
        </div>
      </div>

      {/* 2. Pending Pre-orders */}
      <div className="group bg-white p-5 rounded-2xl border border-amber-100/90 shadow-xs flex flex-col justify-between hover:border-amber-300 hover:shadow-xl hover:shadow-amber-500/15 hover:-translate-y-1.5 transition-all duration-300 ease-out cursor-pointer select-none">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-amber-900 tracking-tight uppercase transition-colors duration-300 group-hover:text-amber-600">
            Pending Pre-orders
          </span>
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100/60 transition-all duration-300 group-hover:scale-110 group-hover:bg-amber-100 group-hover:text-amber-800 group-hover:rotate-6">
            <Icon source={ClockIcon} tone="base" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight transition-all duration-300 transform origin-left inline-block group-hover:scale-105 group-hover:text-amber-600">
            {pendingPreorders.toLocaleString('en-IN')}
          </span>
          <p className="text-xs text-amber-700 font-semibold mt-1 transition-colors duration-300 group-hover:text-amber-950">
            Awaiting fulfillment
          </p>
        </div>
      </div>

      {/* 3. Pre-order Revenue */}
      <div className="group bg-white p-5 rounded-2xl border border-emerald-100/90 shadow-xs flex flex-col justify-between hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-500/15 hover:-translate-y-1.5 transition-all duration-300 ease-out cursor-pointer select-none">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-900 tracking-tight uppercase transition-colors duration-300 group-hover:text-emerald-600">
            Pre-order Revenue
          </span>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100/60 transition-all duration-300 group-hover:scale-110 group-hover:bg-emerald-100 group-hover:text-emerald-800 group-hover:rotate-6">
            <Icon source={CashDollarIcon} tone="base" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight truncate inline-block transition-all duration-300 transform origin-left group-hover:scale-105 group-hover:text-emerald-600" title={formattedRevenue}>
            {formattedRevenue}
          </span>
          <p className="text-xs text-emerald-700 font-semibold mt-1 transition-colors duration-300 group-hover:text-emerald-950">
            Payments collected
          </p>
        </div>
      </div>

      {/* 4. Pending Revenue */}
      <div className="group bg-white p-5 rounded-2xl border border-sky-100/90 shadow-xs flex flex-col justify-between hover:border-sky-300 hover:shadow-xl hover:shadow-sky-500/15 hover:-translate-y-1.5 transition-all duration-300 ease-out cursor-pointer select-none">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-sky-900 tracking-tight uppercase transition-colors duration-300 group-hover:text-sky-600">
            Pending Revenue
          </span>
          <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100/60 transition-all duration-300 group-hover:scale-110 group-hover:bg-sky-100 group-hover:text-sky-800 group-hover:rotate-6">
            <Icon source={CashDollarIcon} tone="base" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight truncate inline-block transition-all duration-300 transform origin-left group-hover:scale-105 group-hover:text-sky-600" title={formattedPendingRevenue}>
            {formattedPendingRevenue}
          </span>
          <p className="text-xs text-sky-700 font-semibold mt-1 transition-colors duration-300 group-hover:text-sky-950">
            Remaining balance due
          </p>
        </div>
      </div>
    </div>
  );
}
