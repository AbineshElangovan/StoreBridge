'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { shopifyFetch } from '@/lib/shopify/Client';
import { useStoreContext } from '@/components/providers/StoreProvider';

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
  fetchNotifications: (filter?: string) => Promise<void>;
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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  const activeShopDomain = currentStore?.shopDomain;
  const activeFilterRef = React.useRef(activeFilter);
  activeFilterRef.current = activeFilter;

  const fetchNotificationsRef = React.useRef<((filter?: string) => Promise<void>) | null>(null);

  const fetchNotifications = useCallback(async (filter?: string) => {
    const targetFilter = filter ?? activeFilterRef.current;
    setLoading(true);
    try {
      const typeParam = targetFilter !== 'ALL' ? `&type=${targetFilter}` : '';
      const shopParam = activeShopDomain ? `&shop=${encodeURIComponent(activeShopDomain)}` : '';
      const res = await shopifyFetch(`/api/notifications?limit=8${typeParam}${shopParam}`);
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.notifications || []);
        setUnreadCount(json.unreadCount || 0);
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('[NotificationProvider] Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [activeShopDomain]);

  fetchNotificationsRef.current = fetchNotifications;

  useEffect(() => {
    fetchNotifications(activeFilter);
  }, [activeFilter, fetchNotifications]);

  // SINGLETON SSE LIFECYCLE: Exactly 1 EventSource connection across the entire application
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isDisposed = false;

    const setupSSE = () => {
      if (typeof window === 'undefined' || isDisposed) return;
      if (!activeShopDomain) return; // Prevent connecting before active shop domain is identified
      if (document.hidden) {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        return;
      }
      if (eventSource) return;

      try {
        const shopParam = `?shop=${encodeURIComponent(activeShopDomain)}`;
        eventSource = new EventSource(`/api/notifications/stream${shopParam}`);

        eventSource.addEventListener('new-notification', () => {
          if (!isDisposed && fetchNotificationsRef.current) {
            fetchNotificationsRef.current();
          }
        });

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
        };
      } catch (err) {
        // SSE error or unsupported
      }
    };

    // Stagger SSE connection by 1000ms so initial HTML and API data load first
    const initTimer = setTimeout(setupSSE, 1000);

    const handleVisibilityChange = () => {
      setupSSE();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isDisposed = true;
      clearTimeout(initTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
      setUnreadCount((prev) => Math.max(0, prev - 1));
      await shopifyFetch(`/api/notifications/${id}/read`, { method: 'PUT' });
    } catch (err) {
      console.error('[NotificationProvider] Error marking read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      await shopifyFetch('/api/notifications', {
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
