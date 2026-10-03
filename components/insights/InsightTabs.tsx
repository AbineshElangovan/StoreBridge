'use client';

import React from 'react';
import { PageTabs } from '@/components/ui/PageTabs';

export type InsightTabType = 'best-sellers' | 'slow-movers' | 'dead-stock' | 'store-comparison';

interface InsightTabsProps {
  activeTab: InsightTabType;
  onTabChange: (tab: InsightTabType) => void;
}

const TABS = [
  { id: 'best-sellers' as InsightTabType, label: 'Best Sellers' },
  { id: 'slow-movers' as InsightTabType, label: 'Slow Movers' },
  { id: 'dead-stock' as InsightTabType, label: 'Dead Stock' },
  { id: 'store-comparison' as InsightTabType, label: 'Store Comparison' },
];

export function InsightTabs({ activeTab, onTabChange }: InsightTabsProps) {
  return <PageTabs tabs={TABS} activeTab={activeTab} onTabChange={onTabChange} />;
}
