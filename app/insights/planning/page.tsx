'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { shopifyFetch } from '@/lib/shopify/Client';
import { PlanningFilters } from '@/components/inventory-planning/PlanningFilters';
import { PlanningStats } from '@/components/inventory-planning/PlanningStats';
import { PlanningTabs, PlanningTabId } from '@/components/inventory-planning/PlanningTabs';
import { StockRiskTable } from '@/components/inventory-planning/StockRiskTable';
import { ForecastTable } from '@/components/inventory-planning/ForecastTable';
import { ReplenishmentTable } from '@/components/inventory-planning/ReplenishmentTable';
import { PlanningPagination } from '@/components/inventory-planning/PlanningPagination';

export default function InventoryPlanningPage() {
  const searchParams = useSearchParams();
  const shop = searchParams.get('shop');

  const [loading, setLoading] = useState<boolean>(true);
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [selectedCollection, setSelectedCollection] = useState<string>('All collections');
  const [selectedForecastDays, setSelectedForecastDays] = useState<string>('');
  const [selectedReplenishDays, setSelectedReplenishDays] = useState<string>('7');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<PlanningTabId>('stock-risk');
  const [page, setPage] = useState<number>(1);

  const [stats, setStats] = useState({
    highRisk: 0,
    mediumRisk: 0,
    outOfStock: 0,
    replenishmentNeeded: 0,
    productsMonitored: 0
  });

  const [filters, setFilters] = useState<{
    stores: { id: string; label: string }[];
    collections: string[];
  }>({
    stores: [{ id: 'all', label: 'All stores' }],
    collections: ['All collections']
  });

  const [data, setData] = useState<any[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    totalCount: 0,
    totalPages: 1
  });

  const fetchPlanningData = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (shop) query.set('shop', shop);
      query.set('store', selectedStore);
      query.set('collection', selectedCollection);
      if (selectedForecastDays) query.set('forecastDays', selectedForecastDays);
      if (selectedReplenishDays) query.set('replenishDays', selectedReplenishDays);
      if (searchQuery) query.set('product', searchQuery);
      query.set('tab', activeTab);
      query.set('page', String(page));
      query.set('limit', '15');

      const res = await shopifyFetch(`/api/inventory-planning?${query.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setStats(json.stats || {
            highRisk: 0,
            mediumRisk: 0,
            outOfStock: 0,
            replenishmentNeeded: 0,
            productsMonitored: 0
          });

          if (json.filters) {
            setFilters(json.filters);
            if (json.filters.stores && json.filters.stores.length > 0) {
              const exists = json.filters.stores.some((s: any) => s.id === selectedStore);
              if (!exists && selectedStore !== 'all') {
                setSelectedStore(json.filters.stores[0].id);
              }
            }
          }

          setData(json.data || []);
          if (json.pagination) {
            setPagination(json.pagination);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching inventory planning data:', err);
    } finally {
      setLoading(false);
    }
  }, [shop, selectedStore, selectedCollection, selectedForecastDays, selectedReplenishDays, searchQuery, activeTab, page]);

  useEffect(() => {
    fetchPlanningData();
  }, [fetchPlanningData]);

  const handleStoreChange = (storeId: string) => {
    setSelectedStore(storeId);
    setPage(1);
  };

  const handleCollectionChange = (coll: string) => {
    setSelectedCollection(coll);
    setPage(1);
  };

  const handleForecastDaysChange = (fcDays: string) => {
    setSelectedForecastDays(fcDays);
    setPage(1);
  };

  const handleReplenishDaysChange = (rpDays: string) => {
    setSelectedReplenishDays(rpDays);
    setPage(1);
  };

  const handleSearchChange = (queryStr: string) => {
    setSearchQuery(queryStr);
    setPage(1);
  };

  const handleTabChange = (tab: PlanningTabId) => {
    setActiveTab(tab);
    setPage(1);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          Inventory Planning
        </h1>
        <p className="text-sm font-medium text-gray-500 mt-1">
          What is likely to happen next, and what you should prepare for.
        </p>
      </div>

      {/* Reusable Stats Cards */}
      <PlanningStats stats={stats} />

      {/* Reusable Tab Navigation */}
      <PlanningTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        replenishmentCount={stats.replenishmentNeeded}
      />

      {/* Reusable Filters directly under Nav Bar */}
      <PlanningFilters
        activeTab={activeTab}
        stores={filters.stores}
        collections={filters.collections}
        selectedStore={selectedStore}
        selectedCollection={selectedCollection}
        selectedForecastDays={selectedForecastDays}
        selectedReplenishDays={selectedReplenishDays}
        searchQuery={searchQuery}
        onStoreChange={handleStoreChange}
        onCollectionChange={handleCollectionChange}
        onForecastDaysChange={handleForecastDaysChange}
        onReplenishDaysChange={handleReplenishDaysChange}
        onSearchChange={handleSearchChange}
      />

      {/* Tab Views */}
      {activeTab === 'stock-risk' && (
        <StockRiskTable
          products={data}
          loading={loading}
          page={page}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
        />
      )}

      {activeTab === 'forecast' && (
        <ForecastTable
          products={data}
          loading={loading}
          page={page}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
        />
      )}

      {activeTab === 'replenishment' && (
        <ReplenishmentTable
          products={data}
          loading={loading}
          page={page}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
