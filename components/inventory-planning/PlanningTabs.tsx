'use client';

import React from 'react';
import { PageTabs } from '@/components/ui/PageTabs';

export type PlanningTabId = 'stock-risk' | 'forecast' | 'replenishment';

interface PlanningTabsProps {
  activeTab: PlanningTabId;
  onTabChange: (tab: PlanningTabId) => void;
  replenishmentCount?: number;
}

export function PlanningTabs({ activeTab, onTabChange, replenishmentCount = 0 }: PlanningTabsProps) {
  const tabs = [
    { id: 'stock-risk' as PlanningTabId, label: 'Stock Risk' },
    { id: 'forecast' as PlanningTabId, label: 'Forecast' },
    { id: 'replenishment' as PlanningTabId, label: 'Replenishment' },
  ];

  return <PageTabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />;
}
