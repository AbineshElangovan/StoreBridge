'use client';

import React from 'react';

interface PlanningFiltersProps {
  stores: { id: string; label: string }[];
  selectedStore: string;
  onStoreChange: (storeId: string) => void;
  collections: string[];
  selectedCollection: string;
  onCollectionChange: (collection: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  // Dynamic Horizon Selectors
  activeTab?: 'stock-risk' | 'forecast' | 'replenishment';
  selectedForecastDays?: string;
  onForecastDaysChange?: (days: string) => void;
  selectedReplenishDays?: string;
  onReplenishDaysChange?: (days: string) => void;
}

export function PlanningFilters({
  stores,
  selectedStore,
  onStoreChange,
  collections,
  selectedCollection,
  onCollectionChange,
  searchQuery,
  onSearchChange,
  activeTab = 'stock-risk',
  selectedForecastDays = '',
  onForecastDaysChange = () => {},
  selectedReplenishDays = '30',
  onReplenishDaysChange = () => {},
}: PlanningFiltersProps) {
  const isMultiStore = stores && stores.length > 1;

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[var(--border-color)] p-3 mb-6 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 transition-colors">
      {/* Left Filter Dropdowns */}
      <div className="flex flex-wrap items-center gap-2.5 flex-1">
        {/* Store Selector (Only show if multiple stores) */}
        {isMultiStore && (
          <div className="relative w-full sm:w-auto">
            <select
              value={selectedStore}
              onChange={(e) => onStoreChange(e.target.value)}
              className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] cursor-pointer shadow-2xs transition-colors"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )}

        {/* Tab 2: Forecast Horizon Selector ONLY on Demand Forecast tab */}
        {activeTab === 'forecast' && (
          <div className="relative w-full sm:w-auto">
            <select
              value={selectedForecastDays}
              onChange={(e) => onForecastDaysChange(e.target.value)}
              className="w-full appearance-none bg-white border border-[var(--theme-border-accent)] bg-[var(--color-primary-light)]/40 rounded-lg px-3 py-2 pr-8 text-xs font-bold text-[var(--color-primary-dark)] hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] cursor-pointer shadow-2xs transition-colors"
            >
              <option value="">Forecast: Store Default</option>
              <option value="7">Forecast: 7 days</option>
              <option value="14">Forecast: 14 days</option>
              <option value="30">Forecast: 30 days (1 Mo)</option>
              <option value="90">Forecast: 90 days (3 Mo)</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--color-primary)]">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )}

        {/* Tab 3: Replenishment Horizon Selector ONLY on Replenishment tab */}
        {activeTab === 'replenishment' && (
          <div className="relative w-full sm:w-auto">
            <select
              value={selectedReplenishDays}
              onChange={(e) => onReplenishDaysChange(e.target.value)}
              className="w-full appearance-none bg-white border border-[var(--theme-border-accent)] bg-[var(--color-primary-light)]/40 rounded-lg px-3 py-2 pr-8 text-xs font-bold text-[var(--color-primary-dark)] hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] cursor-pointer shadow-2xs transition-colors"
            >
              <option value="7">Replenish: 7 Days</option>
              <option value="15">Replenish: 15 Days</option>
              <option value="30">Replenish: 30 Days (1 Month)</option>
              <option value="90">Replenish: 90 Days (3 Months)</option>
              <option value="180">Replenish: 180 Days (6 Months)</option>
              <option value="365">Replenish: 365 Days (1 Year)</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--color-primary)]">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )}

        {/* Collection Selector */}
        <div className="relative w-full sm:w-auto">
          <select
            value={selectedCollection}
            onChange={(e) => onCollectionChange(e.target.value)}
            className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] cursor-pointer shadow-2xs transition-colors"
          >
            {collections.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Right Search Input */}
      <div className="relative w-full md:w-60 shrink-0">
        <input
          type="text"
          placeholder="Search product or SKU..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-xs font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] shadow-2xs transition-colors"
        />
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-gray-400">
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    </div>
  );
}
