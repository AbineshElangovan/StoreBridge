"use client";

import { PageHeader } from '@/components/ui/PageHeader';
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
import { PreorderBadge } from '@/components/preorder/PreorderBadge';
import { WishlistHeartButton } from '@/components/wishlist/WishlistHeartButton';
import { useTheme } from '@/components/providers/ThemeContext';

const DISTINCT_TABLE_COLORS = [
  '#2563eb', // 1. Royal Blue
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
  const hue = Math.round((idx * 137.508) % 360);
  return `hsl(${hue}, 75%, 45%)`;
};

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const currentShop = searchParams.get('shop');
  const { isStandalone } = useStoreContext();
  const { currentTheme } = useTheme();
  const primaryColor = currentTheme?.primaryColor || '#6366f1';
  const buttonTextColor = currentTheme?.id === 'emerald_forest' ? '#142403' : '#ffffff';
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
          setError(null);
        } else {
          const errData = await res.json().catch(() => ({}));
          const msg = errData.message || errData.error || `Request failed with status ${res.status}`;
          setError(msg);
        }
      } catch (err) {
        console.error("Error loading products:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, [currentShop]);

  useEffect(() => {
    const handleWishlistUpdate = (e: any) => {
      const isWishlisted = Boolean(e?.detail?.wishlisted);
      setData((prev: any) => {
        if (!prev?.stats) return prev;
        const currentCount = prev.stats.wishlistCount ?? 0;
        return {
          ...prev,
          stats: {
            ...prev.stats,
            wishlistCount: Math.max(0, currentCount + (isWishlisted ? 1 : -1)),
          },
        };
      });
    };

    window.addEventListener('wishlist-updated', handleWishlistUpdate);
    return () => {
      window.removeEventListener('wishlist-updated', handleWishlistUpdate);
    };
  }, []);

  if (loading) {
    return <Loading label="Loading products..." />;
  }

  const stats = data?.stats || {
    totalProducts: 0,
    activeProducts: 0,
    totalInventory: 0,
    lowStock: 0,
    preorderActive: 0,
    wishlistCount: 0,
  };

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
    ...(isStandalone
      ? [
        {
          title: 'Wishlist',
          key: 'wishlist_node',
          type: 'react_node' as const,
        },
      ]
      : []),
    { title: 'Updated Date', key: 'updatedDate' },
  ];

  const mapProductToRow = (item: any) => {
    const prodUrl = getProductUrl(item);
    const resolvedSku = (item.sku && item.sku !== 'N/A')
      ? item.sku
      : (item.id ? `STB-SKU-${item.id.replace(/[^0-9]/g, '').slice(-4).padStart(4, '0')}` : 'STB-SKU-0001');

    return {
      ...item,
      sku: resolvedSku,
      url: prodUrl,
      title_node: (
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={prodUrl}
            className="font-bold text-gray-900 hover:text-[#6366f1] hover:underline cursor-pointer transition-colors"
          >
            {item.title}
          </Link>
          {(isStandalone && item.isPreorderAvailable) && (
            <PreorderBadge size="sm" />
          )}
        </div>
      ),
      stockLevel_node: (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${item.stockLevel === 'Healthy'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : item.stockLevel === 'Low'
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
        >
          {item.stockLevel || '—'}
        </span>
      ),
      wishlist_node: isStandalone ? (
        <WishlistHeartButton
          productId={item.shopifyProductId || item.id}
          productTitle={item.title}
          sku={resolvedSku}
          price={parseFloat(String(item.price).replace(/[^0-9.]/g, '')) || 0}
          imageUrl={Array.isArray(item.imageUrls) ? item.imageUrls[0] : (item.imageUrl || null)}
          inventoryQuantity={Number(item.inventoryQuantity) || 0}
        />
      ) : null,
      updatedDate: <LocalizedDate date={item.updatedDate || item.updatedAt} format="datetime" />
    };
  };

  const renderProductCard = (item: any) => {
    const prodUrl = getProductUrl(item);
    const resolvedSku = (item.sku && item.sku !== 'N/A')
      ? item.sku
      : (item.id ? `STB-SKU-${item.id.replace(/[^0-9]/g, '').slice(-4).padStart(4, '0')}` : 'STB-SKU-0001');
    const imgUrl = Array.isArray(item.imageUrls) && item.imageUrls.length > 0
      ? item.imageUrls[0]
      : (item.imageUrl || null);
    const qty = Number(item.inventoryQuantity) || 0;
    const isAvail = qty > 0;
    const numericPrice = parseFloat(String(item.price).replace(/[^0-9.]/g, '')) || 0;

    return (
      <div
        key={item.id}
        className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
      >
        <div className="p-4">
          {/* Image & Badges */}
          <div className="relative aspect-square w-full rounded-xl bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center mb-3">
            <Link
              href={prodUrl}
              className="w-full h-full flex items-center justify-center cursor-pointer group/img"
              title={`View ${item.title}`}
            >
              {imgUrl ? (
                <img
                  src={imgUrl}
                  alt={item.title}
                  className="w-full h-full object-contain p-2 group-hover/img:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400">
                  <svg className="w-12 h-12 stroke-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </Link>

            {/* Stock Badge Overlay */}
            <div className="absolute top-2.5 left-2.5 pointer-events-none">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${isAvail
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
                    : 'bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs'
                  }`}
              >
                {isAvail ? `${qty} In Stock` : 'Out of Stock'}
              </span>
            </div>

            {/* Wishlist Button (Single-store standalone only) */}
            {isStandalone && (
              <div className="absolute top-2.5 right-2.5 z-10">
                <WishlistHeartButton
                  productId={item.shopifyProductId || item.id}
                  productTitle={item.title}
                  sku={resolvedSku}
                  price={numericPrice}
                  imageUrl={imgUrl}
                  inventoryQuantity={qty}
                />
              </div>
            )}
          </div>

          {/* Product Title & Badges */}
          <div className="mb-2">
            <Link
              href={prodUrl}
              className="font-bold text-gray-900 text-sm hover:underline line-clamp-2 block group-hover:text-indigo-600 transition-colors"
              title={item.title}
            >
              {item.title}
            </Link>
            {(isStandalone && item.isPreorderAvailable) && (
              <div className="mt-1">
                <PreorderBadge size="sm" />
              </div>
            )}
          </div>

          {/* Price & SKU */}
          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-100">
            <span className="text-base font-extrabold text-gray-900">
              ₹{Number(numericPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {resolvedSku && (
              <span className="text-xs font-mono text-gray-600 truncate max-w-[140px]" title={resolvedSku}>
                {resolvedSku}
              </span>
            )}
          </div>

          {/* Stock Level & Status */}
          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-50">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${item.stockLevel === 'Healthy'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : item.stockLevel === 'Low'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
            >
              {item.stockLevel || (isAvail ? 'Healthy' : 'Out of Stock')}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${String(item.status).toLowerCase() === 'active'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-gray-100 text-gray-700 border border-gray-200'
                }`}
            >
              {item.status || 'Active'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <Loading label="Loading products..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full overflow-x-hidden">
      <div className="flex flex-col gap-8 min-w-0 w-full">
        <PageHeader
          title="Products & Collections"
          subtitle={
            isStandalone
              ? "Manage your products and collections effortlessly."
              : "Manage your store's products and collections effortlessly."
          }
        />
        <div className="flex flex-col gap-8 min-w-0 w-full">
          {error && (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/90 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div>
                <h4 className="font-bold text-sm flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Store Authentication Required
                </h4>
                <p className="text-xs text-amber-800 mt-1">
                  {error} — Please open this application inside your Shopify Admin or click to authenticate.
                </p>
              </div>
              <a
                href={currentShop ? `/api/auth?shop=${encodeURIComponent(currentShop)}` : '/'}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 transition-colors shadow-xs"
              >
                Authenticate Store
              </a>
            </div>
          )}
          <DashboardCards
            page="products"
            stats={{ ...stats, lastUpdated: 'Just now' }}
            lowStockThreshold={data?.lowStockThreshold ?? 15}
            isStandalone={isStandalone}
          />

          {/* Controls Toolbar: Search & View Mode Toggle (Placed right before the table or cards) */}
          <div className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-2xs">
            <div className="relative w-full sm:w-80 shadow-2xs rounded-xl">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search by title or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors shadow-2xs"
              />
            </div>

            {/* Segmented Card/Table View Mode Toggle */}
            <div className="inline-flex items-center p-1 bg-gray-100 rounded-xl border border-gray-200 self-end sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${viewMode === 'card'
                    ? 'shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                  }`}
                style={
                  viewMode === 'card'
                    ? { backgroundColor: primaryColor, color: buttonTextColor }
                    : {}
                }
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Card View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${viewMode === 'table'
                    ? 'shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                  }`}
                style={
                  viewMode === 'table'
                    ? { backgroundColor: primaryColor, color: buttonTextColor }
                    : {}
                }
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Table View
              </button>
            </div>
          </div>
          {searchQuery.trim() !== '' ? (
            viewMode === 'card' ? (
              <div className="w-full relative space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-indigo-500 shadow-xs shrink-0" />
                    <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-gray-900 m-0">
                      Search Results
                    </h3>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                    {filterProducts(allProducts).length} {filterProducts(allProducts).length === 1 ? 'Product' : 'Products'}
                  </span>
                </div>
                {filterProducts(allProducts).length === 0 ? (
                  <div className="p-12 rounded-2xl border border-dashed border-gray-200 text-center text-sm text-gray-500 bg-white">
                    No products found matching your search.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filterProducts(allProducts).map(renderProductCard)}
                  </div>
                )}
              </div>
            ) : (
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
            )
          ) : loading ? (
            <div className="w-full bg-white rounded-xl border border-gray-100 shadow-sm p-8">
              <Loading label="Loading products..." />
            </div>
          ) : Object.keys(groupedProducts).length > 0 ? (
            Object.entries(groupedProducts)
              .sort((a, b) => {
                if (a[0] === 'Uncategorized') return 1;
                if (b[0] === 'Uncategorized') return -1;
                return a[0].localeCompare(b[0]);
              })
              .map(([collectionName, items], index) => {
                const filteredItems = filterProducts(items as any[]);
                const tableColor = getTableColor(collectionName, index);

                if (viewMode === 'card') {
                  return (
                    <div key={collectionName} className="w-full relative mb-10">
                      {/* Collection Header Banner */}
                      <div
                        className="p-3.5 sm:p-4 px-4 sm:px-5 rounded-2xl border flex items-center justify-between mb-5 shadow-2xs transition-colors"
                        style={{
                          borderColor: `${tableColor}33`,
                          backgroundColor: `${tableColor}0d`,
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3 h-3 rounded-full shadow-xs shrink-0"
                            style={{ backgroundColor: tableColor }}
                          />
                          <h3
                            className="text-base sm:text-lg font-black uppercase tracking-tight m-0"
                            style={{ color: tableColor }}
                          >
                            {collectionName}
                          </h3>
                        </div>
                        <span
                          className="text-xs font-bold px-2.5 py-0.5 rounded-full border shadow-2xs"
                          style={{
                            color: tableColor,
                            borderColor: `${tableColor}33`,
                            backgroundColor: '#ffffff',
                          }}
                        >
                          {filteredItems.length} {filteredItems.length === 1 ? 'Product' : 'Products'}
                        </span>
                      </div>

                      {/* Collection Cards Grid */}
                      {filteredItems.length === 0 ? (
                        <div className="p-10 rounded-2xl border border-dashed border-gray-200 text-center text-sm text-gray-400 bg-gray-50/50">
                          No products found in this collection.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {filteredItems.map(renderProductCard)}
                        </div>
                      )}
                    </div>
                  );
                }

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
              })
          ) : (
            <div style={{ backgroundColor: '#fff', padding: '60px', borderRadius: 12, border: '1px solid #e5e7eb', textAlign: 'center', color: '#6b7280' }}>
              No products or collections synced for this store yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
