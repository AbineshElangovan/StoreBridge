"use client";

import { PageHeader } from '@/components/ui/PageHeader';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardCards } from '@/components/dashboard/DashboardCards';
import { StoreRoleBadge } from '@/components/ui/StoreRoleBadge';
import { DashboardCharts } from '@/components/dashboard/DashboardCharts';
import { Table, Loading } from '@/components/common';
import type { ColumnConfig } from '@/components/common/Table';
import { shopifyFetch } from '@/lib/shopify/Client';
import { LocalizedDate } from '@/components/common/LocalizedDate';
import { useStoreContext } from '@/components/providers/StoreProvider';
import { getProductUrl } from '@/lib/utils/productUrl';
import { PreorderBadge } from '@/components/preorder/PreorderBadge';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [wishlistItems, setWishlistItems] = useState<any[]>([]);
  const { isStandalone, loading: contextLoading } = useStoreContext();
  const router = useRouter();
  const hasLoadedRef = React.useRef(false);

  const loadWishlist = React.useCallback(async () => {
    if (!isStandalone) return;
    try {
      const res = await shopifyFetch('/api/wishlist');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.items)) {
          setWishlistItems(json.items);
        }
      }
    } catch (_) {}
  }, [isStandalone]);

  useEffect(() => {
    loadWishlist();
    const handleWishlistUpdate = () => loadWishlist();
    window.addEventListener('wishlist-updated', handleWishlistUpdate);
    return () => window.removeEventListener('wishlist-updated', handleWishlistUpdate);
  }, [loadWishlist]);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    async function loadDashboardData() {
      try {
        const res = await shopifyFetch('/api/dashboard');
        if (res.ok) {
          const json = await res.json();
          setData(json);
        } else {
          try {
            const errorData = await res.json();

            if (res.status === 401 && errorData.message === "Store not installed or inactive") {
              console.warn("[Dashboard] Store is missing from database. Redirecting to OAuth to reinstall...");
              const urlParams = new URLSearchParams(window.location.search);
              const shop = urlParams.get('shop');
              const host = urlParams.get('host');
              if (shop) {
                const authUrl = new URL('/api/auth', window.location.origin);
                authUrl.searchParams.set('shop', shop);
                if (host) authUrl.searchParams.set('host', host);
                window.location.href = authUrl.toString();
                return;
              }
            } else if (res.status === 401) {
              console.warn("[Dashboard] Session token expired or invalid (401). App bridge should handle refreshing the token.");
            } else {
              console.error(`[Dashboard] API returned an error: ${res.status} ${res.statusText}`, errorData);
            }
          } catch (e) {
            console.error(`[Dashboard] API returned an error: ${res.status} ${res.statusText}`);
          }
        }
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  if (loading || contextLoading) {
    return <Loading label="Loading dashboard..." />;
  }

  const stats = {
    ...(data?.stats || { totalProducts: 0, totalInventory: 0, lowStock: 0, activeProducts: 0, preorderActive: 0, lastUpdated: 'Never' }),
    wishlistCount: wishlistItems.length > 0 ? wishlistItems.length : (data?.stats?.wishlistCount ?? 0),
  };
  const lowStockThreshold = data?.lowStockThreshold ?? 10;
  const storeSummaryData = (data?.stores && data.stores.length > 0)
    ? data.stores.map((store: any) => ({
        id: store.id,
        storeName: store.label || store.shopDomain,
        totalProducts: store.productCount ?? stats.totalProducts,
        totalInventory: store.inventoryTotal ?? stats.totalInventory,
        activeProducts: store.activeProductCount ?? stats.activeProducts,
        lastSynced: stats.lastUpdated,
      }))
    : [{
        id: 'current-store',
        storeName: 'Current Store',
        totalProducts: stats.totalProducts,
        totalInventory: stats.totalInventory,
        activeProducts: stats.activeProducts,
        lastSynced: stats.lastUpdated,
      }];

  const storeSummaryColumns: ColumnConfig[] = [
    { title: 'Store Name', key: 'storeName', type: 'bold' },
    { title: 'Total Products', key: 'totalProducts' },
    { title: 'Total Inventory', key: 'totalInventory' },
    { title: 'Active Products', key: 'activeProducts' },
    { title: 'Last Synced', key: 'lastSynced' },
  ];

  const lowStockProducts = (data?.lowStockProducts || []).map((p: any) => {
    const prodUrl = getProductUrl(p);
    return {
      id: p.id,
      url: prodUrl,
      imageUrls: p.imageUrls || (p.imageUrl ? [p.imageUrl] : []),
      title_node: (
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={prodUrl}
            className="font-bold text-gray-900 hover:text-[#0db69d] hover:underline cursor-pointer transition-colors"
          >
            {p.title}
          </Link>
          {(isStandalone && p.isPreorderAvailable) && (
            <PreorderBadge size="sm" />
          )}
        </div>
      ),
      title: p.title,
      sku: (p.sku && p.sku !== 'N/A') ? p.sku : (p.id ? `STB-SKU-${p.id.replace(/[^0-9]/g, '').slice(-4).padStart(4, '0')}` : 'STB-SKU-0001'),
      inventoryQuantity: p.inventoryQuantity,
      stockLevel: p.inventoryQuantity <= 5 ? 'Critical' : 'Low',
      updatedDate: <LocalizedDate date={p.updatedAt} format="date" />,
      updatedTime: <LocalizedDate date={p.updatedAt} format="time" />,
    };
  });

  const lowStockColumns: ColumnConfig[] = [
    { title: 'Image', key: 'imageUrls', type: 'image' },
    { title: 'Product Name', key: 'title_node', type: 'react_node' },
    { title: 'SKU', key: 'sku' },
    { title: 'Quantity', key: 'inventoryQuantity', type: 'bold' },
    { title: 'Stock Level', key: 'stockLevel', type: 'badge', badgeRules: { Critical: 'critical', Low: 'warning' } },
    { title: 'Updated Date', key: 'updatedDate' },
    { title: 'Updated Time', key: 'updatedTime' },
  ];

  const recentlyAddedProducts = (data?.recentlyAddedProducts || []).map((p: any) => {
    const prodUrl = getProductUrl(p);
    return {
      id: p.id,
      url: prodUrl,
      imageUrls: p.imageUrls || (p.imageUrl ? [p.imageUrl] : []),
      title_node: (
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={prodUrl}
            className="font-bold text-gray-900 hover:text-[#0db69d] hover:underline cursor-pointer transition-colors"
          >
            {p.title}
          </Link>
          {(isStandalone && p.isPreorderAvailable) && (
            <PreorderBadge size="sm" />
          )}
        </div>
      ),
      title: p.title,
      sku: (p.sku && p.sku !== 'N/A') ? p.sku : (p.id ? `STB-SKU-${p.id.replace(/[^0-9]/g, '').slice(-4).padStart(4, '0')}` : 'STB-SKU-0001'),
      inventoryQuantity: p.inventoryQuantity,
      status: 'Active',
      addedDate: <LocalizedDate date={p.createdAt} format="date" />,
      addedTime: <LocalizedDate date={p.createdAt} format="time" />,
    };
  });

  const recentlyAddedColumns: ColumnConfig[] = [
    { title: 'Image', key: 'imageUrls', type: 'image' },
    { title: 'Product Name', key: 'title_node', type: 'react_node' },
    { title: 'SKU', key: 'sku' },
    { title: 'Stock', key: 'inventoryQuantity', type: 'bold' },
    { title: 'Status', key: 'status', type: 'badge', badgeRules: { Active: 'success' } },
    { title: 'Added Date', key: 'addedDate' },
    { title: 'Added Time', key: 'addedTime' },
  ];

  const preorderEligibleProducts = (data?.preorderEligibleProducts || [])
    .filter((p: any) => p.inventoryQuantity <= (p.threshold ?? 0))
    .map((p: any) => {
      const prodUrl = getProductUrl(p);
      return {
        id: p.id,
        url: prodUrl,
        imageUrls: p.imageUrls || (p.imageUrl ? [p.imageUrl] : []),
        title_node: (
          <Link
            href={prodUrl}
            className="font-bold text-gray-900 hover:text-[#0db69d] hover:underline cursor-pointer transition-colors"
          >
            {p.title}
          </Link>
        ),
        title: p.title,
        sku: p.sku || 'N/A',
        inventoryQuantity: p.inventoryQuantity,
        preorderStatus: <PreorderBadge size="sm" />,
        updatedDate: <LocalizedDate date={p.updatedAt} format="date" />,
        updatedTime: <LocalizedDate date={p.updatedAt} format="time" />,
      };
    });

  const preorderEligibleColumns: ColumnConfig[] = [
    { title: 'Image', key: 'imageUrls', type: 'image' },
    { title: 'Product Name', key: 'title_node', type: 'react_node' },
    { title: 'SKU', key: 'sku' },
    { title: 'Current Stock', key: 'inventoryQuantity', type: 'bold' },
    {
      title: 'Status',
      key: 'preorderStatus',
      type: 'react_node',
    },
    { title: 'Updated Date', key: 'updatedDate' },
    { title: 'Updated Time', key: 'updatedTime' },
  ];

  const handleUncheckWishlist = async (itemId: string, shopifyProductId: string) => {
    // Optimistic UI update
    setWishlistItems((prev) => prev.filter((i) => i.id !== itemId && i.shopifyProductId !== shopifyProductId));
    try {
      await shopifyFetch(`/api/wishlist?id=${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
      });
      window.dispatchEvent(
        new CustomEvent('wishlist-updated', {
          detail: { action: 'removed', shopifyProductId },
        })
      );
    } catch (err) {
      console.error('Failed to uncheck wishlist item:', err);
      loadWishlist();
    }
  };

  const wishlistColumns: ColumnConfig[] = [
    { title: 'Image', key: 'imageUrls', type: 'image' },
    { title: 'Product Name', key: 'title_node', type: 'react_node' },
    { title: 'SKU', key: 'sku' },
    { title: 'Price', key: 'priceText', type: 'bold' },
    { title: 'Stock Status', key: 'stockStatus_node', type: 'react_node' },
    { title: 'Action', key: 'action_node', type: 'react_node' },
    { title: 'Updated Date', key: 'updatedDate' },
    { title: 'Updated Time', key: 'updatedTime' },
  ];

  const wishlistTableItems = wishlistItems.map((item) => {
    const cleanId = String(item.shopifyProductId).replace(/^gid:\/\/shopify\/Product\//i, '');
    const prodUrl = `/products/${cleanId}`;
    const isAvail = item.inventoryQuantity > 0;

    return {
      id: item.id,
      url: prodUrl,
      title: item.productTitle,
      imageUrls: item.imageUrl ? [item.imageUrl] : [],
      title_node: (
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={prodUrl}
            className="font-bold text-gray-900 hover:text-rose-600 hover:underline cursor-pointer transition-colors"
          >
            {item.productTitle}
          </Link>
          {item.variantTitle && (
            <span className="text-xs text-gray-500 font-medium">({item.variantTitle})</span>
          )}
        </div>
      ),
      sku: item.sku || '—',
      priceText: `₹${Number(item.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      stockStatus_node: (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
            isAvail
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          {isAvail ? `${item.inventoryQuantity} in stock` : 'Out of stock'}
        </span>
      ),
      action_node: (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleUncheckWishlist(item.id, item.shopifyProductId);
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 transition-all cursor-pointer shadow-2xs group active:scale-95"
          title="Click to uncheck / remove from wishlist"
        >
          <svg className="w-3.5 h-3.5 fill-rose-500 text-rose-500 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
          <span>Wishlisted</span>
        </button>
      ),
      updatedDate: <LocalizedDate date={item.createdAt || item.updatedAt} format="date" />,
      updatedTime: <LocalizedDate date={item.createdAt || item.updatedAt} format="time" />,
    };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full overflow-x-hidden">
      <div className="flex flex-col gap-8 min-w-0 w-full">
        <PageHeader
          title="Inventory Dashboard"
          subtitle={
            isStandalone
              ? "Live overview of your Shopify store."
              : "Live overview of your connected Shopify store."
          }
        />

        <DashboardCards stats={stats} lowStockThreshold={lowStockThreshold} isStandalone={isStandalone} />

        {/* Charts: BarChart & PieCharts */}
        <DashboardCharts
          isStandalone={isStandalone}
          preorderMetrics={data?.preorderMetrics}
          chartData={{
            combinedData: (data?.stores && data.stores.length > 0)
              ? data.stores.map((s: any) => ({
                  name: isStandalone ? 'Inventory' : (s.label || s.shopDomain),
                  'Total Products': s.productCount ?? stats.totalProducts,
                  'Total Inventory': s.inventoryTotal ?? stats.totalInventory,
                  'Total Sales Value': s.salesValue ?? (stats.totalInventory * 500),
                }))
              : [{
                  name: isStandalone ? 'Inventory' : 'Current Store',
                  'Total Products': stats.totalProducts,
                  'Total Inventory': stats.totalInventory,
                  'Total Sales Value': stats.totalInventory * 500,
                }],
            currentStoreData: (data?.stores && data.stores.length > 0)
              ? data.stores.filter((s: any) => s.id === data.currentStoreId).map((s: any) => ({
                  name: isStandalone ? 'Inventory' : (s.label || s.shopDomain),
                  'Total Products': s.productCount ?? stats.totalProducts,
                  'Total Inventory': s.inventoryTotal ?? stats.totalInventory,
                  'Total Sales Value': s.salesValue ?? (stats.totalInventory * 500),
                }))
              : [{
                  name: isStandalone ? 'Inventory' : 'Current Store',
                  'Total Products': stats.totalProducts,
                  'Total Inventory': stats.totalInventory,
                  'Total Sales Value': stats.totalInventory * 500,
                }]
          }}
        />

        {/* Store Summary Table (Hidden in standalone mode) */}
        {!isStandalone && (
          <div className="w-full overflow-hidden">
            <div className="overflow-x-auto w-full max-w-full">
              <Table
                title="Store Summary"
                headerColor="#0f766e"
                columns={storeSummaryColumns}
                items={storeSummaryData}
                searchable={false}
                filterable={false}
                paginate={false}
                emptyState={
                  <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                    No store data available.
                  </div>
                }
              />
            </div>
          </div>
        )}

        {/* Pre-order Eligible Products Table (Shown ONLY in standalone mode) */}
        {isStandalone && (
          <div className="w-full overflow-hidden">
            <div className="overflow-x-auto w-full max-w-full">
              <Table
                title="Pre-order Eligible Products"
                headerColor="#7c3aed"
                columns={preorderEligibleColumns}
                items={preorderEligibleProducts}
                searchable
                searchKey="title"
                filterable={false}
                paginate={true}
                itemsPerPage={10}
                emptyState={
                  <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                    No pre-order products currently taking orders.
                  </div>
                }
              />
            </div>
          </div>
        )}

        <div className="w-full overflow-hidden">
          <div className="overflow-x-auto w-full max-w-full">
            <Table
              title="Low Stock Products"
              headerColor="#ea580c"
              columns={lowStockColumns}
              items={lowStockProducts}
              searchable
              searchKey="title"
              filterable
              filterKey="stockLevel"
              filterOptions={[
                { label: 'All', value: 'ALL' },
                { label: 'Critical', value: 'Critical' },
                { label: 'Low', value: 'Low' },
              ]}
              paginate={true}
              itemsPerPage={10}
              emptyState={
                <div style={{ padding: '40px', textAlign: 'center', color: '#16a34a' }}>
                  All inventory levels are healthy.
                </div>
              }
            />
          </div>
        </div>

        <div className="w-full overflow-hidden">
          <div className="overflow-x-auto w-full max-w-full">
            <Table
              title="Recently Added Products"
              headerColor="#0891b2"
              columns={recentlyAddedColumns}
              items={recentlyAddedProducts}
              searchable
              searchKey="title"
              filterable={false}
              paginate={true}
              itemsPerPage={10}
              emptyState={
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  No recently added products.
                </div>
              }
            />
          </div>
        </div>

        {isStandalone && wishlistItems.length > 0 && (
          <div className="w-full overflow-hidden">
            <div className="overflow-x-auto w-full max-w-full">
              <Table
                title="Curated Wishlist"
                headerColor="#e11d48"
                columns={wishlistColumns}
                items={wishlistTableItems}
                searchable
                searchKey="title"
                filterable={false}
                paginate={true}
                itemsPerPage={5}
                emptyState={
                  <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                    No items in your wishlist yet.
                  </div>
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
