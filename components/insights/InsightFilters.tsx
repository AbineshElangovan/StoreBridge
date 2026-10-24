'use client';

import React from 'react';

import { useStoreContext } from '@/components/providers/StoreProvider';

interface FilterStore {
  id: string;
  label: string;
}

interface InsightFiltersProps {
  stores: FilterStore[];
  collections: string[];
  selectedStore: string;
  selectedRange: string;
  selectedCollection: string;
  onStoreChange: (val: string) => void;
  onRangeChange: (val: string) => void;
  onCollectionChange: (val: string) => void;
}

export function InsightFilters({
  stores,
  collections,
  selectedStore,
  selectedRange,
  selectedCollection,
  onStoreChange,
  onRangeChange,
  onCollectionChange,
}: InsightFiltersProps) {
  const { isStandalone } = useStoreContext();
  const showStoreSelector = !isStandalone && stores && stores.length > 1;

  return (
    <div className={`grid grid-cols-1 ${showStoreSelector ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3 mb-6 w-full`}>
      {/* Store Selector */}
      {showStoreSelector && (
        <div className="relative w-full">
          <select
            value={selectedStore}
            onChange={(e) => onStoreChange(e.target.value)}
            className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 pr-9 text-xs sm:text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] cursor-pointer shadow-2xs transition-colors"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      )}

      {/* Date Range Selector */}
      <div className="relative w-full">
        <select
          value={selectedRange}
          onChange={(e) => onRangeChange(e.target.value)}
          className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 pr-9 text-xs sm:text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] cursor-pointer shadow-2xs transition-colors"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last 1 year</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Collection Selector */}
      <div className="relative w-full">
        <select
          value={selectedCollection}
          onChange={(e) => onCollectionChange(e.target.value)}
          className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 pr-9 text-xs sm:text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] cursor-pointer shadow-2xs transition-colors"
        >
          {collections.map((c) => {
            const isAll = c === 'All collections' || c === 'all';
            return (
              <option key={c} value={isAll ? 'all' : c}>
                {isAll ? 'All collections' : c}
              </option>
            );
          })}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
