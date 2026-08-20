'use client';

import React from 'react';
import { InsightStatCard } from './InsightStatCard';

interface InsightStatsProps {
  stats?: {
    unitsSold: number;
    revenue: number;
    slowMoversCount: number;
    deadStockCount: number;
  };
  rangeDays: number;
  deadStockDays?: number;
}

export function InsightStats({ stats, rangeDays, deadStockDays }: InsightStatsProps) {
  const safeStats = stats || { unitsSold: 0, revenue: 0, slowMoversCount: 0, deadStockCount: 0 };
  const formattedRevenue = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(safeStats.revenue || 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 lg:gap-6 mb-8">
      <InsightStatCard
        label="Units sold"
        value={(safeStats.unitsSold || 0).toLocaleString()}
        subtext={`Last ${rangeDays} days`}
      />
      <InsightStatCard
        label="Revenue"
        value={formattedRevenue}
        subtext="Across selected scope"
      />
      <InsightStatCard
        label="Slow movers"
        value={safeStats.slowMoversCount || 0}
        subtext="At or below threshold"
      />
      <InsightStatCard
        label="Dead stock"
        value={safeStats.deadStockCount || 0}
        subtext={deadStockDays ? `No sale for ${deadStockDays}+ days` : 'No recent sales'}
        isAlert={(safeStats.deadStockCount || 0) > 0}
      />
    </div>
  );
}
