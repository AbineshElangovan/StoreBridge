'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@shopify/polaris';
import { CheckIcon, RefreshIcon } from '@shopify/polaris-icons';
import { shopifyFetch } from '@/lib/shopify/Client';

interface NotificationItem {
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

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

function getTypeStyle(type: string) {
  switch (type) {
    case 'OUT_OF_STOCK':
      return { icon: '🚫', label: 'Out of Stock', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' };
    case 'LOW_STOCK':
    case 'STOCKOUT_RISK':
      return { icon: '🔴', label: 'Low Stock', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' };
    case 'CONNECTED_STORE_UPDATE':
      return { icon: '🏬', label: 'Store Update', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' };
    case 'INVENTORY_UPDATE':
      return { icon: '📦', label: 'Inventory', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' };
    case 'PRICE_UPDATE':
      return { icon: '💰', label: 'Price Update', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' };
    case 'SYNC_UPDATE':
      return { icon: '🔄', label: 'Sync Completed', bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700' };
    case 'SYNC_FAILURE':
      return { icon: '⚠️', label: 'Sync Failure', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' };
    default:
      return { icon: '🔔', label: 'Product Update', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' };
  }
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const searchParams = useSearchParams();
  const shop = searchParams.get('shop');
  const host = searchParams.get('host');

  const createHref = (basePath: string) => {
    const queryParams = new URLSearchParams();
    if (shop) queryParams.set('shop', shop);
    if (host) queryParams.set('host', host);
    const queryString = queryParams.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const fetchNotifications = async (filter = activeFilter) => {
    setLoading(true);
    try {
      const typeParam = filter !== 'ALL' ? `&type=${filter}` : '';
      const shopParam = shop ? `&shop=${encodeURIComponent(shop)}` : '';
      const res = await shopifyFetch(`/api/notifications?limit=8${typeParam}${shopParam}`);
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.notifications || []);
        const unread = json.unreadCount || 0;
        setUnreadCount(unread);
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('notification-count-changed', { detail: unread }));
          }, 0);
        }
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('[NotificationBell] Error fetching notifications:', err);
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(activeFilter);

    const handleNotificationUpdate = () => fetchNotifications(activeFilter);
    window.addEventListener('notification-updated', handleNotificationUpdate);

    // Real-Time Server-Sent Events (SSE) Stream
    let eventSource: EventSource | null = null;
    try {
      const shopParam = shop ? `?shop=${encodeURIComponent(shop)}` : '';
      eventSource = new EventSource(`/api/notifications/stream${shopParam}`);

      eventSource.addEventListener('new-notification', (e: any) => {
        try {
          const newNotif = JSON.parse(e.data);
          setNotifications((prev) => {
            if (prev.some((n) => n.id === newNotif.id)) return prev;
            return [newNotif, ...prev];
          });
          setUnreadCount((prev) => {
            const nextCount = prev + 1;
            setTimeout(() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('notification-count-changed', { detail: nextCount }));
              }
            }, 0);
            return nextCount;
          });
        } catch (err) {
          console.error('[Notification SSE] Parse error:', err);
        }
      });
    } catch (err) {
      console.error('[Notification SSE] Connection error:', err);
    }

    return () => {
      window.removeEventListener('notification-updated', handleNotificationUpdate);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [activeFilter, shop]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const notifyChange = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notification-updated'));
    }
  };

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      notifyChange();

      await shopifyFetch(`/api/notifications/${id}/read`, { method: 'PUT' });
    } catch (err) {
      console.error('[NotificationBell] Error marking read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      notifyChange();

      await shopifyFetch('/api/notifications', {
        method: 'PUT',
        body: JSON.stringify({ action: 'markAllRead' }),
      });
    } catch (err) {
      console.error('[NotificationBell] Error marking all read:', err);
    }
  };

  const filterTabs = [
    { label: 'All', value: 'ALL' },
    { label: 'Products', value: 'PRODUCT_UPDATED' },
    { label: 'Low Stock', value: 'LOW_STOCK' },
    { label: 'Out of Stock', value: 'OUT_OF_STOCK' },
    { label: 'Inventory', value: 'INVENTORY_UPDATE' },
    { label: 'Price', value: 'PRICE_UPDATE' },
    { label: 'Connected', value: 'CONNECTED_STORE_UPDATE' },
    { label: 'Sync', value: 'SYNC_UPDATE' },
    { label: 'Failures', value: 'SYNC_FAILURE' },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications(activeFilter);
        }}
        className="relative w-10 h-10 bg-[#0db69d] hover:bg-[#0b9c87] text-white border border-[#0db69d]/40 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-[#0db69d]/50 flex items-center justify-center shadow-xs cursor-pointer"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {/* Only render badge if unreadCount > 0 */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px]">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-extrabold rounded-full items-center justify-center shadow-sm border border-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Notifications Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-84 sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-200 z-50 overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-top-2">
          {/* Header with Title, Refresh & Read All */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-teal-100 text-teal-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchNotifications(activeFilter)}
                title="Refresh notifications"
                className={`p-1 text-gray-500 hover:text-gray-900 rounded hover:bg-gray-200/60 transition-colors ${
                  loading ? 'animate-spin text-teal-600' : ''
                }`}
              >
                <div style={{ width: 14, height: 14 }}>
                  <Icon source={RefreshIcon} />
                </div>
              </button>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-teal-600 hover:text-teal-800 font-semibold transition-colors flex items-center gap-1"
                >
                  ✓ Read all
                </button>
              )}
            </div>
          </div>

          {/* Type Filter Pills */}
          <div className="px-3 py-2 bg-white border-b border-gray-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {filterTabs.map((tab) => {
              const active = activeFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => {
                    setActiveFilter(tab.value);
                    fetchNotifications(tab.value);
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-teal-700 text-white shadow-2xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200/70 hover:text-gray-800'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* List of Notifications */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
            {loading && notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-xs flex items-center justify-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-xs">
                No notifications right now.
              </div>
            ) : (
              notifications.map((item) => {
                const style = getTypeStyle(item.type);
                const storeName = item.recipientStore?.label || item.recipientStore?.shopDomain || '';
                return (
                  <div
                    key={item.id}
                    className={`p-3 flex items-start gap-3 transition-colors hover:bg-gray-50 cursor-pointer ${
                      !item.isRead ? 'bg-teal-50/40' : ''
                    }`}
                    onClick={() => {
                      if (!item.isRead) handleMarkAsRead(item.id);
                    }}
                  >
                    <div className={`p-1.5 rounded-lg text-sm border flex-shrink-0 ${style.bg} ${style.border}`}>
                      {style.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`text-xs font-bold truncate ${!item.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                          {item.title}
                        </span>
                        {!item.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0" title="Unread" />
                        )}
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-gray-400">
                        {storeName && (
                          <span className="font-semibold text-gray-500 truncate max-w-[120px]">
                            {storeName}
                          </span>
                        )}
                        {storeName && <span>•</span>}
                        <span>{getRelativeTime(item.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Link & Refresh */}
          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => fetchNotifications(activeFilter)}
              className="text-xs text-gray-600 hover:text-gray-900 font-medium flex items-center gap-1"
            >
              <div style={{ width: 13, height: 13 }}>
                <Icon source={RefreshIcon} />
              </div>
              Refresh
            </button>

            <Link
              href={createHref('/dashboard/notifications')}
              onClick={() => setIsOpen(false)}
              className="text-xs text-teal-700 hover:text-teal-900 font-bold hover:underline inline-flex items-center gap-1"
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
