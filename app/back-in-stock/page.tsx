'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { shopifyFetch } from '@/lib/shopify/Client';
import { Loading } from '@/components/common/Loading';
import { Toast } from '@/components/common/Toast';
import { Table, ColumnConfig } from '@/components/common/Table';
import { getProductUrl } from '@/lib/utils/productUrl';
import { Icon } from '@shopify/polaris';
import {
  EmailIcon,
  NotificationIcon,
  ClockIcon,
  CheckCircleIcon,
  CheckIcon,
  AlertCircleIcon,
  StoreIcon,
  CartIcon,
  RefreshIcon,
} from '@shopify/polaris-icons';
import { StandaloneGuard } from '@/components/ui/StandaloneGuard';
import { StatCard } from '@/components/ui/StatCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { useStoreContext } from '@/components/providers/StoreProvider';
import { useTheme } from '@/components/providers/ThemeContext';
import { EmailTemplateCustomizer } from '@/components/customer-experience/shared';

function ProductThumbnail({ src, alt, href }: { src?: string | null; alt?: string; href?: string }) {
  const [hasError, setHasError] = useState(false);

  const content = (!src || hasError) ? (
    <div className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 text-gray-400">
      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  ) : (
    <img
      src={src}
      alt={alt || 'Product'}
      onError={() => setHasError(true)}
      className="w-10 h-10 rounded-xl object-cover border border-gray-200 shrink-0 bg-white"
    />
  );

  if (href) {
    return (
      <Link href={href} className="shrink-0 transition-transform duration-150 hover:scale-105 active:scale-95 cursor-pointer block" title="View product details">
        {content}
      </Link>
    );
  }
  return content;
}

