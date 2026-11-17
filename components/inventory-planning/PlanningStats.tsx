'use client';

import React from 'react';
import { PlanningStatCard } from './PlanningStatCard';

interface PlanningStatsProps {
  stats: {
    highRisk: number;
    lowRisk: number;
    outOfStock?: number;
    replenishmentNeeded: number;
    productsMonitored: number;
    highRiskThresholdDays?: number;
  };
}

export function PlanningStats({ stats }: PlanningStatsProps) {
  const thresholdDays = stats.highRiskThresholdDays || 10;
  const outOfStock = stats.outOfStock || 0;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5 mb-8">
      <PlanningStatCard
        label="Out of Stock"
        value={outOfStock}
        subtext="Immediate restock needed"
        isAlert={outOfStock > 0}
      />
      <PlanningStatCard
        label="High Risk"
        value={stats.highRisk}
        subtext={`Stockout within ${thresholdDays} days`}
        isAlert={stats.highRisk > 0}
      />
      <PlanningStatCard
        label="Low Risk"
        value={stats.lowRisk}
        subtext="Adequate stock coverage"
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
