'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { shopifyFetch } from '@/lib/shopify/Client';
import { useStoreContext } from '@/components/providers/StoreProvider';
import { InsightFilters } from '@/components/insights/InsightFilters';
import { InsightStats } from '@/components/insights/InsightStats';
import { InsightTabs, InsightTabType } from '@/components/insights/InsightTabs';
import { InsightTable } from '@/components/insights/InsightTable';

export default function InsightsPage() {
  const searchParams = useSearchParams();
  const shop = searchParams.get('shop');
  const { activeStores, isMasterSession, isMaster: isContextMaster, isMultiStore: isContextMultiStore } = useStoreContext();

  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [selectedRange, setSelectedRange] = useState<string>('30');
  const [selectedCollection, setSelectedCollection] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<InsightTabType>('best-sellers');
  const [page, setPage] = useState<number>(1);

  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState({
    unitsSold: 0,
    revenue: 0,
    slowMoversCount: 0,
    deadStockCount: 0
  });

  const [filters, setFilters] = useState<{
    stores: { id: string; label: string }[];
    collections: string[];
  }>({
    stores: [{ id: 'all', label: 'All stores' }],
    collections: ['All collections']
  });

  // Populate multi-store options as soon as StoreContext loads
  useEffect(() => {
    if ((isMasterSession || isContextMaster || isContextMultiStore) && activeStores && activeStores.length > 1) {
      setFilters(prev => {
        if (prev.stores.length <= 1) {
          return {
            ...prev,
            stores: [
              { id: 'all', label: 'All stores' },
              ...activeStores.map((s) => ({
                id: s.id,
                label: s.isMaster ? `${s.label || s.shopDomain} (Master)` : (s.label || s.shopDomain)
              }))
            ]
          };
        }
        return prev;
      });
    }
  }, [activeStores, isMasterSession, isContextMaster, isContextMultiStore]);

  const [data, setData] = useState<any[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalCount: 0,
    totalPages: 1
  });

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (shop) query.set('shop', shop);
      query.set('store', selectedStore);
      query.set('range', selectedRange);
      query.set('collection', selectedCollection);
      query.set('tab', activeTab);
      query.set('page', String(page));
      query.set('limit', '10');

      const res = await shopifyFetch(`/api/insights?${query.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setStats(json.stats || { unitsSold: 0, revenue: 0, slowMoversCount: 0, deadStockCount: 0 });
          if (json.filters) {
            setFilters(prev => ({
              stores: (json.filters.stores && json.filters.stores.length > 1)
                ? json.filters.stores
                : (prev.stores.length > 1 ? prev.stores : (json.filters.stores || prev.stores)),
              collections: json.filters.collections || prev.collections
            }));

            const availableStores = (json.filters.stores && json.filters.stores.length > 1)
              ? json.filters.stores
              : filters.stores;

            if (availableStores && availableStores.length > 0 && selectedStore !== 'all') {
              const exists = availableStores.some((s: any) => s.id === selectedStore);
              if (!exists) {
                setSelectedStore('all');
              }
            }
          }
          setData(json.data || []);
          if (json.pagination) setPagination(json.pagination);
        }
      }
    } catch (err) {
      console.error('[Insights Page] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [shop, selectedStore, selectedRange, selectedCollection, activeTab, page]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  // Reset to page 1 when changing filters or tabs
  const handleStoreChange = (val: string) => {
    setSelectedStore(val);
    setPage(1);
  };

  const handleRangeChange = (val: string) => {
    setSelectedRange(val);
    setPage(1);
  };

  const handleCollectionChange = (val: string) => {
    setSelectedCollection(val);
    setPage(1);
  };

  const handleTabChange = (tab: InsightTabType) => {
    setActiveTab(tab);
    setPage(1);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight m-0">
          Product Insights
        </h1>
        <p className="page-subtitle text-lg sm:text-xl font-medium text-slate-500 mt-1.5 m-0">
          What is selling, and where.
        </p>
      </div>

      {/* Reusable Filters */}
      <InsightFilters
        stores={filters.stores}
        collections={filters.collections}
        selectedStore={selectedStore}
        selectedRange={selectedRange}
        selectedCollection={selectedCollection}
        onStoreChange={handleStoreChange}
        onRangeChange={handleRangeChange}
        onCollectionChange={handleCollectionChange}
      />

      {/* Reusable Stats Cards */}
      <InsightStats
        stats={stats}
        rangeDays={parseInt(selectedRange, 10)}
        deadStockDays={(stats as any).deadStockDays}
      />

      {/* Reusable Tab Navigation */}
      <InsightTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {/* Reusable Insights Table */}
      <InsightTable
        activeTab={activeTab}
        data={data}
        loading={loading}
        page={page}
        totalPages={pagination.totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
