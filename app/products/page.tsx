"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Table, ColumnConfig } from '@/components/common/Table';
import { Loading } from '@/components/common';
import { shopifyFetch } from '@/lib/shopify/Client';
import { DashboardCards } from '@/components/dashboard/DashboardCards';
import { LocalizedDate } from '@/components/common/LocalizedDate';
import { StoreRoleBadge } from '@/components/ui/StoreRoleBadge';
import { useStoreContext } from '@/components/providers/StoreProvider';

import Link from 'next/link';
import { getProductUrl } from '@/lib/utils/productUrl';

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const currentShop = searchParams.get('shop');
  const { isStandalone } = useStoreContext();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const groupedProducts = data?.groupedProducts || {};

  const allProducts = useMemo(() => {
    if (!groupedProducts) return [];
    const flatMap = new Map<string, any>();
    Object.values(groupedProducts).forEach((items: any) => {
      items.forEach((item: any) => {
        flatMap.set(item.id, item);
      });
    });
    return Array.from(flatMap.values());
  }, [groupedProducts]);

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        const url = currentShop
          ? `/api/products?shop=${encodeURIComponent(currentShop)}&t=${Date.now()}`
          : `/api/products?t=${Date.now()}`;
        const res = await shopifyFetch(url);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Error loading products:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, [currentShop]);

  if (loading) {
    return <Loading label="Loading products..." />;
  }

  const stats = data?.stats || { totalProducts: 0, activeProducts: 0, totalInventory: 0, lowStock: 0 };

  const filterProducts = (products: any[]) => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const titleMatch = p.title?.toLowerCase().includes(q);
        const skuMatch = p.sku?.toLowerCase().includes(q);
        if (!titleMatch && !skuMatch) return false;
      }
      return true;
    });
  };

  const columns: ColumnConfig[] = [
    { title: 'Image', key: 'imageUrls', type: 'image' },
    { title: 'Product Name', key: 'title_node', type: 'react_node' },
    { title: 'SKU', key: 'sku' },
    { title: 'Price', key: 'priceText', type: 'bold' },
    { title: 'Stock Qty', key: 'inventoryQuantity', type: 'bold' },
    {
      title: 'Stock Level',
      key: 'stockLevel_node',
      type: 'react_node',
    },
    {
      title: 'Status',
      key: 'status',
      type: 'badge',
      badgeRules: { Active: 'success', Inactive: 'critical' },
    },
    { title: 'Updated Date', key: 'updatedDate' },
  ];

  const mapProductToRow = (item: any) => {
    const prodUrl = getProductUrl(item);
    return {
      ...item,
      url: prodUrl,
      title_node: (
        <Link
          href={prodUrl}
          className="font-bold text-gray-900 hover:text-[#6366f1] hover:underline cursor-pointer transition-colors"
        >
          {item.title}
        </Link>
      ),
      stockLevel_node: (isStandalone && item.isPreorderAvailable) ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
          Pre-order
        </span>
      ) : (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
            item.stockLevel === 'Healthy'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : item.stockLevel === 'Low'
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          {item.stockLevel || '—'}
        </span>
      ),
      updatedDate: <LocalizedDate date={item.updatedDate || item.updatedAt} format="datetime" />
    };
  };

  if (loading) {
    return <Loading label="Loading products..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full overflow-x-hidden">
      <div className="flex flex-col gap-8 min-w-0 w-full">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-8">
          <div>
            <h1 className="page-title text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight m-0">
              Products & Collections
            </h1>
            <p className="page-subtitle text-lg sm:text-xl font-medium text-slate-500 mt-1.5 m-0">
              {isStandalone
                ? "Manage your products and collections effortlessly."
                : "Manage your store's products and collections effortlessly."}
            </p>
          </div>
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-4">
            {/* Overall Search Bar */}
            <div className="relative w-full md:w-80 shadow-sm rounded-lg">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search by title or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-8 min-w-0 w-full">
          <DashboardCards
            page="products"
            stats={{ ...stats, lastUpdated: 'Just now' }}
            lowStockThreshold={data?.lowStockThreshold ?? 15}
            isStandalone={isStandalone}
          />
          {searchQuery.trim() !== '' ? (
            <div className="w-full relative">
              <Table
                  key="search-results"
                  title="Search Results"
                  headerColor="#6366f1"
                  columns={columns}
                  items={filterProducts(allProducts).map(mapProductToRow)}
                  searchable={false}
                  filterable
                  itemsPerPage={10}
                  filterKey="stockLevel"
                  filterOptions={[
                    { label: 'All Stock Levels', value: 'ALL' },
                    { label: 'Healthy', value: 'Healthy' },
                    { label: 'Low', value: 'Low' },
                    { label: 'Critical', value: 'Critical' },
                    { label: 'Out of Stock', value: 'Out of Stock' },
                  ]}
                  emptyState={
                    <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                      No products found matching your filter criteria.
                    </div>
                  }
                />
            </div>
          ) : loading ? (
            <div className="w-full bg-white rounded-xl border border-gray-100 shadow-sm p-8">
              <Loading label="Loading products..." />
            </div>
          ) : Object.keys(groupedProducts).length > 0 ? (() => {
            const DISTINCT_TABLE_COLORS = [
              '#2563eb', // 1. Royal Blue (pure vibrant blue, distinct from purple)
              '#059669', // 2. Emerald Green
              '#d97706', // 3. Amber / Warm Gold
              '#9333ea', // 4. Royal Purple
              '#e11d48', // 5. Rose / Crimson
              '#0d9488', // 6. Teal / Ocean Cyan
              '#ea580c', // 7. Tangerine / Orange
              '#db2777', // 8. Pink / Magenta
              '#0284c7', // 9. Sky Blue
              '#16a34a', // 10. Forest Green
              '#65a30d', // 11. Lime Green
              '#dc2626', // 12. Ruby Red
              '#b45309', // 13. Warm Ochre / Bronze
              '#0f766e', // 14. Deep Pine
              '#c2410c', // 15. Rust Orange
              '#475569', // 16. Slate Steel
            ];

            const getTableColor = (name: string, idx: number): string => {
              if (name === 'Uncategorized') return '#64748b';
              if (idx < DISTINCT_TABLE_COLORS.length) {
                return DISTINCT_TABLE_COLORS[idx];
              }
              // Golden ratio distribution for any higher number of collections
              const hue = Math.round((idx * 137.508) % 360);
              return `hsl(${hue}, 75%, 45%)`;
            };

            return Object.entries(groupedProducts)
              .sort((a, b) => {
                if (a[0] === 'Uncategorized') return 1;
                if (b[0] === 'Uncategorized') return -1;
                return a[0].localeCompare(b[0]);
              })
              .map(([collectionName, items], index) => {
                const filteredItems = filterProducts(items as any[]);
                const tableColor = getTableColor(collectionName, index);
                return (
                  <div key={collectionName} className="w-full relative mb-6">
                    <Table
                      title={collectionName}
                      headerColor={tableColor}
                      columns={columns}
                      items={filteredItems.map(mapProductToRow)}
                      searchable={false}
                      filterable
                      itemsPerPage={10}
                      filterKey="stockLevel"
                      filterOptions={[
                        { label: 'All Stock Levels', value: 'ALL' },
                        { label: 'Healthy', value: 'Healthy' },
                        { label: 'Low', value: 'Low' },
                        { label: 'Critical', value: 'Critical' },
                        { label: 'Out of Stock', value: 'Out of Stock' },
                      ]}
                      emptyState={
                        <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                          No products found in this collection.
                        </div>
                      }
                    />
                  </div>
                );
              });
          })() : (
            <div style={{ backgroundColor: '#fff', padding: '60px', borderRadius: 12, border: '1px solid #e5e7eb', textAlign: 'center', color: '#6b7280' }}>
              No products or collections synced for this store yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
