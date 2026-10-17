'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { shopifyFetch } from '@/lib/shopify/Client';
import { useStoreContext } from '@/components/providers/StoreProvider';
import { useToast } from '@/components/providers/ToastContext';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  productId?: string | null;
  productTitle?: string | null;
  imageUrl?: string | null;
  sku?: string | null;
  isRead: boolean;
  createdAt: string;
  recipientStore?: {
    id: string;
    label?: string | null;
    shopDomain: string;
    isMaster: boolean;
  } | null;
}

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  activeFilter: string;
  setActiveFilter: (filter: string) => void;
  fetchNotifications: (filter?: string, isSilent?: boolean) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  activeFilter: 'ALL',
  setActiveFilter: () => {},
  fetchNotifications: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { currentStore } = useStoreContext();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  // Track discovered notification IDs to detect newly arrived items in real-time
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedOnceRef = useRef<boolean>(false);
  const isInternalFetchRef = useRef<boolean>(false);

  // Derive activeShopDomain safely after mount to avoid SSR/render-time window access
  const [activeShopDomain, setActiveShopDomain] = useState<string | null>(
    currentStore?.shopDomain ?? null
  );

  useEffect(() => {
    if (currentStore?.shopDomain) {
      setActiveShopDomain(currentStore.shopDomain);
      return;
    }
    // Fallback: read from URL or localStorage only on client, after mount
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('shop');
      const fromStorage = localStorage.getItem('storebridge_active_shop');
      setActiveShopDomain(fromUrl || fromStorage || null);
    } catch {
      // ignore
    }
  }, [currentStore?.shopDomain]);

  const activeFilterRef = useRef(activeFilter);
  activeFilterRef.current = activeFilter;

  const fetchNotificationsRef = useRef<((filter?: string, isSilent?: boolean) => Promise<void>) | null>(null);

  const fetchNotifications = useCallback(async (filter?: string, isSilent = false) => {
    const targetFilter = filter ?? activeFilterRef.current;
    if (!isSilent) {
      setLoading(true);
    }

    try {
      const typeParam = targetFilter !== 'ALL' ? `&type=${targetFilter}` : '';
      const shopParam = activeShopDomain ? `&shop=${encodeURIComponent(activeShopDomain)}` : '';
      const timestamp = Date.now();
      const res = await shopifyFetch(`/api/notifications?limit=8${typeParam}${shopParam}&_t=${timestamp}`);

      if (res.ok) {
        const json = await res.json();
        const incomingNotifications: NotificationItem[] = json.notifications || [];
        const incomingUnreadCount: number = json.unreadCount || 0;

        // Detect newly arrived notifications dynamically
        if (hasLoadedOnceRef.current) {
          const known = knownNotificationIdsRef.current;
          const newlyArrived = incomingNotifications.filter(
            (n) => !known.has(n.id) && !n.isRead
          );

          if (newlyArrived.length > 0) {
            // Alert user dynamically with a clean toast notification
            if (newlyArrived.length === 1) {
              const latest = newlyArrived[0];
              showToast(`🔔 ${latest.title}: ${latest.message}`, false, 5000);
            } else {
              showToast(`🔔 ${newlyArrived.length} new notifications received`, false, 5000);
            }

            // Broadcast to other components (like Notifications Page) so they refresh dynamically
            if (typeof window !== 'undefined') {
              isInternalFetchRef.current = true;
              window.dispatchEvent(
                new CustomEvent('notification-updated', { detail: { newlyArrived } })
              );
              setTimeout(() => {
                isInternalFetchRef.current = false;
              }, 100);
            }
          }
        }

        // Register all current IDs
        incomingNotifications.forEach((n) => knownNotificationIdsRef.current.add(n.id));
        hasLoadedOnceRef.current = true;

        setNotifications(incomingNotifications);
        setUnreadCount(incomingUnreadCount);

        // Broadcast count so Bell and Sidebar badges synchronize dynamically
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('notification-count-changed', { detail: incomingUnreadCount })
          );
        }
      } else if (!isSilent) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('[NotificationProvider] Error fetching notifications:', err);
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, [activeShopDomain, showToast]);

  fetchNotificationsRef.current = fetchNotifications;

  // Initial load or filter change
  useEffect(() => {
    fetchNotifications(activeFilter, false);
  }, [activeFilter, fetchNotifications]);

  // Synchronize unreadCount across components (Bell icon, Sidebar badge, Notifications page)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleCountChanged = (e: any) => {
      if (typeof e.detail === 'number') {
        queueMicrotask(() => {
          setUnreadCount(e.detail);
        });
      }
    };

    const handleNotificationUpdated = (e: any) => {
      // Don't re-fetch if this event was dispatched by our own polling/SSE
      if (isInternalFetchRef.current) return;
      if (fetchNotificationsRef.current) {
        fetchNotificationsRef.current(undefined, true);
      }
    };

    window.addEventListener('notification-count-changed', handleCountChanged);
    window.addEventListener('notification-updated', handleNotificationUpdated);

    return () => {
      window.removeEventListener('notification-count-changed', handleCountChanged);
      window.removeEventListener('notification-updated', handleNotificationUpdated);
    };
  }, []);

  // AUTOMATIC BACKGROUND POLLING & SSE REAL-TIME SYNC
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let isDisposed = false;

    // 1. Singleton SSE Setup with Auto-Reconnect
    const setupSSE = () => {
      if (typeof window === 'undefined' || isDisposed) return;
      if (!activeShopDomain) return;

      if (document.hidden) {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        return;
      }

      if (eventSource && eventSource.readyState !== EventSource.CLOSED) return;

      try {
        const shopParam = `?shop=${encodeURIComponent(activeShopDomain)}`;
        const es = new EventSource(`/api/notifications/stream${shopParam}`);
        eventSource = es;

        es.addEventListener('new-notification', () => {
          if (!isDisposed && fetchNotificationsRef.current) {
            // Immediate silent check when stream notifies of a new item
            fetchNotificationsRef.current(undefined, true);
          }
        });

        es.onerror = () => {
          if (es) {
            es.close();
            if (eventSource === es) {
              eventSource = null;
            }
          }
          // Automatically reconnect after 5s if active
          if (!isDisposed && !reconnectTimeout) {
            reconnectTimeout = setTimeout(() => {
              reconnectTimeout = null;
              setupSSE();
            }, 5000);
          }
        };
      } catch (err) {
        // SSE error or unsupported
      }
    };

    // 2. Fallback Polling Loop: Only polls if SSE is not actively connected
    const startPolling = () => {
      if (pollInterval) clearInterval(pollInterval);
      const intervalMs = document.hidden ? 60000 : 45000;
      pollInterval = setInterval(() => {
        if (!isDisposed && fetchNotificationsRef.current) {
          // If SSE connection is open and active, notifications arrive via events — skip HTTP poll
          if (eventSource && eventSource.readyState === EventSource.OPEN) {
            return;
          }
          fetchNotificationsRef.current(undefined, true);
        }
      }, intervalMs);
    };

    // Stagger initial SSE and Polling so initial page load finishes first
    const initTimer = setTimeout(() => {
      setupSSE();
      startPolling();
    }, 1200);

    // 3. Tab Visibility & Window Focus Listeners: Check immediately when user returns (throttled)
    let lastFocusCheckTime = 0;
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const now = Date.now();
        if (now - lastFocusCheckTime > 15000 && fetchNotificationsRef.current) {
          lastFocusCheckTime = now;
          fetchNotificationsRef.current(undefined, true);
        }
        setupSSE();
      }
      startPolling();
    };

    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusCheckTime > 15000 && fetchNotificationsRef.current) {
        lastFocusCheckTime = now;
        fetchNotificationsRef.current(undefined, true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      isDisposed = true;
      clearTimeout(initTimer);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (pollInterval) clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, [activeShopDomain]);

  const markAsRead = async (id: string) => {
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      const nextCount = Math.max(0, unreadCount - 1);
      setUnreadCount(nextCount);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('notification-count-changed', { detail: nextCount })
        );
        isInternalFetchRef.current = true;
        window.dispatchEvent(new CustomEvent('notification-updated'));
        setTimeout(() => {
          isInternalFetchRef.current = false;
        }, 100);
      }
      const shopParam = activeShopDomain ? `?shop=${encodeURIComponent(activeShopDomain)}` : '';
      await shopifyFetch(`/api/notifications/${id}/read${shopParam}`, { method: 'PUT' });
    } catch (err) {
      console.error('[NotificationProvider] Error marking read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('notification-count-changed', { detail: 0 })
        );
        isInternalFetchRef.current = true;
        window.dispatchEvent(new CustomEvent('notification-updated'));
        setTimeout(() => {
          isInternalFetchRef.current = false;
        }, 100);
      }
      const shopParam = activeShopDomain ? `?shop=${encodeURIComponent(activeShopDomain)}` : '';
      await shopifyFetch(`/api/notifications${shopParam}`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'markAllRead' }),
      });
    } catch (err) {
      console.error('[NotificationProvider] Error marking all read:', err);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        activeFilter,
        setActiveFilter,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
