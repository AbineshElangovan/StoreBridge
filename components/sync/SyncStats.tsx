import React from 'react';
import { Icon } from '@shopify/polaris';
import {
  RefreshIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ChartVerticalIcon,
} from '@shopify/polaris-icons';

interface SyncStatsProps {
  stats: {
    total: number;
    success: number;
    failed: number;
    pending: number;
    skipped: number;
  };
  isLoading: boolean;
}

export function SyncStats({ stats, isLoading }: SyncStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 bg-white border border-slate-100 rounded-2xl shadow-xs"></div>
        ))}
      </div>
    );
  }

  const successRate = stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(1) : '0.0';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 w-full">
      {/* 1. Total Syncs */}
      <div className="group bg-white p-5 rounded-2xl border border-blue-100/90 shadow-xs flex flex-col justify-between hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/15 hover:-translate-y-1.5 transition-all duration-300 ease-out cursor-pointer select-none">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-blue-900 tracking-tight uppercase transition-colors duration-300 group-hover:text-blue-600">
            Total Syncs
          </span>
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100/60 transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-100 group-hover:text-blue-800 group-hover:rotate-6">
            <Icon source={RefreshIcon} tone="base" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight transition-all duration-300 transform origin-left inline-block group-hover:scale-105 group-hover:text-blue-600">
            {stats.total.toLocaleString()}
          </span>
          <p className="text-xs text-blue-700 font-semibold mt-1 transition-colors duration-300 group-hover:text-blue-950">
            All sync operations
          </p>
        </div>
      </div>

      {/* 2. Successful */}
      <div className="group bg-white p-5 rounded-2xl border border-emerald-100/90 shadow-xs flex flex-col justify-between hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-500/15 hover:-translate-y-1.5 transition-all duration-300 ease-out cursor-pointer select-none">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-900 tracking-tight uppercase transition-colors duration-300 group-hover:text-emerald-600">
            Successful
          </span>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100/60 transition-all duration-300 group-hover:scale-110 group-hover:bg-emerald-100 group-hover:text-emerald-800 group-hover:rotate-6">
            <Icon source={CheckCircleIcon} tone="base" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight transition-all duration-300 transform origin-left inline-block group-hover:scale-105 group-hover:text-emerald-600">
            {stats.success.toLocaleString()}
          </span>
          <p className="text-xs text-emerald-700 font-semibold mt-1 transition-colors duration-300 group-hover:text-emerald-950">
            Synced without errors
          </p>
        </div>
      </div>

      {/* 3. Failed */}
      <div className="group bg-white p-5 rounded-2xl border border-rose-100/90 shadow-xs flex flex-col justify-between hover:border-rose-300 hover:shadow-xl hover:shadow-rose-500/15 hover:-translate-y-1.5 transition-all duration-300 ease-out cursor-pointer select-none">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-rose-900 tracking-tight uppercase transition-colors duration-300 group-hover:text-rose-600">
            Failed
          </span>
          <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-100/60 transition-all duration-300 group-hover:scale-110 group-hover:bg-rose-100 group-hover:text-rose-800 group-hover:rotate-6">
            <Icon source={AlertTriangleIcon} tone="base" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight transition-all duration-300 transform origin-left inline-block group-hover:scale-105 group-hover:text-rose-600">
            {stats.failed.toLocaleString()}
          </span>
          <p className="text-xs text-rose-700 font-semibold mt-1 transition-colors duration-300 group-hover:text-rose-950">
            Errors requiring review
          </p>
        </div>
      </div>

      {/* 4. Success Rate */}
      <div className="group bg-white p-5 rounded-2xl border border-purple-100/90 shadow-xs flex flex-col justify-between hover:border-purple-300 hover:shadow-xl hover:shadow-purple-500/15 hover:-translate-y-1.5 transition-all duration-300 ease-out cursor-pointer select-none">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-purple-900 tracking-tight uppercase transition-colors duration-300 group-hover:text-purple-600">
            Success Rate
          </span>
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100/60 transition-all duration-300 group-hover:scale-110 group-hover:bg-purple-100 group-hover:text-purple-800 group-hover:rotate-6">
            <Icon source={ChartVerticalIcon} tone="base" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight transition-all duration-300 transform origin-left inline-block group-hover:scale-105 group-hover:text-purple-600">
            {successRate}%
          </span>
          <p className="text-xs text-purple-700 font-semibold mt-1 transition-colors duration-300 group-hover:text-purple-950">
            Overall reliability
          </p>
        </div>
      </div>
    </div>
  );
}
