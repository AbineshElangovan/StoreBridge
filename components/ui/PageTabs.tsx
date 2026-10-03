'use client';

import React from 'react';

export interface PageTab<T extends string = string> {
  id: T;
  label: string;
  badge?: number;
}

interface PageTabsProps<T extends string = string> {
  tabs: PageTab<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  className?: string;
}

export function PageTabs<T extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  className = '',
}: PageTabsProps<T>) {
  return (
    <div
      className={`rounded-xl border p-1.5 mb-6 flex items-center gap-1.5 shadow-2xs overflow-x-auto whitespace-nowrap scrollbar-none transition-colors backdrop-blur-md ${className}`}
      style={{
        backgroundColor: 'var(--theme-navbar-bg, rgba(255,255,255,0.85))',
        borderColor: 'var(--theme-navbar-border, var(--border-color))',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-150 cursor-pointer shrink-0 flex items-center gap-2 ${
              isActive
                ? 'bg-[var(--color-primary)] text-white shadow-xs'
                : 'text-gray-700 hover:text-gray-900 hover:bg-black/5 font-semibold'
            }`}
          >
            <span>{tab.label}</span>
            {typeof tab.badge === 'number' && tab.badge > 0 && (
              <span
                className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                  isActive ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
