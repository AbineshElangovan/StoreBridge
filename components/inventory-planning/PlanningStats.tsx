'use client';

import React from 'react';
import { PlanningStatCard } from './PlanningStatCard';

interface PlanningStatsProps {
  stats: {
    highRisk: number;
    mediumRisk: number;
    outOfStock: number;
    replenishmentNeeded: number;
    productsMonitored: number;
  };
}

export function PlanningStats({ stats }: PlanningStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 lg:gap-6 mb-8">
      <PlanningStatCard
        label="High Risk"
        value={stats.highRisk}
        subtext="Stockout within lead time"
        isAlert={stats.highRisk > 0}
      />
      <PlanningStatCard
        label="Medium Risk"
        value={stats.mediumRisk}
        subtext="Stockout within safety buffer"
      />
      <PlanningStatCard
        label="Replenishment Needed"
        value={stats.replenishmentNeeded}
        subtext="Products requiring order"
      />
      <PlanningStatCard
        label="Monitored Catalog"
        value={stats.productsMonitored.toLocaleString()}
        subtext="Total active products evaluated"
      />
    </div>
  );
}
