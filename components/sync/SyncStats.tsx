import React from 'react';

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 bg-white border border-gray-200 rounded-lg"></div>
        ))}
      </div>
    );
  }

  const successRate = stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(1) : '0.0';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <div className="group bg-white p-5 sm:p-6 border border-gray-200/90 rounded-2xl shadow-2xs hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/15 hover:-translate-y-1.5 transition-all duration-300 ease-out cursor-pointer select-none">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-500 mb-1 sm:mb-2 transition-colors duration-300 group-hover:text-indigo-600">
          Total syncs
        </h3>
        <p className="text-2xl sm:text-4xl font-bold text-gray-900 inline-block origin-left transition-all duration-300 transform group-hover:scale-105 group-hover:text-indigo-600">
          {stats.total}
        </p>
      </div>
      
      <div className="group bg-white p-5 sm:p-6 border border-gray-200/90 rounded-2xl shadow-2xs hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-500/15 hover:-translate-y-1.5 transition-all duration-300 ease-out cursor-pointer select-none">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-500 mb-1 sm:mb-2 transition-colors duration-300 group-hover:text-emerald-600">
          Successful
        </h3>
        <p className="text-2xl sm:text-4xl font-bold text-green-600 inline-block origin-left transition-all duration-300 transform group-hover:scale-105 group-hover:text-emerald-500">
          {stats.success}
        </p>
      </div>
      
      <div className="group bg-white p-5 sm:p-6 border border-gray-200/90 rounded-2xl shadow-2xs hover:border-red-300 hover:shadow-xl hover:shadow-red-500/15 hover:-translate-y-1.5 transition-all duration-300 ease-out cursor-pointer select-none">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-500 mb-1 sm:mb-2 transition-colors duration-300 group-hover:text-red-600">
          Failed
        </h3>
        <p className="text-2xl sm:text-4xl font-bold text-red-600 inline-block origin-left transition-all duration-300 transform group-hover:scale-105 group-hover:text-red-500">
          {stats.failed}
        </p>
      </div>
    </div>
  );
}
