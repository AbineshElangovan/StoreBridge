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
    <div className="w-full max-w-full overflow-hidden">
      <div
        className={`rounded-xl border p-1.5 mb-6 flex items-center gap-1.5 shadow-2xs overflow-x-auto whitespace-nowrap scrollbar-none transition-colors backdrop-blur-md max-w-full touch-pan-x ${className}`}
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
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
              className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-150 cursor-pointer shrink-0 flex items-center gap-2 select-none ${
                isActive
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-text,#000000)] font-black shadow-xs'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-black/5 font-semibold'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span
                  className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                    isActive ? 'bg-black/15 text-[var(--color-primary-text,#000000)]' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
        {/* End spacing element so the last tab button is never clipped against the border */}
        <div className="w-2 shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
}
