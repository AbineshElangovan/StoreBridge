'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { shopifyFetch } from '@/lib/shopify/Client';
import { Loading } from '@/components/common/Loading';
import { Toast } from '@/components/common/Toast';
import { Table, ColumnConfig } from '@/components/common/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  SettingsCard,
  SettingsToggle,
  SettingsInput,
  SettingsTextarea,
  SaveButton,
  NotifyMeModalPreview,
} from '@/components/customer-experience/shared';

export default function NotifyMeAdminPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Settings state
  const [enabled, setEnabled] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
  const [popupMessage, setPopupMessage] = useState('Get notified when this item is back in stock.');
  const [buttonText, setButtonText] = useState('Notify me when available');
  const [successMessage, setSuccessMessage] = useState("You're on the list!");

  // Registrations table state (server-side paginated)
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
        pageSize: '15',
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
          setButtonText(data.settings.buttonText || 'Notify me when available');
          setSuccessMessage(data.settings.successMessage || "You're on the list!");
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
    loadData(1, statusFilter, search);
  }, []);

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
      title: 'Customer Contact',
      key: 'customerContact',
      type: 'react_node',
      width: '30%',
    },
    {
      title: 'Channels',
      key: 'channels',
      type: 'react_node',
      width: '20%',
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
      width: '15%',
    },
    {
      title: 'Registered Date',
      key: 'formattedDate',
      type: 'text',
      width: '20%',
    },
    {
      title: 'Variant ID',
      key: 'shortVariant',
      type: 'text',
      width: '15%',
    },
  ];

  const formattedItems = registrations.map((r) => ({
    ...r,
    customerContact: (
      <div>
        {r.customerEmail && <div className="font-semibold text-gray-900 text-sm">{r.customerEmail}</div>}
        {r.customerWhatsApp && <div className="text-xs text-gray-500 font-mono">📱 {r.customerWhatsApp}</div>}
      </div>
    ),
    channels: (
      <div className="flex gap-1.5">
        {r.notifyByEmail && (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
            EMAIL
          </span>
        )}
        {r.customerWhatsApp && (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            PHONE LEAD
          </span>
        )}
      </div>
    ),
    formattedDate: new Date(r.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    shortVariant: r.shopifyVariantId?.replace(/^gid:\/\/shopify\/ProductVariant\//, '') || '-',
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Notify Me</h1>
            <StatusBadge
              status={enabled ? 'success' : 'default'}
              label={enabled ? 'ACTIVE' : 'DISABLED'}
            />
          </div>
          <p className="text-sm text-gray-500 mt-1">
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
                  label="Collect WhatsApp / Phone (Lead Only)"
                  description="Displays an optional WhatsApp / phone number field in the modal to capture customer leads (no WhatsApp messages sent)."
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
              Customers waiting for variants to be restocked. Showing 15 records per page.
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
            { label: 'Pending', value: 'PENDING' },
            { label: 'Notified', value: 'NOTIFIED' },
            { label: 'Cancelled', value: 'CANCELLED' },
          ]}
          itemsPerPage={15}
        />
      </div>
    </div>
  );
}
