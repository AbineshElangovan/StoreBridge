'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StandaloneGuard } from '@/components/ui/StandaloneGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Table, ColumnConfig } from '@/components/common/Table';
import { Loading } from '@/components/common/Loading';
import { PolarisSelect } from '@/components/common/PolarisSelect';
import { RefreshButton } from '@/components/common/RefreshButton';
import { ConfirmToast } from '@/components/ui/ConfirmToast';
import { useToast } from '@/components/providers/ToastContext';
import { useTheme } from '@/components/providers/ThemeContext';
import { shopifyFetch } from '@/lib/shopify/Client';
import {
  HeartIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  StoreIcon,
} from '@shopify/polaris-icons';

export interface WishlistItemRecord {
  id: string;
  storeId: string;
  shopifyProductId: string;
  shopifyVariantId?: string | null;
  productTitle: string;
  variantTitle?: string | null;
  sku?: string | null;
  price: number;
  imageUrl?: string | null;
  inventoryQuantity: number;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function WishlistPage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const { currentTheme } = useTheme();

  const primaryColor = currentTheme?.primaryColor || '#a7cd18';
  const isLime = currentTheme?.id === 'emerald_forest' || primaryColor === '#a7cd18';
  // All themes use white font on buttons, only Lime uses black/dark font
  const buttonTextColor = isLime ? '#142403' : '#ffffff';

  const [items, setItems] = useState<WishlistItemRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');

  // Deletion modal state
  const [itemToDelete, setItemToDelete] = useState<WishlistItemRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Table search & filter
  const [search, setSearch] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<string>('ALL');

