'use client';

import React from 'react';

export type PlanningTabId = 'stock-risk' | 'forecast' | 'replenishment';

interface PlanningTabsProps {
  activeTab: PlanningTabId;
  onTabChange: (tab: PlanningTabId) => void;
  replenishmentCount?: number;
}

export function PlanningTabs({ activeTab, onTabChange, replenishmentCount = 0 }: PlanningTabsProps) {
  const tabs: { id: PlanningTabId; label: string; badge?: number }[] = [
    { id: 'stock-risk', label: 'Stock Risk' },
    { id: 'forecast', label: 'Forecast' },
    { id: 'replenishment', label: 'Replenishment', badge: replenishmentCount }
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
            className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
              isActive
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <span>{tab.label}</span>
            {typeof tab.badge === 'number' && tab.badge > 0 && (
              <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
