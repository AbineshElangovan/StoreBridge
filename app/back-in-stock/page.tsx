'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { shopifyFetch } from '@/lib/shopify/Client';
import { Loading } from '@/components/common/Loading';
import { Toast } from '@/components/common/Toast';
import { Table, ColumnConfig } from '@/components/common/Table';
import { Icon } from '@shopify/polaris';
import {
  EmailIcon,
  ChatIcon,
  NotificationIcon,
  CheckIcon,
  AlertCircleIcon,
  StoreIcon,
  CartIcon,
} from '@shopify/polaris-icons';

export default function BackInStockAdminPage() {
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const loadData = useCallback(async (
    currentPage = 1,
    currentStatus = statusFilter,
    currentChannel = channelFilter,
    currentSearch = search
  ) => {
    try {
      setTableLoading(true);
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: '15',
      });
      if (currentStatus && currentStatus !== 'ALL') {
        params.set('status', currentStatus);
      }
      if (currentChannel && currentChannel !== 'ALL') {
        params.set('channel', currentChannel);
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
  }, [statusFilter, channelFilter, search]);

  useEffect(() => {
    loadData(1, statusFilter, channelFilter, search);
    // Fetch stores for multi-store template preview
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

  const handleRetry = async (jobId: string) => {
    try {
      setRetryingId(jobId);
      const res = await shopifyFetch('/api/back-in-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry', jobId }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ message: 'Notification retry initiated successfully!', type: 'success' });
        loadData(page, statusFilter, channelFilter, search);
      } else {
        setToast({ message: data.error || 'Retry failed', type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Error executing retry', type: 'error' });
    } finally {
      setRetryingId(null);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setPage(1);
    loadData(1, newStatus, channelFilter, search);
  };

  const handleChannelChange = (newChannel: string) => {
    setChannelFilter(newChannel);
    setPage(1);
    loadData(1, statusFilter, newChannel, search);
  };

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    setPage(1);
    loadData(1, statusFilter, channelFilter, newSearch);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadData(newPage, statusFilter, channelFilter, search);
  };

  const columns: ColumnConfig[] = [
    {
      title: 'Product / Variant',
      key: 'productInfo',
      type: 'react_node',
      width: '28%',
    },
    {
      title: 'Recipient',
      key: 'recipient',
      type: 'text',
      width: '22%',
    },
    {
      title: 'Channel',
      key: 'channelBadge',
      type: 'react_node',
      width: '12%',
    },
    {
      title: 'Status',
      key: 'status',
      type: 'status',
      badgeRules: {
        SENT: 'success',
        PENDING: 'warning',
        PROCESSING: 'info',
        FAILED: 'critical',
      },
      width: '12%',
    },
    {
      title: 'Sent At',
      key: 'formattedSentAt',
      type: 'text',
      width: '14%',
    },
    {
      title: 'Actions',
      key: 'actions',
      type: 'react_node',
      width: '12%',
    },
  ];

  const formattedItems = jobs.map((job) => ({
    ...job,
    productInfo: (
      <div className="flex items-center gap-3">
        {job.imageUrl && (
          <img
            src={job.imageUrl}
            alt=""
            className="w-9 h-9 rounded-lg object-cover border border-gray-200 shrink-0"
          />
        )}
        <div className="min-w-0">
          <p className="font-bold text-gray-900 text-xs sm:text-sm truncate">{job.productTitle}</p>
          <p className="text-[11px] text-gray-500 truncate">
            {job.variantTitle && job.variantTitle !== 'Default Title' ? job.variantTitle : `ID: ${job.shopifyVariantId}`}
          </p>
        </div>
      </div>
    ),
    recipient: job.customerEmail || job.customerWhatsApp || '-',
    channelBadge: (
      <span
        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
          job.channel === 'EMAIL'
            ? 'bg-sky-100 text-sky-800 border border-sky-300'
            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
        }`}
      >
        {job.channel}
      </span>
    ),
    formattedSentAt: job.sentAt
      ? new Date(job.sentAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '-',
    actions: job.status === 'FAILED' ? (
      <button
        type="button"
        disabled={retryingId === job.id}
        onClick={() => handleRetry(job.id)}
        className="px-2.5 py-1 text-xs font-bold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-all cursor-pointer disabled:opacity-50"
      >
        {retryingId === job.id ? 'Retrying...' : 'Retry'}
      </button>
    ) : null,
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
            Real-time restock triggers and customer notification dispatch logs.
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

      {/* NOTIFICATION TEMPLATE SECTION (EMAIL) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 text-gray-800">
                <Icon source={EmailIcon} />
              </div>
              <h2 className="text-lg font-black text-gray-900 tracking-tight">Restock Email Template</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Automated email notification sent to customers when out-of-stock items are replenished. Select a store to preview.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Store Switcher for Template Preview ("same like all store") */}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 shadow-2xs">
              <div className="w-4 h-4 text-gray-500">
                <Icon source={StoreIcon} />
              </div>
              <span className="text-xs font-bold text-gray-500">Preview Store:</span>
              <select
                aria-label="Preview Store"
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="text-xs font-bold text-gray-900 bg-transparent outline-none cursor-pointer"
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
          </div>
        </div>

        {/* TEMPLATE PREVIEW CONTENT */}
        <div className="p-6 bg-gray-50/50">
          {/* EMAIL TEMPLATE PREVIEW */}
          <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
              {/* Email Client Header Bar */}
              <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 text-gray-300">
                    <Icon source={StoreIcon} />
                  </div>
                  <span className="font-extrabold text-sm tracking-tight">{previewStoreName}</span>
                </div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400 bg-gray-800 px-2.5 py-1 rounded-full border border-gray-700">
                  Powered by StoreBridge
                </div>
              </div>

              {/* Urgency Ribbon with Polaris Alert Icon (No Emoji) */}
              <div className="bg-red-600 text-white text-xs font-black uppercase tracking-wider py-2.5 px-4 flex items-center justify-center gap-2">
                <div className="w-3.5 h-3.5">
                  <Icon source={AlertCircleIcon} />
                </div>
                <span>Urgent: Back in Stock &bull; Only a Few Available</span>
              </div>

              {/* Email Content Body */}
              <div className="p-8 text-center space-y-6">
                <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 flex items-center justify-center text-gray-900 border border-gray-200">
                  <div className="w-6 h-6">
                    <Icon source={NotificationIcon} />
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-extrabold text-gray-950">Cotton T-shirt (White / L) is Available!</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Good news! The item you were waiting for at <strong className="text-gray-900">{previewStoreName}</strong> is back in stock.
                  </p>
                </div>

                {/* Urgency Box with Polaris Alert Icon */}
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center max-w-md mx-auto space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-red-700">
                    <div className="w-3.5 h-3.5">
                      <Icon source={AlertCircleIcon} />
                    </div>
                    <span>Urgent &mdash; Only Few Quantities in Stock!</span>
                  </div>
                  <p className="text-[11px] text-red-600 font-medium leading-relaxed">
                    Stock is strictly limited and selling fast. Come and get yours now before it runs out again!
                  </p>
                </div>

                {/* Product Box */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 max-w-md mx-auto space-y-4">
                  {/* Product Image */}
                  <div className="w-36 h-36 mx-auto bg-white rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden p-2">
                    <img
                      src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-lifestyle-1_large.png"
                      alt="Cotton T-shirt"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-gray-900">Cotton T-shirt</h4>
                    <span className="inline-block mt-1 text-[11px] font-semibold text-gray-600 bg-gray-200 px-2.5 py-0.5 rounded-full">
                      Variant: White / L
                    </span>
                  </div>

                  {/* Shop Now Button */}
                  <div>
                    <a
                      href={previewStoreProductUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 bg-gray-900 hover:bg-black text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-[0.99]"
                    >
                      <div className="w-4 h-4">
                        <Icon source={CartIcon} />
                      </div>
                      <span>Shop Now &rarr;</span>
                    </a>
                  </div>

                  <p className="text-[10px] text-gray-400 font-medium">
                    Direct checkout at {previewStoreName} ({previewStoreDomain})
                  </p>
                </div>

                {/* Email Footer */}
                <div className="pt-6 border-t border-gray-100 text-[11px] text-gray-400 space-y-1">
                  <p>You received this restock alert because you requested a notification on {previewStoreName}.</p>
                  <p className="font-semibold text-gray-500">
                    &copy; {new Date().getFullYear()} {previewStoreName} &bull; Powered by StoreBridge Customer Experience
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Activity / Notification History Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Recent Restock Notifications</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Automated alerts triggered when variant inventory transitions from 0 to positive.
            </p>
          </div>

          {/* Secondary channel filter buttons */}
          <div className="flex gap-2">
            {['ALL', 'EMAIL'].map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => handleChannelChange(ch)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                  channelFilter === ch
                    ? 'bg-gray-900 text-white border-gray-900 shadow-xs'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {ch === 'ALL' ? 'All Channels' : ch}
              </button>
            ))}
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
          itemsPerPage={15}
        />
      </div>
    </div>
  );
}