  const fetchWishlist = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);

    try {
      const res = await shopifyFetch(`/api/wishlist?t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.items)) {
          setItems(json.items);
        } else {
          setError(json.error || 'Failed to load wishlist items');
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.error || `Failed to fetch wishlist (Status: ${res.status})`);
      }
    } catch (err: any) {
      console.error('[WishlistPage] fetch error:', err);
      setError(err.message || 'Network error fetching wishlist');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWishlist();

    const handleGlobalUpdate = () => {
      fetchWishlist(true);
    };

    window.addEventListener('wishlist-updated', handleGlobalUpdate);
    return () => {
      window.removeEventListener('wishlist-updated', handleGlobalUpdate);
    };
  }, [fetchWishlist]);

  // Mark wishlist as seen when page loads with items
  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem('wishlist_seen_count', String(items.length));
        localStorage.setItem('wishlist_last_seen_at', String(Date.now()));
        window.dispatchEvent(
          new CustomEvent('wishlist-seen', { detail: { count: items.length } })
        );
      } catch (_) {}
    }
  }, [items.length, loading]);

  // Refresh handler with guaranteed minimum spin rotation duration
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const start = Date.now();
    try {
      await fetchWishlist(true);
      showSuccess('Wishlist refreshed');
    } catch (err: any) {
      showError(err.message || 'Failed to refresh wishlist');
    } finally {
      const elapsed = Date.now() - start;
      const minDuration = 700; // rotate for at least 700ms so user clearly sees the spin
      if (elapsed < minDuration) {
        setTimeout(() => setIsRefreshing(false), minDuration - elapsed);
      } else {
        setIsRefreshing(false);
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);

    try {
      const res = await shopifyFetch(`/api/wishlist?id=${encodeURIComponent(itemToDelete.id)}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== itemToDelete.id));
        window.dispatchEvent(
          new CustomEvent('wishlist-updated', {
            detail: {
              productId: itemToDelete.shopifyProductId.replace(/^gid:\/\/shopify\/Product\//i, ''),
              wishlisted: false,
            },
          })
        );
        showSuccess(`Removed "${itemToDelete.productTitle}" from your wishlist`);
      } else {
        const json = await res.json().catch(() => ({}));
        showError(json.error || 'Failed to remove wishlist item');
      }
    } catch (err: any) {
      console.error('[WishlistPage] delete error:', err);
      showError(err.message || 'Error deleting item');
    } finally {
      setIsDeleting(false);
      setItemToDelete(null);
    }
  };

  // Filtered items based on search and stock status
  const filteredItems = items.filter((item) => {
    const q = search.toLowerCase().trim();
    if (q) {
      const titleMatch = item.productTitle?.toLowerCase().includes(q);
      const skuMatch = item.sku?.toLowerCase().includes(q);
      const variantMatch = item.variantTitle?.toLowerCase().includes(q);
      if (!titleMatch && !skuMatch && !variantMatch) return false;
    }
    if (stockFilter === 'IN_STOCK' && item.inventoryQuantity <= 0) return false;
    if (stockFilter === 'OUT_OF_STOCK' && item.inventoryQuantity > 0) return false;
    return true;
  });

  // KPI Calculations
  const totalCount = items.length;
  const inStockCount = items.filter((i) => i.inventoryQuantity > 0).length;
  const outOfStockCount = items.filter((i) => i.inventoryQuantity <= 0).length;
  const totalValue = items.reduce((acc, i) => acc + (Number(i.price) || 0), 0);

  // Table columns configuration
  const tableColumns: ColumnConfig[] = [
    { title: 'Product', key: 'productInfo', type: 'react_node', width: '32%', align: 'left' },
    { title: 'SKU', key: 'sku', type: 'react_node', width: '16%', align: 'left' },
    { title: 'Price (INR)', key: 'priceFormatted', type: 'react_node', width: '14%', align: 'left' },
    { title: 'Stock Status', key: 'stockBadge', type: 'react_node', width: '16%', align: 'center' },
    { title: 'Saved On', key: 'savedDate', type: 'react_node', width: '12%', align: 'center' },
    { title: 'Action', key: 'actions', type: 'react_node', width: '10%', align: 'center' },
  ];

  // Table row formatting
  const formattedTableItems = filteredItems.map((item) => {
    const cleanProductId = item.shopifyProductId.replace(/^gid:\/\/shopify\/Product\//i, '');
    const isAvailable = item.inventoryQuantity > 0;
    const prodUrl = `/products/${cleanProductId}`;

    return {
      ...item,
      productInfo: (
        <div className="flex items-center gap-3 text-left">
          <Link
            href={prodUrl}
            className="w-11 h-11 rounded-xl bg-gray-50 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center transition-transform hover:scale-105 block"
            title="View product details"
          >
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.productTitle}
                className="w-full h-full object-cover"
              />
            ) : (
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </Link>
          <div className="min-w-0">
            <Link
              href={prodUrl}
              className="font-bold text-gray-900 text-xs sm:text-sm truncate hover:underline hover:text-indigo-600 transition-colors block"
              title={item.productTitle}
            >
              {item.productTitle}
            </Link>
            {item.variantTitle && item.variantTitle !== 'Default Title' && (
              <span className="text-xs text-gray-500 font-medium block mt-0.5">
                {item.variantTitle}
              </span>
            )}
          </div>
        </div>
      ),
      sku: (
        <span className="text-xs sm:text-sm font-mono text-gray-700 font-medium">
          {item.sku || '—'}
        </span>
      ),
      priceFormatted: (
        <span className="font-extrabold text-sm text-gray-900">
          ₹{Number(item.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
      stockBadge: (
        <div className="flex flex-col items-center justify-center gap-0.5">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
              isAvailable
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
                : 'bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs'
            }`}
          >
            {isAvailable ? 'In Stock' : 'Out of Stock'}
          </span>
          <span className="text-[10px] text-gray-500 font-medium">
            {item.inventoryQuantity} {item.inventoryQuantity === 1 ? 'unit' : 'units'}
          </span>
        </div>
      ),
      statusBadge: (
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => setItemToDelete(item)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 hover:text-rose-800 transition-all cursor-pointer shadow-2xs active:scale-95 group"
            title="Click to uncheck / remove from wishlist"
          >
            <svg className="w-3.5 h-3.5 fill-rose-500 text-rose-500 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
            <span>Wishlisted</span>
          </button>
        </div>
      ),
      savedDate: (
        <div className="text-center flex flex-col items-center">
          <span className="text-xs text-gray-700 font-medium">
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }) : '-'}
          </span>
          {item.createdAt && (
            <span className="text-[11px] text-gray-400 font-mono mt-0.5">
              {new Date(item.createdAt).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
      ),
      actions: (
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => setItemToDelete(item)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 transition-all cursor-pointer shadow-2xs active:scale-95"
            title="Remove from wishlist"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Remove</span>
          </button>
        </div>
      ),
    };
  });

  if (loading) {
    return <Loading label="Loading wishlist..." />;
  }

  return (
    <StandaloneGuard featureName="Wishlist">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full overflow-x-hidden space-y-8">
        {/* Page Title & Actions */}
        <PageHeader
          title="Wishlist"
          subtitle="Keep track of products you love and want to revisit."
          actions={
            <div className="flex items-center gap-3">
              {/* Reusable Animated Refresh Button */}
              <RefreshButton
                onClick={handleRefresh}
                isRefreshing={isRefreshing}
                size="md"
                variant="white"
                title="Refresh wishlist data"
              />

              {/* Themed Primary Browse Products Button */}
              <Link
                href="/products"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-2xs hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                style={{ backgroundColor: primaryColor, color: buttonTextColor }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                Browse Products
              </Link>
            </div>
          }
        />

        {/* Error Alert Notice if Any */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-900">Wishlist Notice</h3>
                <p className="text-xs text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => fetchWishlist()}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-rose-700 border border-rose-200 hover:bg-rose-100 transition-all cursor-pointer shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* KPI Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          <StatCard
            title="Total Wishlisted"
            value={totalCount}
            description="Saved items in store catalog"
            icon={HeartIcon}
            color="danger"
          />
          <StatCard
            title="In Stock"
            value={inStockCount}
            description="Ready to fulfill immediately"
            icon={CheckCircleIcon}
            color="success"
          />
          <StatCard
            title="Out of Stock"
            value={outOfStockCount}
            description="Awaiting inventory restock"
            icon={AlertCircleIcon}
            color="warning"
          />
          <StatCard
            title="Estimated Value"
            value={`₹${Number(totalValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            description="Combined wishlist catalog value"
            icon={StoreIcon}
            color="purple"
          />
        </div>

        {/* Controls Toolbar: Search, Stock Filter & Card/Table Segmented Toggle */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <input
                type="text"
                placeholder="Search wishlist..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56 sm:w-64 pl-9 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              <svg
                className="w-4 h-4 text-gray-400 absolute left-3 top-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Stock Status Dropdown Filter */}
            <div className="w-36 sm:w-44">
              <PolarisSelect
                label="Stock Status"
                labelHidden
                value={stockFilter}
                onChange={(val) => setStockFilter(val)}
                options={[
                  { label: 'All', value: 'ALL' },
                  { label: 'In Stock', value: 'IN_STOCK' },
                  { label: 'Out of Stock', value: 'OUT_OF_STOCK' },
                ]}
              />
            </div>
          </div>

          {/* Segmented Card/Table View Mode Toggle */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <div className="inline-flex items-center p-1 bg-gray-100 rounded-xl border border-gray-200">
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'card'
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
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'table'
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
        </div>

        {/* Main Content Area */}
        {filteredItems.length === 0 ? (
          /* StoreOrbit Styled Empty State */
          <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center shadow-2xs flex flex-col items-center justify-center max-w-2xl mx-auto">
            <div className="w-20 h-20 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mb-5 shadow-inner">
              <svg className="w-10 h-10 text-rose-500 fill-rose-500/20" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {items.length === 0 ? 'Your wishlist is empty' : 'No matching items found'}
            </h2>
            <p className="text-sm text-gray-500 max-w-md mb-6">
              {items.length === 0
                ? 'Click the heart icon on any product page or catalog list to save items to your personal wishlist.'
                : 'Try adjusting your search query or filter options to locate your saved products.'}
            </p>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all hover:brightness-105 active:scale-95 cursor-pointer"
              style={{ backgroundColor: primaryColor, color: buttonTextColor }}
            >
              Explore Products
            </Link>
          </div>
        ) : viewMode === 'card' ? (
          /* CARD VIEW: Responsive Grid of StoreOrbit Cards */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredItems.map((item) => {
              const cleanProductId = item.shopifyProductId.replace(/^gid:\/\/shopify\/Product\//i, '');
              const isAvailable = item.inventoryQuantity > 0;
              const prodUrl = `/products/${cleanProductId}`;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
                >
                  <div className="p-4">
                    {/* Image and Badges */}
                    <div className="relative aspect-square w-full rounded-xl bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center mb-3">
                      <Link
                        href={prodUrl}
                        className="w-full h-full flex items-center justify-center cursor-pointer group/img"
                        title={`View ${item.productTitle}`}
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.productTitle}
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
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            isAvailable
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
                              : 'bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs'
                          }`}
                        >
                          {isAvailable ? `${item.inventoryQuantity} In Stock` : 'Out of Stock'}
                        </span>
                      </div>

                      {/* Quick Remove Button */}
                      <button
                        type="button"
                        onClick={() => setItemToDelete(item)}
                        className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm border border-gray-200 hover:bg-rose-50 hover:border-rose-200 text-gray-500 hover:text-rose-600 flex items-center justify-center shadow-2xs transition-all cursor-pointer active:scale-95 z-10"
                        title="Remove from wishlist"
                      >
                        <svg className="w-4 h-4 fill-rose-500 text-rose-500" viewBox="0 0 24 24">
                          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                        </svg>
                      </button>
                    </div>

                    {/* Product Details */}
                    <Link
                      href={prodUrl}
                      className="font-bold text-gray-900 text-sm hover:underline line-clamp-2 block mb-1 group-hover:text-indigo-600 transition-colors"
                      title={item.productTitle}
                    >
                      {item.productTitle}
                    </Link>
                    {item.variantTitle && item.variantTitle !== 'Default Title' && (
                      <p className="text-xs text-gray-500 truncate mb-2">{item.variantTitle}</p>
                    )}

                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-100">
                      <span className="text-base font-extrabold text-gray-900">
                        ₹{Number(item.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {item.sku && (
                        <span className="text-xs font-mono text-gray-600 truncate max-w-[140px]">
                          {item.sku}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Action: Full-width Remove button with red background and white text */}
                  <div className="p-3 bg-white border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setItemToDelete(item)}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                      title="Remove from wishlist"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TABLE VIEW: StoreOrbit Table Component */
          <Table
            title="Wishlisted Products"
            columns={tableColumns}
            items={formattedTableItems}
            loading={isRefreshing}
            paginate={true}
            itemsPerPage={12}
            tableLayout="fixed"
          />
        )}

        {/* Delete Confirmation Modal using StoreOrbit ConfirmToast */}
        <ConfirmToast
          open={Boolean(itemToDelete)}
          message={`Remove "${itemToDelete?.productTitle}" from Wishlist?`}
          subMessage="You can always add it back anytime from the products catalog or product details page."
          confirmLabel={isDeleting ? 'Removing...' : 'Remove'}
          cancelLabel="Keep in Wishlist"
          variant="danger"
          loading={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setItemToDelete(null)}
        />
      </div>
    </StandaloneGuard>
  );
}
