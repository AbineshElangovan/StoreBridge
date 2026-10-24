'use client';

import React from 'react';
import { PageTabs } from '@/components/ui/PageTabs';
import { useStoreContext } from '@/components/providers/StoreProvider';

export type InsightTabType = 'best-sellers' | 'slow-movers' | 'dead-stock' | 'store-comparison';

interface InsightTabsProps {
  activeTab: InsightTabType;
  onTabChange: (tab: InsightTabType) => void;
}

export function InsightTabs({ activeTab, onTabChange }: InsightTabsProps) {
  const { isStandalone } = useStoreContext();

  const tabs = [
    { id: 'best-sellers' as InsightTabType, label: 'Best Sellers' },
    { id: 'slow-movers' as InsightTabType, label: 'Slow Movers' },
    { id: 'dead-stock' as InsightTabType, label: 'Dead Stock' },
    ...(!isStandalone ? [{ id: 'store-comparison' as InsightTabType, label: 'Store Comparison' }] : []),
  ];

  return <PageTabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />;
}
