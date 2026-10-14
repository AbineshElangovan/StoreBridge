'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { shopifyFetch } from '@/lib/shopify/Client';
import { Loading } from '@/components/common/Loading';
import { Toast } from '@/components/common/Toast';
import { Table, ColumnConfig } from '@/components/common/Table';
import {
  SettingsCard,
  SettingsToggle,
  SettingsInput,
  SaveButton,
  NotifyMeModalPreview,
} from '@/components/customer-experience/shared';
import { StandaloneGuard } from '@/components/ui/StandaloneGuard';
import { useStoreContext } from '@/components/providers/StoreProvider';

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

export default function NotifyMeAdminPage() {
  const { isStandalone } = useStoreContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Settings state
  const [enabled, setEnabled] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
  const [popupMessage, setPopupMessage] = useState('Get notified when this item is back in stock.');
  const [buttonText, setButtonText] = useState('Notify me');
  const [successMessage, setSuccessMessage] = useState("You're on the list!");
  const [emailSubject, setEmailSubject] = useState('Good news! {{product_title}} is back in stock');

  // Registrations table state (server-side paginated, 10 items per page)
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ totalSubscribers: 0, pending: 0, notified: 0 });

  const loadData = useCallback(async (currentPage = 1, currentStatus = statusFilter, currentSearch = search) => {
    try {
      setTableLoading(true);
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: '10',
      });
      if (currentStatus && currentStatus !== 'ALL') {
        params.set('status', currentStatus);
      }
      if (currentSearch.trim()) {
        params.set('search', currentSearch.trim());
      }

      const res = await shopifyFetch(`/api/notify-me?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        if (data.settings) {
          setEnabled(data.settings.enabled);
          setNotifyEmail(data.settings.notifyEmail);
          setNotifyWhatsApp(data.settings.notifyWhatsApp);
          setPopupMessage(data.settings.popupMessage || 'Get notified when this item is back in stock.');
          setButtonText(data.settings.buttonText || 'Notify me');
          setSuccessMessage(data.settings.successMessage || "You're on the list!");
          setEmailSubject(data.settings.emailSubject || 'Good news! {{product_title}} is back in stock');
        }

        setRegistrations(data.registrations || []);
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
      setToast({ message: 'Error loading Notify Me data', type: 'error' });
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    if (isStandalone) {
      loadData(1, statusFilter, search);
    }
  }, [isStandalone]);

  const handleSaveSettings = async () => {
    if (!notifyEmail) {
      setToast({ message: 'Email restock notifications must be enabled.', type: 'error' });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        enabled,
        notifyEmail,
        notifyWhatsApp,
        popupMessage: popupMessage.trim(),
        buttonText: buttonText.trim(),
        successMessage: successMessage.trim(),
        emailSubject: emailSubject.trim(),
      };

      const res = await shopifyFetch('/api/notify-me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setToast({ message: 'Notify Me settings saved successfully!', type: 'success' });
      } else {
        setToast({ message: data.error || 'Failed to save settings', type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Error saving settings', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setPage(1);
    loadData(1, newStatus, search);
  };

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    setPage(1);
    loadData(1, statusFilter, newSearch);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadData(newPage, statusFilter, search);
  };

  const columns: ColumnConfig[] = [
    {
      title: 'Product & SKU',
      key: 'productInfo',
      type: 'react_node',
      width: '32%',
    },
    {
      title: 'Customer Contact',
      key: 'customerContact',
      type: 'react_node',
      width: '24%',
    },
    {
      title: 'Channel',
      key: 'channels',
      type: 'react_node',
      width: '12%',
    },
    {
      title: 'Quantity',
      key: 'quantityBadge',
      type: 'react_node',
      width: '10%',
    },
    {
      title: 'Status',
      key: 'status',
      type: 'status',
      badgeRules: {
        PENDING: 'warning',
        NOTIFIED: 'success',
        CANCELLED: 'critical',
      },
      width: '10%',
    },
    {
      title: 'Registered Date',
      key: 'formattedDate',
      type: 'text',
      width: '12%',
    },
  ];

  const formattedItems = registrations.map((r) => ({
    ...r,
    productInfo: (
      <div className="flex items-center gap-3 text-left">
        <ProductThumbnail src={r.imageUrl} alt={r.productTitle} />
        <div className="min-w-0">
          <p className="font-bold text-gray-900 text-xs sm:text-sm truncate">
            {r.productTitle || 'Product'}
          </p>
          <p className="text-[11px] text-gray-500 truncate">
            {r.variantTitle && r.variantTitle !== 'Default Title'
              ? r.variantTitle
              : (r.shopifyVariantId ? `Var ID: ${r.shopifyVariantId.replace(/^gid:\/\/shopify\/ProductVariant\//, '')}` : '')}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              SKU: {r.sku || '-'}
            </span>
            <span className="text-[10px] text-gray-400 font-mono">
              ID: {r.shopifyVariantId?.replace(/^gid:\/\/shopify\/ProductVariant\//, '') || '-'}
            </span>
          </div>
        </div>
      </div>
    ),
    customerContact: (
      <div className="space-y-0.5 text-left">
        {r.customerEmail ? (
          <>
            <div className="font-semibold text-gray-900 text-sm truncate">
              {r.customerEmail}
            </div>
            {r.customerWhatsApp && (
              <div className="text-xs text-gray-600 font-mono truncate">{r.customerWhatsApp}</div>
            )}
          </>
        ) : (
          <div className="font-semibold text-gray-900 text-sm font-mono truncate">
            {r.customerWhatsApp || '-'}
          </div>
        )}
      </div>
    ),
    channels: (
      <div className="flex gap-1.5">
        {r.notifyByEmail && (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-sky-100 text-sky-800 border border-sky-200">
            EMAIL
          </span>
        )}
        {r.customerWhatsApp && (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
            PHONE
          </span>
        )}
      </div>
    ),
    quantityBadge: (
      <span className="inline-flex items-center justify-center font-extrabold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-lg text-xs border border-gray-200">
        {r.requestedQuantity || 1} {r.requestedQuantity === 1 ? 'unit' : 'units'}
      </span>
    ),
    formattedDate: new Date(r.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  }));

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <Loading />
      </div>
    );
  }

  return (
    <StandaloneGuard featureName="Notify Me">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full overflow-x-hidden space-y-8">
      {toast && (
        <Toast
          content={toast.message}
          error={toast.type === 'error'}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-gray-200">
        <div>
          <h1 className="page-title text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight m-0">Notify Me</h1>
          <p className="page-subtitle text-lg sm:text-xl font-medium text-slate-500 mt-1.5 m-0">
            Capture interested buyers with an out-of-stock waitlist modal on your storefront product pages.
          </p>
        </div>

        <SaveButton
          onClick={handleSaveSettings}
          loading={saving}
          label="Save Settings"
        />
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Waitlist Registrations</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{stats.totalSubscribers}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Pending Notifications</p>
          <p className="text-2xl font-black text-amber-900 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Restock Alerts Sent</p>
          <p className="text-2xl font-black text-emerald-900 mt-1">{stats.notified}</p>
        </div>
      </div>

      {/* Settings & Live Modal Preview (2 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Settings column */}
        <div className="lg:col-span-7 space-y-6">
          <SettingsCard
            title="Notification Rules & Channels"
            description="Enable customer signup options for out-of-stock products."
          >
            <SettingsToggle
              label="Enable Notify Me Button & Modal"
              description="Displays 'Notify me' button when inventory is at or below threshold."
              checked={enabled}
              onChange={setEnabled}
            />

            <div className="pt-3 border-t border-gray-100 space-y-3">
              <label className="text-sm font-bold text-gray-900 block">Lead Collection & Restock Alerts</label>
              <div className="space-y-2">
                <SettingsToggle
                  label="Email Restock Alerts (Required)"
                  description="Sends restock email notifications when out-of-stock items are replenished."
                  checked={notifyEmail}
                  onChange={setNotifyEmail}
                />
                <SettingsToggle
                  label="Collect Phone Number (Contact)"
                  description="Displays an optional phone number field in the modal to capture customer contact details."
                  checked={notifyWhatsApp}
                  onChange={setNotifyWhatsApp}
                />
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            title="Modal Text Customization"
            description="Customize the copy customers see inside the subscription popup."
          >
            <SettingsInput
              label="Popup Headline Message"
              value={popupMessage}
              onChange={setPopupMessage}
              placeholder="Get notified when this item is back in stock."
            />
            <SettingsInput
              label="Button Text"
              value={buttonText}
              onChange={setButtonText}
              placeholder="Notify me when available"
            />
            <SettingsInput
              label="Success Confirmation Message"
              value={successMessage}
              onChange={setSuccessMessage}
              placeholder="You're on the list!"
            />
          </SettingsCard>

          <SettingsCard
            title="Restock Email Template"
            description="Configure the email subject sent to customers when this product is replenished."
          >
            <SettingsInput
              label="Email Notification Subject"
              value={emailSubject}
              onChange={setEmailSubject}
              placeholder="Good news! {{product_title}} is back in stock"
            />
            <p className="text-xs text-gray-500 mt-1">
              Tip: Use <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded font-mono text-[11px]">&#123;&#123;product_title&#125;&#125;</code> to insert the product title dynamically.
            </p>
          </SettingsCard>
        </div>

        {/* Modal preview column */}
        <div className="lg:col-span-5">
          <NotifyMeModalPreview
            popupMessage={popupMessage}
            buttonText={buttonText}
            successMessage={successMessage}
            notifyEmail={notifyEmail}
            notifyWhatsApp={notifyWhatsApp}
          />
        </div>
      </div>

      {/* Customer Registrations Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Waitlist Registrations</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Customers waiting for items to be restocked. Status remains <strong>PENDING</strong> until the variant inventory is refilled and restock alerts are dispatched. Showing 10 records per page.
            </p>
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
            { label: 'Pending (Waiting)', value: 'PENDING' },
            { label: 'Notified (Alerted)', value: 'NOTIFIED' },
            { label: 'Cancelled', value: 'CANCELLED' },
          ]}
          itemsPerPage={10}
        />
      </div>
    </div>
    </StandaloneGuard>
  );
}
