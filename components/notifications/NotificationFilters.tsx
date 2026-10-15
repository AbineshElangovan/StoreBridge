'use client';

import React from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Select,
  Box,
  Text,
} from '@shopify/polaris';
import { RefreshIcon, DeleteIcon, CheckIcon } from '@shopify/polaris-icons';

interface NotificationFiltersProps {
  typeFilter: string;
  onTypeChange: (type: string) => void;
  statusFilter: 'all' | 'unread' | 'read';
  onStatusChange: (status: 'all' | 'unread' | 'read') => void;
  storeFilter: string;
  onStoreChange: (storeId: string) => void;
  storeOptions: { label: string; value: string }[];
  onRefresh: () => void;
  isRefreshing?: boolean;
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
  onRefresh,
  isRefreshing = false,
  unreadCount,
  totalCount,
  onMarkAllRead,
  onOpenDeleteAllModal,
}: NotificationFiltersProps) {
  const typeOptions = [
    { label: 'All types', value: 'ALL' },
    { label: 'Low Stock', value: 'LOW_STOCK' },
    { label: 'Out of Stock', value: 'OUT_OF_STOCK' },
    { label: 'Inventory Updates', value: 'INVENTORY_UPDATE' },
    { label: 'Product Updates', value: 'PRODUCT_UPDATED' },
    { label: 'Connected Stores', value: 'CONNECTED_STORE_UPDATE' },
    { label: 'Price Updates', value: 'PRICE_UPDATE' },
    { label: 'Sync Success', value: 'SYNC_UPDATE' },
    { label: 'Sync Failures', value: 'SYNC_FAILURE' },
    { label: 'Import Completed', value: 'IMPORT_COMPLETED' },
  ];

  return (
    <Card>
      <BlockStack gap="300">
        {/* Main Controls Row: Left (Dropdowns), Center (Status Pills), Right (Refresh Button) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* 1. Left: Types & Stores Dropdowns */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Types Dropdown */}
            <div className="min-w-[160px]">
              <Select
                label=""
                labelHidden
                options={typeOptions}
                value={typeFilter}
                onChange={onTypeChange}
              />
            </div>

            {/* Stores Dropdown (Master Store) */}
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
          </div>

          {/* 2. Center: Status Segmented Buttons [All] [Unread] [Read] */}
          <div className="flex items-center justify-center sm:flex-1">
            <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  if (statusFilter !== 'all') onStatusChange('all');
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-[var(--color-primary-dark,#082f49)] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                {`All (${totalCount})`}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (statusFilter !== 'unread') onStatusChange('unread');
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  statusFilter === 'unread'
                    ? 'bg-[var(--color-primary-dark,#082f49)] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                {unreadCount > 0 ? `Unread (${unreadCount})` : 'Unread'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (statusFilter !== 'read') onStatusChange('read');
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  statusFilter === 'read'
                    ? 'bg-[var(--color-primary-dark,#082f49)] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                Read
              </button>
            </div>
          </div>

          {/* 3. Right: Refresh Button (Theme Dark) */}
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[var(--color-primary-dark,#082f49)] hover:opacity-90 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <div style={{ width: 14, height: 14 }} className={`flex items-center justify-center text-white fill-white [&_svg]:fill-white [&_path]:fill-white ${isRefreshing ? 'animate-spin' : ''}`}>
                <RefreshIcon />
              </div>
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[var(--color-primary-dark,#082f49)] hover:opacity-90 transition-colors shadow-2xs cursor-pointer"
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
