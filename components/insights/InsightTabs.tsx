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
    <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[var(--border-color)] p-1.5 mb-6 flex items-center gap-1.5 shadow-2xs overflow-x-auto whitespace-nowrap scrollbar-none transition-colors">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-150 cursor-pointer shrink-0 ${
              isActive
                ? 'bg-[var(--color-primary)] text-white shadow-xs'
                : 'text-gray-700 hover:text-gray-900 hover:bg-black/5 font-semibold'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
