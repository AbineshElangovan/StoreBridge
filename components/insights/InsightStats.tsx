'use client';

import React from 'react';
import { InsightStatCard } from './InsightStatCard';

interface InsightStatsProps {
  stats: {
    unitsSold: number;
    revenue: number;
    slowMoversCount: number;
    deadStockCount: number;
  };
  rangeDays: number;
}

export function InsightStats({ stats, rangeDays }: InsightStatsProps) {
  const formattedRevenue = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(stats.revenue);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 lg:gap-6 mb-8">
      <InsightStatCard
        label="Units sold"
        value={stats.unitsSold.toLocaleString()}
        subtext={`Last ${rangeDays} days`}
      />
      <InsightStatCard
        label="Revenue"
        value={formattedRevenue}
        subtext="Across selected scope"
      />
      <InsightStatCard
        label="Slow movers"
        value={stats.slowMoversCount}
        subtext="Under 20 units sold"
      />
      <InsightStatCard
        label="Dead stock"
        value={stats.deadStockCount}
        subtext={`No sale in ${rangeDays}+ days`}
        isAlert={stats.deadStockCount > 0}
      />
    </div>
  );
}
