'use client';

import React from 'react';

export type InsightTabType = 'best-sellers' | 'slow-movers' | 'dead-stock' | 'store-comparison';

interface InsightTabsProps {
  activeTab: InsightTabType;
  onTabChange: (tab: InsightTabType) => void;
}

export function InsightTabs({ activeTab, onTabChange }: InsightTabsProps) {
  const tabs: { id: InsightTabType; label: string }[] = [
    { id: 'best-sellers', label: 'Best Sellers' },
    { id: 'slow-movers', label: 'Slow Movers' },
    { id: 'dead-stock', label: 'Dead Stock' },
    { id: 'store-comparison', label: 'Store Comparison' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-1.5 mb-6 flex items-center gap-1 shadow-2xs overflow-x-auto whitespace-nowrap scrollbar-none">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer shrink-0 ${
              isActive
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
