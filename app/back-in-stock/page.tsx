'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { shopifyFetch } from '@/lib/shopify/Client';
import { Loading } from '@/components/common/Loading';
import { Toast } from '@/components/common/Toast';
import { Table, ColumnConfig } from '@/components/common/Table';
import { Icon } from '@shopify/polaris';
import {
  EmailIcon,
  NotificationIcon,
  CheckIcon,
  AlertCircleIcon,
  StoreIcon,
  CartIcon,
} from '@shopify/polaris-icons';

function ProductThumbnail({ src, alt }: { src?: string | null; alt?: string }) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 text-gray-400">
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || 'Product'}
      onError={() => setHasError(true)}
      className="w-10 h-10 rounded-xl object-cover border border-gray-200 shrink-0 bg-white"
    />
  );
}

export default function BackInStockAdminPage() {
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Template preview tab & collapsible toggle
  const [previewTab, setPreviewTab] = useState<'notify_me' | 'preorder'>('notify_me');
  const [showEmailPreview, setShowEmailPreview] = useState(false);

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
    currentBatch = batchFilter
  ) => {
    try {
      setTableLoading(true);
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
      }
    } catch (err: any) {
      setToast({ message: 'Failed to load Back in Stock logs', type: 'error' });
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  }, [statusFilter, search, batchFilter]);

  useEffect(() => {
    loadData(1, statusFilter, search, batchFilter);
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
      width: '26%',
    },
    {
      title: 'Restock Type',
      key: 'sourceTypeBadge',
      type: 'react_node',
      width: '12%',
    },
    {
      title: 'Quantity',
      key: 'quantityBadge',
      type: 'react_node',
      width: '8%',
    },
    {
      title: 'Customer Recipient',
      key: 'recipient',
      type: 'react_node',
      width: '20%',
    },
    {
      title: 'Registration Date',
      key: 'registrationDate',
      type: 'react_node',
      width: '12%',
      align: 'center',
    },
    {
      title: 'Status',
      key: 'notificationStatus',
      type: 'react_node',
      width: '12%',
      align: 'center',
    },
    {
      title: 'Order / Action Status',
      key: 'orderStatusBadge',
      type: 'react_node',
      width: '12%',
      align: 'center',
    },
  ];

  const formattedItems = jobs.map((job) => ({
    ...job,
    productInfo: (
      <div className="flex items-center gap-3 text-left">
        <ProductThumbnail src={job.imageUrl} alt={job.productTitle} />
        <div className="min-w-0">
          <p className="font-bold text-gray-900 text-xs sm:text-sm truncate">
            {job.productTitle}
          </p>
          <p className="text-[11px] text-gray-500 truncate">
            {job.variantTitle && job.variantTitle !== 'Default Title' ? job.variantTitle : (job.shopifyVariantId ? `ID: ${job.shopifyVariantId}` : '')}
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
      <span
        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
          job.sourceType === 'PRE_ORDER' || job.isPreorder
            ? 'bg-purple-100 text-purple-800 border border-purple-300'
            : 'bg-sky-100 text-sky-800 border border-sky-300'
        }`}
      >
        {job.sourceType === 'PRE_ORDER' || job.isPreorder ? 'Pre-order' : 'Notify Me'}
      </span>
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
      <div className="flex flex-col items-center justify-center text-center space-y-0.5">
        <span className="text-xs font-mono font-bold text-gray-900 block truncate">
          {job.orderNumber || 'Order Confirmed'}
        </span>
        <span
          className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
            job.orderStatus === 'ALLOCATED'
              ? 'bg-purple-100 text-purple-800 border border-purple-300'
              : 'bg-amber-100 text-amber-800 border border-amber-300'
          }`}
        >
          {job.orderStatus === 'ALLOCATED' ? 'Allocated' : 'Unfulfilled'}
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
          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            job.status === 'SENT'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-sky-50 text-sky-700 border border-sky-200'
          }`}
        >
          {job.status === 'SENT' ? 'Alert Sent' : 'Pending'}
        </span>
      </div>
    ),
  }));

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <Loading />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {toast && (
        <Toast
          content={toast.message}
          error={toast.type === 'error'}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Page Title */}
      <div className="pb-2 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Back in Stock Monitor</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time restock triggers and priority customer notification dispatch logs. Pre-orders are fulfilled first, followed by Notify Me waitlist subscribers.
          </p>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Total Subscribers</span>
            <div className="w-4 h-4 text-gray-400">
              <Icon source={NotificationIcon} />
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900 mt-1">{stats.totalSubscribers}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block">Notifications Sent</span>
            <div className="w-4 h-4 text-emerald-600">
              <Icon source={CheckIcon} />
            </div>
          </div>
          <p className="text-3xl font-black text-emerald-900 mt-1">{stats.notificationsSent}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block">Pending Queue</span>
            <div className="w-4 h-4 text-amber-600">
              <Icon source={AlertCircleIcon} />
            </div>
          </div>
          <p className="text-3xl font-black text-amber-900 mt-1">{stats.pending}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 uppercase tracking-wider block">Failed / Errors</span>
            <div className="w-4 h-4 text-rose-600">
              <Icon source={AlertCircleIcon} />
            </div>
          </div>
          <p className="text-3xl font-black text-rose-900 mt-1">{stats.failed}</p>
        </div>
      </div>

      {/* Collapsible Notification Template Preview */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden transition-all">
        <div className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700 border border-gray-200 shrink-0">
              <div className="w-4 h-4">
                <Icon source={EmailIcon} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-gray-900 tracking-tight">Email Notification Template</h2>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Automated
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Preview the customer alert layout sent for product restocks and pre-order arrivals.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {showEmailPreview && (
              <>
                {/* Template Type Tabs */}
                <div className="inline-flex p-0.5 bg-gray-100 rounded-lg border border-gray-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('notify_me')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      previewTab === 'notify_me'
                        ? 'bg-white text-gray-900 shadow-2xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Notify Me
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('preorder')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      previewTab === 'preorder'
                        ? 'bg-white text-purple-900 shadow-2xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Pre-order
                  </button>
                </div>

                {/* Store Switcher */}
                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 shadow-2xs text-xs">
                  <span className="text-gray-400 font-medium">Store:</span>
                  <select
                    aria-label="Preview Store"
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="font-bold text-gray-900 bg-transparent outline-none cursor-pointer max-w-[140px] truncate"
                  >
                    {stores.length > 0 ? (
                      stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label || s.shopDomain}
                        </option>
                      ))
                    ) : (
                      <option value="default">ESHAN Chennai Store</option>
                    )}
                  </select>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => setShowEmailPreview(!showEmailPreview)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer shadow-2xs shrink-0 ${
                showEmailPreview
                  ? 'bg-gray-900 text-white border border-gray-900 hover:bg-black'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span>{showEmailPreview ? 'Hide Preview' : 'Preview Email Template'}</span>
              <span className={showEmailPreview ? 'text-gray-300 text-[10px]' : 'text-gray-500 text-[10px]'}>
                {showEmailPreview ? '▲' : '▼'}
              </span>
            </button>
          </div>
        </div>

        {/* COMPACT TEMPLATE PREVIEW CONTENT (COLLAPSIBLE) */}
        {showEmailPreview && (
          <div className="p-4 sm:p-6 bg-gray-50/70 border-t border-gray-100">
            <div className="max-w-lg mx-auto bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-center">
              {/* Header */}
              <div className="bg-gray-900 text-white px-4 py-2.5 flex items-center justify-between text-xs">
                <span className="font-extrabold tracking-tight truncate">{previewStoreName}</span>
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">OFFICIAL STORE</span>
              </div>

              {/* Status Banner */}
              <div
                className={`${
                  previewTab === 'preorder' ? 'bg-purple-700' : 'bg-emerald-600'
                } text-white text-[11px] font-bold py-1.5 px-3 flex items-center justify-center gap-1.5`}
              >
                <span>
                  {previewTab === 'preorder'
                    ? 'Pre-order Allocated • Ready for Fulfillment'
                    : 'Back in Stock • Available Now'}
                </span>
              </div>

              {/* Compact Body */}
              <div className="p-5 space-y-3.5">
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">
                    {previewTab === 'preorder'
                      ? 'Your Pre-ordered Item is Ready'
                      : 'Cotton T-shirt is Back in Stock!'}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {previewTab === 'preorder'
                      ? `Stock has arrived at ${previewStoreName}. Preparing fulfillment.`
                      : `The item you requested at ${previewStoreName} is available now.`}
                  </p>
                </div>

                {/* Compact Product Box */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-w-sm mx-auto flex items-center gap-3 text-left">
                  <div className="w-16 h-16 bg-white rounded-md border border-gray-200 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                    <img
                      src="https://cdn.shopify.com/s/files/1/0836/6748/4891/files/cotton-t-shirt_924bced9-4b4d-4e4f-9f3b-b554623c9e69.png?v=1790857896"
                      alt="Cotton T-shirt"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-gray-900 truncate">Cotton T-shirt</h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-semibold text-gray-600 bg-gray-200 px-1.5 py-0.5 rounded">
                        White / M
                      </span>
                      <span className="text-[10px] font-bold text-gray-900">
                        ₹1,240
                      </span>
                    </div>
                    <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                      {previewTab === 'preorder' ? 'Reserved & in stock' : 'Ready to order'}
                    </p>
                  </div>
                </div>

                {/* CTA Button */}
                <div className="pt-1">
                  <a
                    href={previewStoreProductUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 py-2 px-5 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-lg shadow-sm transition-all"
                  >
                    <div className="w-3.5 h-3.5">
                      <Icon source={CartIcon} />
                    </div>
                    <span>{previewTab === 'preorder' ? 'View Order Status →' : 'Shop Now →'}</span>
                  </a>
                </div>

                {/* Footer */}
                <p className="text-[10px] text-gray-400 pt-2 border-t border-gray-100">
                  © {new Date().getFullYear()} {previewStoreName} • Sent automatically via StoreBridge
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Activity / Notification History Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Recent Restock Notifications</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Automated restock alerts dispatched when product inventory transitions from 0 to positive. Showing 10 records per page.
            </p>
          </div>

          {/* Restock Type Tabs: All, Notify Me, Pre-order */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleBatchChange('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                batchFilter === 'ALL'
                  ? 'bg-gray-900 text-white shadow-2xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Restocks
            </button>
            <button
              type="button"
              onClick={() => handleBatchChange('NOTIFY_ME')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                batchFilter === 'NOTIFY_ME'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200'
              }`}
            >
              Notify Me Waitlist
            </button>
            <button
              type="button"
              onClick={() => handleBatchChange('PRE_ORDER')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                batchFilter === 'PRE_ORDER'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              Pre-order Commitments
            </button>
          </div>
        </div>

        <Table
          columns={columns}
          items={formattedItems}
          loading={tableLoading}
          serverSide={true}
          totalItems={totalItems}
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          searchable={true}
          searchValue={search}
          onSearchChange={handleSearchChange}
          filterable={true}
          filterValue={statusFilter}
          onFilterChange={handleStatusChange}
          filterOptions={[
            { label: 'All Statuses', value: 'ALL' },
            { label: 'Sent', value: 'SENT' },
            { label: 'Pending', value: 'PENDING' },
            { label: 'Processing', value: 'PROCESSING' },
            { label: 'Failed', value: 'FAILED' },
          ]}
          itemsPerPage={10}
        />
      </div>
    </div>
  );
}
