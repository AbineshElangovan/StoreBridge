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
      <div className="bg-white p-5 sm:p-6 border border-gray-200 rounded-xl shadow-2xs">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-500 mb-1 sm:mb-2">Total syncs</h3>
        <p className="text-2xl sm:text-4xl font-bold text-gray-900">{stats.total}</p>
      </div>
      
      <div className="bg-white p-5 sm:p-6 border border-gray-200 rounded-xl shadow-2xs">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-500 mb-1 sm:mb-2">Successful</h3>
        <p className="text-2xl sm:text-4xl font-bold text-green-600">{stats.success}</p>
      </div>
      
      <div className="bg-white p-5 sm:p-6 border border-gray-200 rounded-xl shadow-2xs">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-500 mb-1 sm:mb-2">Failed</h3>
        <p className="text-2xl sm:text-4xl font-bold text-red-600">{stats.failed}</p>
      </div>
    </div>
  );
}
