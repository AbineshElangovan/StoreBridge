'use client';

import React from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  ButtonGroup,
  Button,
  TextField,
  Select,
  Box,
  Text,
} from '@shopify/polaris';
import { SearchIcon, DeleteIcon, CheckIcon } from '@shopify/polaris-icons';

interface NotificationFiltersProps {
  typeFilter: string;
  onTypeChange: (type: string) => void;
  statusFilter: 'all' | 'unread' | 'read';
  onStatusChange: (status: 'all' | 'unread' | 'read') => void;
  storeFilter: string;
  onStoreChange: (storeId: string) => void;
  storeOptions: { label: string; value: string }[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  unreadCount: number;
  totalCount: number;
  onMarkAllRead: () => void;
  onOpenDeleteAllModal: () => void;
}

export function NotificationFilters({
  typeFilter,
  onTypeChange,
  statusFilter,
  onStatusChange,
  storeFilter,
  onStoreChange,
  storeOptions,
  searchQuery,
  onSearchChange,
  unreadCount,
  totalCount,
  onMarkAllRead,
  onOpenDeleteAllModal,
}: NotificationFiltersProps) {
  const typeOptions = [
    { label: 'All types', value: 'ALL' },
    { label: 'Product Updates', value: 'PRODUCT_UPDATED' },
    { label: 'Low Stock', value: 'LOW_STOCK' },
    { label: 'Out of Stock', value: 'OUT_OF_STOCK' },
    { label: 'Inventory Updates', value: 'INVENTORY_UPDATE' },
    { label: 'Price Updates', value: 'PRICE_UPDATE' },
    { label: 'Connected Stores', value: 'CONNECTED_STORE_UPDATE' },
    { label: 'Sync Success', value: 'SYNC_UPDATE' },
    { label: 'Sync Failures', value: 'SYNC_FAILURE' },
  ];

  return (
    <Card>
      <BlockStack gap="300">
        {/* Main Controls Row: Types Dropdown, Store Dropdown, Status Buttons, & Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Dropdowns & Status Segmented Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1. Types Dropdown */}
            <div className="min-w-[160px]">
              <Select
                label=""
                labelHidden
                options={typeOptions}
                value={typeFilter}
                onChange={onTypeChange}
              />
            </div>

            {/* 2. Stores Dropdown */}
            {storeOptions.length > 1 && (
              <div className="min-w-[160px]">
                <Select
                  label=""
                  labelHidden
                  options={storeOptions}
                  value={storeFilter}
                  onChange={onStoreChange}
                />
              </div>
            )}

            {/* 3. Status Segmented Buttons: [All] [Unread] [Read] */}
            <div className="inline-flex rounded-lg p-0.5 bg-gray-100 border border-gray-200">
              <button
                type="button"
                onClick={() => onStatusChange('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  statusFilter === 'all'
                    ? 'bg-[#0db69d] text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {`All (${totalCount})`}
              </button>
              <button
                type="button"
                onClick={() => onStatusChange('unread')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  statusFilter === 'unread'
                    ? 'bg-[#0db69d] text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {unreadCount > 0 ? `Unread (${unreadCount})` : 'Unread'}
              </button>
              <button
                type="button"
                onClick={() => onStatusChange('read')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  statusFilter === 'read'
                    ? 'bg-[#0db69d] text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Read
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="w-full lg:w-72">
            <TextField
              label="Search notifications"
              labelHidden
              value={searchQuery}
              onChange={onSearchChange}
              prefix={<SearchIcon />}
              placeholder="Search notifications..."
              autoComplete="off"
              clearButton
              onClearButtonClick={() => onSearchChange('')}
            />
          </div>
        </div>

        {/* Bottom Actions Row: Results summary, Mark all read & Delete all */}
        <Box paddingBlockStart="200" borderBlockStartWidth="025" borderColor="border-secondary">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="bodyXs" tone="subdued" as="span">
              {`${totalCount} results • ${unreadCount} unread`}
            </Text>

            <InlineStack gap="200" blockAlign="center">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#0db69d] hover:bg-[#0b9c86] transition-colors shadow-2xs cursor-pointer"
                >
                  <div style={{ width: 14, height: 14 }}>
                    <CheckIcon />
                  </div>
                  Mark all as read
                </button>
              )}

              {totalCount > 0 && (
                <button
                  type="button"
                  onClick={onOpenDeleteAllModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors shadow-2xs cursor-pointer border border-red-100"
                >
                  <div style={{ width: 14, height: 14 }} className="[&_svg]:fill-red-600 [&_svg]:text-red-600 text-red-600 flex items-center justify-center">
                    <DeleteIcon />
                  </div>
                  <span>Delete all</span>
                </button>
              )}
            </InlineStack>
          </InlineStack>
        </Box>
      </BlockStack>
    </Card>
  );
}
