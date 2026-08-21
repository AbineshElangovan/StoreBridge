'use client';

import React from 'react';

interface Option {
  id: string;
  label: string;
}

interface PlanningFiltersProps {
  activeTab: 'stock-risk' | 'forecast' | 'replenishment';
  stores: Option[];
  collections: string[];
  selectedStore: string;
  selectedCollection: string;
  selectedForecastDays: string;
  selectedReplenishDays: string;
  searchQuery: string;
  onStoreChange: (val: string) => void;
  onCollectionChange: (val: string) => void;
  onForecastDaysChange: (val: string) => void;
  onReplenishDaysChange: (val: string) => void;
  onSearchChange: (val: string) => void;
}

export function PlanningFilters({
  activeTab,
  stores,
  collections,
  selectedStore,
  selectedCollection,
  selectedForecastDays,
  selectedReplenishDays,
  searchQuery,
  onStoreChange,
  onCollectionChange,
  onForecastDaysChange,
  onReplenishDaysChange,
  onSearchChange
}: PlanningFiltersProps) {
  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-4 w-full">
      {/* Left Filter Group */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
        {/* Store Selector */}
        {stores.length > 1 && (
          <div className="relative w-full sm:w-auto">
            <select
              value={selectedStore}
              onChange={(e) => onStoreChange(e.target.value)}
              className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0db69d]/20 focus:border-[#0db69d] cursor-pointer shadow-2xs transition-colors"
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
              className="w-full appearance-none bg-white border border-[#0db69d]/40 bg-teal-50/30 rounded-lg px-3 py-2 pr-8 text-xs font-bold text-teal-900 hover:border-[#0db69d] focus:outline-none focus:ring-2 focus:ring-[#0db69d]/20 focus:border-[#0db69d] cursor-pointer shadow-2xs transition-colors"
            >
              <option value="">Forecast: Store Default</option>
              <option value="7">Forecast: 7 days</option>
              <option value="14">Forecast: 14 days</option>
              <option value="30">Forecast: 30 days (1 Mo)</option>
              <option value="90">Forecast: 90 days (3 Mo)</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#0db69d]">
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
              className="w-full appearance-none bg-white border border-emerald-300 bg-emerald-50/40 rounded-lg px-3 py-2 pr-8 text-xs font-bold text-emerald-900 hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer shadow-2xs transition-colors"
            >
              <option value="7">Replenish: 7 Days</option>
              <option value="15">Replenish: 15 Days</option>
              <option value="30">Replenish: 30 Days (1 Month)</option>
              <option value="90">Replenish: 90 Days (3 Months)</option>
              <option value="180">Replenish: 180 Days (6 Months)</option>
              <option value="365">Replenish: 365 Days (1 Year)</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-emerald-600">
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
            className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0db69d]/20 focus:border-[#0db69d] cursor-pointer shadow-2xs transition-colors"
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
          className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-xs font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0db69d]/20 focus:border-[#0db69d] shadow-2xs transition-colors"
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
