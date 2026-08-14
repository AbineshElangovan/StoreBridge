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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 bg-white border border-gray-200 rounded-lg"></div>
        ))}
      </div>
    );
  }

  const successRate = stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(1) : '0.0';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Total syncs</h3>
        <p className="text-4xl font-bold text-gray-900">{stats.total}</p>
      </div>
      
      <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Successful</h3>
        <p className="text-4xl font-bold text-green-600">{stats.success}</p>
      </div>
      
      <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Failed</h3>
        <p className="text-4xl font-bold text-red-600">{stats.failed}</p>
      </div>
    </div>
  );
}
