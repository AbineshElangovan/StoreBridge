'use client';

import React from 'react';
import { useStoreContext } from '@/components/providers/StoreProvider';
import { PolarisSelect, SearchBar } from '@/components/common';
import { Icon } from '@shopify/polaris';
import { SearchIcon } from '@shopify/polaris-icons';

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
  searchQuery?: string;
  onStoreChange: (val: string) => void;
  onRangeChange: (val: string) => void;
  onCollectionChange: (val: string) => void;
  onSearchChange?: (val: string) => void;
}

export function InsightFilters({
  stores,
  collections,
  selectedStore,
  selectedRange,
  selectedCollection,
  searchQuery = '',
  onStoreChange,
  onRangeChange,
  onCollectionChange,
  onSearchChange,
}: InsightFiltersProps) {
  const { isStandalone } = useStoreContext();
  const showStoreSelector = !isStandalone && stores && stores.length > 1;
  const hasSearch = Boolean(onSearchChange);

  const totalCols = (showStoreSelector ? 1 : 0) + 2 + (hasSearch ? 1 : 0);
  const gridColsClass =
    totalCols === 4
      ? 'sm:grid-cols-2 lg:grid-cols-4'
      : totalCols === 3
      ? 'sm:grid-cols-3'
      : showStoreSelector
      ? 'sm:grid-cols-3'
      : 'sm:grid-cols-2';

  return (
    <div className={`grid grid-cols-1 ${gridColsClass} gap-3 mb-6 w-full min-w-0 max-w-full items-center`}>
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

      {/* Reusable Search Bar */}
      {onSearchChange && (
        <div className="w-full">
          <SearchBar
            label="Search"
            labelHidden
            placeholder="Search product or SKU..."
            value={searchQuery}
            onChange={onSearchChange}
            autoComplete="off"
            clearButton
            onClearButtonClick={() => onSearchChange('')}
            prefix={<Icon source={SearchIcon} tone="base" />}
          />
        </div>
      )}
    </div>
  );
}