export default function BackInStockAdminPage() {
  const { isStandalone } = useStoreContext();
  const { currentTheme } = useTheme();
  const primaryColor = currentTheme?.primaryColor || '#a7cd18';
  const darkColor = currentTheme?.darkColor || '#142403';
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Template preview tab & collapsible toggle
  const [previewTab, setPreviewTab] = useState<'notify_me' | 'preorder'>('notify_me');
  
  // Stats
  const [stats, setStats] = useState({
    totalSubscribers: 0,
    notificationsSent: 0,
    pending: 0,
    failed: 0,
  });

  // Store switcher state
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');

  // Table & filters state
  const [jobs, setJobs] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [batchFilter, setBatchFilter] = useState<'ALL' | 'NOTIFY_ME' | 'PRE_ORDER'>('ALL');
  const [search, setSearch] = useState('');

  const loadData = useCallback(async (
    currentPage = 1,
    currentStatus = statusFilter,
    currentSearch = search,
    currentBatch = batchFilter,
    isSilent = false
  ) => {
    try {
      if (!isSilent) {
        setTableLoading(true);
      }
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: '10',
      });
      if (currentStatus && currentStatus !== 'ALL') {
        params.set('status', currentStatus);
      }
      if (currentBatch && currentBatch !== 'ALL') {
        params.set('batch', currentBatch);
      }
      if (currentSearch.trim()) {
        params.set('search', currentSearch.trim());
      }

      const res = await shopifyFetch(`/api/back-in-stock?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setJobs(data.data || []);
        if (data.pagination) {
          setPage(data.pagination.page);
          setTotalPages(data.pagination.totalPages);
          setTotalItems(data.pagination.total);
        }
        if (data.stats) {
          setStats(data.stats);
        }
        setLastRefreshedAt(new Date());
      }
    } catch (err: any) {
      if (!isSilent) {
        setToast({ message: 'Failed to load Back in Stock logs', type: 'error' });
      }
    } finally {
      setLoading(false);
      if (!isSilent) {
        setTableLoading(false);
      }
      setIsRefreshing(false);
    }
  }, [statusFilter, search, batchFilter]);

  // Initial load
  useEffect(() => {
    loadData(1, statusFilter, search, batchFilter, false);
    shopifyFetch('/api/stores?active=false')
      .then((res) => res.json())
      .then((data) => {
        if (data.stores && data.stores.length > 0) {
          setStores(data.stores);
          setSelectedStoreId(data.stores[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Sync when window regains focus or visibility
  useEffect(() => {
    const handleSync = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        loadData(page, statusFilter, search, batchFilter, true);
      }
    };

    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleSync);

    return () => {
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleSync);
    };
  }, [page, statusFilter, search, batchFilter, loadData]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    loadData(page, statusFilter, search, batchFilter, false);
  };

  const activeStore = stores.find((s) => s.id === selectedStoreId) || stores[0] || null;
  const previewStoreName = activeStore ? (activeStore.label || activeStore.shopDomain) : 'ESHAN Chennai Store';
  const previewStoreDomain = activeStore ? activeStore.shopDomain : 'eshan-inventory-solutions.myshopify.com';
  const previewStoreProductUrl = `https://${previewStoreDomain}/products/cotton-t-shirt`;

  const handleAction = async (action: 'retry' | 'sendNow', itemId: string) => {
    try {
      setRetryingId(itemId);
      const res = await shopifyFetch('/api/back-in-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, itemId }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({
          message: action === 'sendNow' ? 'Restock notification dispatched to customer!' : 'Notification retry initiated successfully!',
          type: 'success',
        });
        loadData(page, statusFilter, search);
      } else {
        setToast({ message: data.error || 'Action failed', type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Error executing action', type: 'error' });
    } finally {
      setRetryingId(null);
    }
  };

  const handleBatchChange = (newBatch: 'ALL' | 'NOTIFY_ME' | 'PRE_ORDER') => {
    setBatchFilter(newBatch);
    setPage(1);
    loadData(1, statusFilter, search, newBatch);
  };

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setPage(1);
    loadData(1, newStatus, search, batchFilter);
  };

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    setPage(1);
    loadData(1, statusFilter, newSearch, batchFilter);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadData(newPage, statusFilter, search, batchFilter);
  };

    const columns: ColumnConfig[] = [
    {
      title: 'Product & SKU',
      key: 'productInfo',
      type: 'react_node',
      width: '28%',
      align: 'left',
    },
    {
      title: 'Restock Type',
      key: 'sourceTypeBadge',
      type: 'react_node',
      width: '14%',
      align: 'left',
    },
    {
      title: 'Quantity',
      key: 'quantityBadge',
      type: 'react_node',
      width: '10%',
      align: 'center',
    },
    {
      title: 'Customer Recipient',
      key: 'recipient',
      type: 'react_node',
      width: '20%',
      align: 'left',
    },
    {
      title: 'Registration Date',
      key: 'registrationDate',
      type: 'react_node',
      width: '14%',
      align: 'center',
    },
    {
      title: 'Status / Action',
      key: 'orderStatusBadge',
      type: 'react_node',
      width: '14%',
      align: 'center',
    },
  ];

  const formattedItems = jobs.map((job) => {
    const prodUrl = job.productId || job.shopifyProductId || job.sku
      ? getProductUrl({ id: job.productId, shopifyProductId: job.shopifyProductId, sku: job.sku })
      : undefined;

    return {
      ...job,
      productInfo: (
        <div className="flex items-center gap-3 text-left">
          <ProductThumbnail src={job.imageUrl} alt={job.productTitle} href={prodUrl} />
          <div className="min-w-0">
            {prodUrl ? (
              <Link
                href={prodUrl}
                className="font-bold text-gray-900 text-xs sm:text-sm truncate hover:underline hover:text-indigo-600 transition-colors block"
                title={job.productTitle || 'Product'}
              >
                {job.productTitle}
              </Link>
            ) : (
              <p className="font-bold text-gray-900 text-xs sm:text-sm truncate">
                {job.productTitle}
              </p>
            )}
            <p className="text-[11px] text-gray-500 truncate">
              {job.variantTitle && job.variantTitle !== 'Default Title' ? job.variantTitle : ''}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                SKU: {job.sku || '-'}
              </span>
            </div>
          </div>
        </div>
      ),
    sourceTypeBadge: (
      <div className="flex flex-col items-start gap-1">
        <span
          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
            job.sourceType === 'PRE_ORDER' || job.isPreorder
              ? 'bg-purple-100 text-purple-800 border border-purple-300'
              : 'bg-sky-100 text-sky-800 border border-sky-300'
          }`}
        >
          {job.sourceType === 'PRE_ORDER' || job.isPreorder ? 'Pre-order' : 'Notify Me'}
        </span>
        {job.orderNumber && (
          <span className="font-bold font-mono text-[11px] text-slate-800">
            {job.orderNumber}
          </span>
        )}
      </div>
    ),
    quantityBadge: (
      <span className="inline-flex items-center justify-center font-extrabold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-lg text-xs border border-gray-200">
        {job.quantity || 1} {job.quantity === 1 ? 'unit' : 'units'}
      </span>
    ),
    recipient: (
      <div className="space-y-0.5 text-left">
        {job.customerEmail ? (
          <>
            <p className="font-semibold text-gray-900 text-xs sm:text-sm truncate">
              {job.customerEmail}
            </p>
            {job.customerWhatsApp && (
              <p className="text-[11px] text-gray-500 font-mono truncate">{job.customerWhatsApp}</p>
            )}
          </>
        ) : (
          <p className="font-semibold text-gray-900 text-xs sm:text-sm font-mono truncate">
            {job.customerWhatsApp || '-'}
          </p>
        )}
      </div>
    ),
    registrationDate: (
      <div className="flex flex-col items-center justify-center text-center space-y-0.5">
        <span className="text-xs font-semibold text-gray-800">
          {job.createdAt
            ? new Date(job.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : '-'}
        </span>
        {job.createdAt && (
          <p className="text-[10px] text-gray-500 font-mono">
            {new Date(job.createdAt).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>
    ),
    notificationStatus: job.status === 'SENT' ? (
      <div className="flex flex-col items-center justify-center text-center space-y-0.5">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 shadow-2xs">
          Sent
        </span>
        {job.sentAt && (
          <p className="text-[10px] text-emerald-700 font-medium whitespace-nowrap">
            {new Date(job.sentAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>
    ) : job.status === 'FAILED' ? (
      <div className="flex justify-center">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-200 shadow-2xs">
          Failed
        </span>
      </div>
    ) : (
      <div className="flex justify-center">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 shadow-2xs">
          Pending Restock
        </span>
      </div>
    ),
    orderStatusBadge: job.sourceType === 'PRE_ORDER' || job.isPreorder ? (
      <div className="flex flex-col items-center justify-center text-center space-y-1">
        <span className="text-xs font-mono font-bold text-gray-900 block truncate">
          {job.orderNumber || 'Order Confirmed'}
        </span>
        <span
          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
            job.orderStatus === 'ALLOCATED'
              ? 'bg-purple-100 text-purple-800 border border-purple-300 shadow-2xs'
              : job.orderStatus === 'FULFILLED'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
              : job.orderStatus === 'PARTIALLY_FULFILLED'
              ? 'bg-blue-100 text-blue-800 border border-blue-300 shadow-2xs'
              : job.orderStatus === 'CANCELLED'
              ? 'bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs'
              : 'bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs'
          }`}
        >
          {job.orderStatus === 'ALLOCATED'
            ? 'Allocated'
            : job.orderStatus === 'FULFILLED'
            ? 'Fulfilled'
            : job.orderStatus === 'PARTIALLY_FULFILLED'
            ? 'Partially Fulfilled'
            : job.orderStatus === 'CANCELLED'
            ? 'Cancelled'
            : (job.orderStatus || 'Unfulfilled')}
        </span>
      </div>
    ) : job.status === 'FAILED' ? (
      <div className="flex justify-center">
        <button
          type="button"
          disabled={retryingId === job.id}
          onClick={() => handleAction('retry', job.id)}
          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
        >
          {retryingId === job.id ? 'Retrying...' : 'Retry'}
        </button>
      </div>
    ) : (
      <div className="flex justify-center">
        <span
          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            job.status === 'SENT'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
              : job.status === 'PROCESSING'
              ? 'bg-indigo-100 text-indigo-800 border border-indigo-300 shadow-2xs'
              : job.status === 'CANCELLED'
              ? 'bg-gray-100 text-gray-700 border border-gray-300 shadow-2xs'
              : 'bg-sky-100 text-sky-800 border border-sky-300 shadow-2xs'
          }`}
        >
          {job.status === 'SENT' ? 'Alert Sent' : job.status === 'PROCESSING' ? 'Processing' : job.status === 'CANCELLED' ? 'Cancelled' : 'Pending'}
        </span>
      </div>
    ),
  };
});

  if (loading) {
    return <Loading label="Loading back in stock..." />;
  }

  return (
    <StandaloneGuard featureName="Back in Stock">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full overflow-x-hidden space-y-8">
      {toast && (
        <Toast
          content={toast.message}
          error={toast.type === 'error'}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Page Title Header */}
      <PageHeader
        title="Back in Stock Monitor"
        subtitle="Track real-time restock alerts and customer notification logs."
      />
      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        <StatCard
          title="Total Subscribers"
          value={stats.totalSubscribers}
          description="Registered restock customers"
          icon={NotificationIcon}
          color="purple"
        />
        <StatCard
          title="Notifications Sent"
          value={stats.notificationsSent}
          description="Alert emails delivered"
          icon={CheckCircleIcon}
          color="success"
        />
        <StatCard
          title="Pending Queue"
          value={stats.pending}
          description="Subscribers waiting on inventory"
          icon={ClockIcon}
          color="warning"
        />
        <StatCard
          title="Failed / Errors"
          value={stats.failed}
          description="Delivery attempts needing retry"
          icon={AlertCircleIcon}
          color="danger"
        />
      </div>

      {/* Interactive Email Template Customizer & Live Preview */}
      <EmailTemplateCustomizer
        storeName={previewStoreName}
        productUrl={previewStoreProductUrl}
        onSave={() => setToast({ message: 'Email template customized and saved successfully!', type: 'success' })}
      />


      {/* Activity / Notification History Table */}
      <Table
        tableLayout="fixed"
        title="Recent Restock Notifications"
        columns={columns}
        items={formattedItems}
        loading={tableLoading}
        serverSide={true}
        totalItems={totalItems}
        page={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        searchable={true}
        searchKey="productTitle"
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterable={true}
        filterKey="sourceType"
        filterValue={batchFilter}
        onFilterChange={(val) => handleBatchChange(val as any)}
        filterOptions={[
          { label: 'All Restocks', value: 'ALL' },
          { label: 'Notify Me Waitlist', value: 'NOTIFY_ME' },
          { label: 'Pre-order Commitments', value: 'PRE_ORDER' },
        ]}
        secondaryFilterable={true}
        secondaryFilterValue={statusFilter}
        onSecondaryFilterChange={handleStatusChange}
        secondaryFilterOptions={[
          { label: 'All States', value: 'ALL' },
          { label: 'Pending Only', value: 'PENDING' },
          { label: 'Unfulfilled Orders', value: 'UNFULFILLED' },
          { label: 'Allocated Orders', value: 'ALLOCATED' },
          { label: 'Fulfilled Orders', value: 'FULFILLED' },
          { label: 'Alerts Sent', value: 'SENT' },
          { label: 'Failed Alerts', value: 'FAILED' },
        ]}
        extraControls={
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={tableLoading || isRefreshing}
            className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition shadow-2xs disabled:opacity-50 cursor-pointer flex items-center justify-center"
            title="Refresh table data"
          >
            <div className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}>
              <Icon source={RefreshIcon} />
            </div>
          </button>
        }
        itemsPerPage={10}
        paginate={true}
      />
    </div>
    </StandaloneGuard>
  );
}
