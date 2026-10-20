'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { shopifyFetch } from '@/lib/shopify/Client';
import { PageLoader } from '@/components/common/PageLoader';
import { Loading } from '@/components/common';
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  EmptyState,
  Banner,
  Box,
  Button,
  Icon,
} from '@shopify/polaris';
import { SettingsIcon } from '@shopify/polaris-icons';
import { Pagination } from '@/components/common/Pagination';
import { Toast } from '@/components/common/Toast';
import { ConfirmToast } from '@/components/ui/ConfirmToast';
import {
  NotificationCard,
  NotificationFilters,
  NotificationPreferencesModal,
  NotificationItem,
} from '@/components/notifications';

import { useStoreContext } from '@/components/providers/StoreProvider';
import { useToast } from '@/components/providers/ToastContext';

interface StoreOption {
  label: string;
  value: string;
}

export default function NotificationsPage() {
  const { currentStore, isMaster, isStandalone } = useStoreContext();
  const { showSuccess, showError } = useToast();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [storeFilter, setStoreFilter] = useState('ALL');
  const [storeOptions, setStoreOptions] = useState<StoreOption[]>([]);

  // Modals & Dialogs
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deletingNotification, setDeletingNotification] = useState<NotificationItem | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);

  // Preferences State
  const [preferences, setPreferences] = useState({
    notifyLowStock: true,
    notifyInventoryUpdate: true,
    notifyPriceUpdate: true,
    notifySyncUpdate: true,
    notifySyncFailure: true,
    notifyStoreUpdate: true,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSuccess, setPrefsSuccess] = useState(false);

  // Fetch store options - only if current store is Master
  useEffect(() => {
    if (!isMaster) {
      setStoreOptions([]);
      return;
    }

    const fetchStores = async () => {
      try {
        const res = await shopifyFetch('/api/stores');
        if (res.ok) {
          const data = await res.json();
          const stores = data.stores || [];
          const options: StoreOption[] = [{ label: 'All stores', value: 'ALL' }];
          stores.forEach((s: any) => {
            if (!s.isStandalone) {
              options.push({
                label: s.label || s.shopDomain || s.id,
                value: s.id,
              });
            }
          });
          setStoreOptions(options);
        }
      } catch (err) {
        console.error('[NotificationsPage] Error fetching stores:', err);
      }
    };
    fetchStores();
  }, [isMaster]);

  // Fetch Preferences
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const res = await shopifyFetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            setPreferences({
              notifyLowStock: data.settings.notifyLowStock ?? true,
              notifyInventoryUpdate: data.settings.notifyInventoryUpdate ?? true,
              notifyPriceUpdate: data.settings.notifyPriceUpdate ?? true,
              notifySyncUpdate: data.settings.notifySyncUpdate ?? true,
              notifySyncFailure: data.settings.notifySyncFailure ?? true,
              notifyStoreUpdate: data.settings.notifyStoreUpdate ?? true,
            });
          }
        }
      } catch (err) {
        console.error('[NotificationsPage] Error fetching preferences:', err);
      }
    };
    fetchPreferences();
  }, []);

  const activeShopDomain = currentStore?.shopDomain;

  // Load Notifications
  const loadNotifications = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '10');
      if (activeShopDomain) params.append('shop', activeShopDomain);
      if (typeFilter && typeFilter !== 'ALL') params.append('type', typeFilter);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (storeFilter) params.append('storeId', storeFilter);
      params.append('_t', Date.now().toString());

      const res = await shopifyFetch(`/api/notifications?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setTotalCount(data.total || 0);
        const unread = data.unreadCount || 0;
        setUnreadCount(unread);
        setTotalPages(data.totalPages || 1);
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('notification-count-changed', { detail: unread }));
          }, 0);
        }
      } else if (!isSilent) {
        setNotifications([]);
      }
    } catch (err) {
      console.error('[NotificationsPage] Error loading notifications:', err);
      if (!isSilent) setNotifications([]);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [page, typeFilter, statusFilter, storeFilter, activeShopDomain]);

  const isLocalActionRef = React.useRef(false);

  useEffect(() => {
    loadNotifications(false);

    const handleUpdate = () => {
      if (isLocalActionRef.current) return;
      loadNotifications(true);
    };
    window.addEventListener('notification-updated', handleUpdate);

    return () => {
      window.removeEventListener('notification-updated', handleUpdate);
    };
  }, [loadNotifications]);

  // Dispatch custom window event so Bell icon and Sidebar synchronize dynamically
  const notifyBellUpdate = (newCount?: number) => {
    if (typeof window !== 'undefined') {
      isLocalActionRef.current = true;
      setTimeout(() => {
        if (typeof newCount === 'number') {
          window.dispatchEvent(new CustomEvent('notification-count-changed', { detail: newCount }));
        }
        window.dispatchEvent(new CustomEvent('notification-updated'));
        setTimeout(() => {
          isLocalActionRef.current = false;
        }, 100);
      }, 0);
    }
  };

  // Mark single notification as read
  const handleMarkAsRead = async (id: string) => {
    try {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      const nextUnread = Math.max(0, unreadCount - 1);
      setUnreadCount(nextUnread);
      notifyBellUpdate(nextUnread);

      await shopifyFetch(`/api/notifications/${id}/read`, { method: 'PUT' });
    } catch (err) {
      console.error('[NotificationsPage] Error marking as read:', err);
      loadNotifications();
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      notifyBellUpdate(0);

      const res = await shopifyFetch('/api/notifications', {
        method: 'PUT',
        body: JSON.stringify({ action: 'markAllRead' }),
      });

      if (res.ok) {
        showSuccess('All notifications marked as read');
      }
    } catch (err) {
      console.error('[NotificationsPage] Error marking all as read:', err);
      loadNotifications();
    }
  };

  // Request confirmation to delete single notification
  const handleDeleteNotification = (id: string) => {
    const item = notifications.find((n) => n.id === id);
    if (item) {
      setDeletingNotification(item);
    }
  };

  // Perform confirmed deletion of single notification
  const handleConfirmDeleteSingle = async () => {
    if (!deletingNotification) return;
    const id = deletingNotification.id;
    setIsDeletingSingle(true);
    try {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotalCount((c) => Math.max(0, c - 1));
      const res = await shopifyFetch(`/api/notifications?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        showSuccess('Notification deleted');
        notifyBellUpdate();
        setDeletingNotification(null);
      } else {
        const errJson = await res.json().catch(() => ({}));
        showError(errJson.error || 'Failed to delete notification');
        loadNotifications();
      }
    } catch (err: any) {
      console.error('[NotificationsPage] Error deleting notification:', err);
      showError(err?.message || 'Network error deleting notification');
      loadNotifications();
    } finally {
      setIsDeletingSingle(false);
    }
  };

  // Delete all notifications
  const handleDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
      const res = await shopifyFetch('/api/notifications', { method: 'DELETE' });
      if (res.ok) {
        setNotifications([]);
        setTotalCount(0);
        setUnreadCount(0);
        showSuccess('All notifications deleted successfully');
        notifyBellUpdate();
      } else {
        const data = await res.json();
        showError(data.error || 'Failed to delete notifications');
      }
    } catch (err) {
      console.error('[NotificationsPage] Error deleting all:', err);
      showError('Network error deleting all notifications');
    } finally {
      setIsDeletingAll(false);
      setShowDeleteAllConfirm(false);
    }
  };

  // Save Preferences
  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    setPrefsSuccess(false);
    try {
      const res = await shopifyFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(preferences),
      });

      if (res.ok) {
        setPrefsSuccess(true);
        showSuccess('Preferences saved successfully');
        setTimeout(() => {
          setIsPreferencesOpen(false);
          setPrefsSuccess(false);
        }, 1200);
      } else {
        const errorData = await res.json();
        showError(errorData.error || 'Failed to save preferences');
      }
    } catch (err: any) {
      showError(err.message || 'Error saving preferences');
    } finally {
      setSavingPrefs(false);
    }
  };

  if (loading && notifications.length === 0) {
    return <Loading label="Loading notifications..." />;
  }

  return (
    <Page>
      {/* Custom Green Themed Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight m-0">
            Notifications
          </h1>
          <p className="page-subtitle text-lg sm:text-xl font-medium text-slate-500 mt-1.5 m-0">
            Real-time alerts for inventory updates, stock thresholds, and store sync events.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsPreferencesOpen(true)}
            className="notification-pref-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[var(--color-primary,#047857)] hover:bg-[var(--color-primary-dark,#022c22)] transition-colors cursor-pointer shadow-xs"
          >
            <div style={{ width: 14, height: 14 }} className="text-white fill-white [&_svg]:fill-white [&_path]:fill-white flex items-center justify-center shrink-0">
              <Icon source={SettingsIcon} tone="inherit" />
            </div>
            <span className="text-white">Notification Preferences</span>
          </button>
        </div>
      </div>

      <ConfirmToast
        open={showDeleteAllConfirm}
        message={`Delete all ${totalCount} notifications?`}
        subMessage="This action will permanently delete all alerts for this store."
        confirmLabel="Delete All"
        cancelLabel="Cancel"
        variant="danger"
        loading={isDeletingAll}
        onConfirm={async () => {
          setShowDeleteAllConfirm(false);
          await handleDeleteAll();
        }}
        onCancel={() => setShowDeleteAllConfirm(false)}
      />

      <ConfirmToast
        open={Boolean(deletingNotification)}
        message="Delete this notification?"
        subMessage={deletingNotification?.title || "This alert will be permanently removed."}
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={isDeletingSingle}
        onConfirm={handleConfirmDeleteSingle}
        onCancel={() => setDeletingNotification(null)}
      />

      <Layout>
        {/* Top Filters & Search Section */}
        <Layout.Section>
          <NotificationFilters
            typeFilter={typeFilter}
            onTypeChange={(t) => {
              setTypeFilter(t);
              setPage(1);
            }}
            statusFilter={statusFilter}
            onStatusChange={(s) => {
              setStatusFilter(s);
              setPage(1);
            }}
            storeFilter={storeFilter}
            onStoreChange={(st) => {
              setStoreFilter(st);
              setPage(1);
            }}
            storeOptions={storeOptions}
            onRefresh={loadNotifications}
            isRefreshing={loading}
            unreadCount={unreadCount}
            totalCount={totalCount}
            onMarkAllRead={handleMarkAllRead}
            onOpenDeleteAllModal={() => setShowDeleteAllConfirm(true)}
          />
        </Layout.Section>

        {/* Main Notifications List Section */}
        <Layout.Section>
          {loading && notifications.length === 0 ? (
            <Box padding="800">
              <PageLoader />
            </Box>
          ) : notifications.length === 0 ? (
            <Card>
              <EmptyState
                heading="No notifications found"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  {typeFilter !== 'ALL' || statusFilter !== 'all' || storeFilter !== 'ALL'
                    ? 'Try adjusting your filters.'
                    : 'You are all caught up! No notifications right now.'}
                </p>
              </EmptyState>
            </Card>
          ) : (
            <div className={loading ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
              <BlockStack gap="300">
                {notifications.map((item) => (
                  <NotificationCard
                    key={item.id}
                    item={item}
                    onMarkAsRead={handleMarkAsRead}
                    onDelete={handleDeleteNotification}
                  />
                ))}

                {/* Reusable Pagination Controls */}
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  className="py-4"
                />
              </BlockStack>
            </div>
          )}
        </Layout.Section>
      </Layout>

      {/* Preferences Modal */}
      <NotificationPreferencesModal
        open={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
        prefs={preferences}
        onChange={setPreferences}
        onSave={handleSavePreferences}
        saving={savingPrefs}
        saveSuccess={prefsSuccess}
      />
    </Page>
  );
}
