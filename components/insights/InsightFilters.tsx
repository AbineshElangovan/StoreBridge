'use client';

import React from 'react';

import { useStoreContext } from '@/components/providers/StoreProvider';
import { PolarisSelect } from '@/components/common';

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
    <div className={`grid grid-cols-1 ${showStoreSelector ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3 mb-6 w-full items-center`}>
      {/* Store Selector */}
      {showStoreSelector && (
        <PolarisSelect
          label="Store"
          labelHidden
          value={selectedStore}
          onChange={onStoreChange}
          options={stores.map((s) => ({ label: s.label, value: s.id }))}
        />
      )}

      {/* Date Range Selector */}
      <PolarisSelect
        label="Date Range"
        labelHidden
        value={selectedRange}
        onChange={onRangeChange}
        options={[
          { label: 'Last 7 days', value: '7' },
          { label: 'Last 30 days', value: '30' },
          { label: 'Last 90 days', value: '90' },
          { label: 'Last 1 year', value: '365' },
        ]}
      />

      {/* Collection Selector */}
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
  );
}
