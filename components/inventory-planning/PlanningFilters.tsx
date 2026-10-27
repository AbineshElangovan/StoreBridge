'use client';

import React from 'react';
import { useStoreContext } from '@/components/providers/StoreProvider';
import { PolarisSelect } from '@/components/common';

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
  const { isStandalone, activeStores, isMasterSession, isMaster: isContextMaster, isMultiStore: isContextMultiStore } = useStoreContext();

  const isUserMultiStore = !isStandalone && ((stores && stores.length > 1) || isMasterSession || isContextMaster || isContextMultiStore || (activeStores && activeStores.length > 1));

  // Compute available stores: prefer passed-in stores if multiple, otherwise fallback to activeStores
  const displayStores = (stores && stores.length > 1)
    ? stores
    : (activeStores && activeStores.length > 1)
      ? [
          { id: 'all', label: 'All stores' },
          ...activeStores.map((s) => ({
            id: s.id,
            label: s.isMaster ? `${s.label || s.shopDomain} (Master)` : (s.label || s.shopDomain)
          }))
        ]
      : stores;

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-xl border border-[var(--border-color)] p-3 mb-6 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 transition-colors w-full min-w-0 max-w-full">
      {/* Left Filter Dropdowns */}
      <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0 w-full md:w-auto">
        {/* Store Selector (Only show if multiple stores or in multi-store master context) */}
        {isUserMultiStore && displayStores && displayStores.length > 1 && (
          <div className="w-full sm:w-auto min-w-[150px]">
            <PolarisSelect
              label="Store"
              labelHidden
              value={selectedStore}
              onChange={onStoreChange}
              options={displayStores.map((s) => ({ label: s.label, value: s.id }))}
            />
          </div>
        )}

        {/* Tab 2: Forecast Horizon Selector ONLY on Demand Forecast tab */}
        {activeTab === 'forecast' && (
          <div className="w-full sm:w-auto min-w-[170px]">
            <PolarisSelect
              label="Forecast Horizon"
              labelHidden
              value={selectedForecastDays || ''}
              onChange={(val) => onForecastDaysChange && onForecastDaysChange(val)}
              options={[
                { label: 'Forecast: Store Default', value: '' },
                { label: 'Forecast: 7 days', value: '7' },
                { label: 'Forecast: 14 days', value: '14' },
                { label: 'Forecast: 30 days (1 Mo)', value: '30' },
                { label: 'Forecast: 90 days (3 Mo)', value: '90' },
              ]}
            />
          </div>
        )}

        {/* Tab 3: Replenishment Horizon Selector ONLY on Replenishment tab */}
        {activeTab === 'replenishment' && (
          <div className="w-full sm:w-auto min-w-[170px]">
            <PolarisSelect
              label="Replenishment Horizon"
              labelHidden
              value={selectedReplenishDays || '7'}
              onChange={(val) => onReplenishDaysChange && onReplenishDaysChange(val)}
              options={[
                { label: 'Replenish: 7 Days', value: '7' },
                { label: 'Replenish: 15 Days', value: '15' },
                { label: 'Replenish: 30 Days (1 Month)', value: '30' },
                { label: 'Replenish: 90 Days (3 Months)', value: '90' },
                { label: 'Replenish: 180 Days (6 Months)', value: '180' },
                { label: 'Replenish: 365 Days (1 Year)', value: '365' },
              ]}
            />
          </div>
        )}

        {/* Collection Selector */}
        <div className="w-full sm:w-auto min-w-[160px]">
          <PolarisSelect
            label="Collection"
            labelHidden
            value={selectedCollection}
            onChange={onCollectionChange}
            options={collections.map((c) => {
              const isAll = c === 'All collections' || c === 'all';
              return {
                label: isAll ? 'All collections' : c,
                value: isAll ? 'all' : c,
              };
            })}
          />
        </div>
      </div>

      {/* Right Search Input */}
      <div className="relative w-full md:w-60 shrink-0 min-w-0">
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
