'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@shopify/polaris';
import { 
  CheckIcon, 
  RefreshIcon, 
  AlertTriangleIcon, 
  StoreIcon, 
  ProductIcon, 
  CashDollarIcon, 
  AlertCircleIcon, 
  NotificationIcon,
  OrderIcon,
} from '@shopify/polaris-icons';
import { useNotifications, NotificationItem } from '@/components/providers/NotificationContext';
import { useStoreContext } from '@/components/providers/StoreProvider';
import { useTheme } from '@/components/providers/ThemeContext';
import { RefreshButton } from '@/components/common/RefreshButton';

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

function getTypeStyle(type: string, title?: string, metadata?: any) {
  if (
    title?.toLowerCase().includes('pre-order') ||
    title?.toLowerCase().includes('stock allocated') ||
    metadata?.eventType?.startsWith?.('PREORDER_')
  ) {
    return {
      icon: <Icon source={OrderIcon} tone="magic" />,
      label: 'Pre-order',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-700',
    };
  }

  switch (type) {
    case 'OUT_OF_STOCK':
    case 'STOCKOUT_RISK':
    case 'LOW_STOCK':
      return { 
        icon: <Icon source={AlertTriangleIcon} tone="warning" />,
        label: 'Stock Alert', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' 
      };
    case 'CONNECTED_STORE_UPDATE':
      return { 
        icon: <Icon source={StoreIcon} tone="subdued" />,
        label: 'Store Update', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' 
      };
    case 'INVENTORY_UPDATE':
      return { 
        icon: <Icon source={ProductIcon} tone="subdued" />,
        label: 'Inventory', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' 
      };
    case 'PRICE_UPDATE':
      return { 
        icon: <Icon source={CashDollarIcon} tone="success" />,
        label: 'Price Update', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' 
      };
    case 'SYNC_UPDATE':
      return { 
        icon: <Icon source={RefreshIcon} tone="info" />,
        label: 'Sync Completed', bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700' 
      };
    case 'SYNC_FAILURE':
      return { 
        icon: <Icon source={AlertCircleIcon} tone="critical" />,
        label: 'Sync Failure', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' 
      };
    default:
      return { 
        icon: <Icon source={NotificationIcon} tone="subdued" />,
        label: 'Product Update', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' 
      };
  }
}

export function NotificationBell() {
  const { isStandalone } = useStoreContext();
  const { currentTheme } = useTheme();
  const primaryColor = currentTheme?.primaryColor || '#0db69d';
  const darkColor = currentTheme?.darkColor || '#142403';
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const {
    notifications,
    unreadCount,
    loading,
    activeFilter,
    setActiveFilter,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
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

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    await markAsRead(id);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
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
    <div className="relative shrink-0 flex items-center justify-center w-10 h-10 min-w-10 min-h-10" ref={dropdownRef}>
      {/* Bell Trigger Button - White outer background, theme-colored bell icon matching WishlistNavButton */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications(activeFilter);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: '40px',
          height: '40px',
          minWidth: '40px',
          minHeight: '40px',
          maxWidth: '40px',
          maxHeight: '40px',
          boxSizing: 'border-box',
          padding: 0,
          border: `2px solid ${primaryColor}`,
          borderRadius: '9999px',
          backgroundColor: isHovered || isOpen ? `${primaryColor}20` : '#ffffff',
          boxShadow: `0 2px 8px -1px ${primaryColor}40`,
        }}
        className="relative shrink-0 rounded-full transition-all duration-200 ease-out focus:outline-none flex items-center justify-center cursor-pointer group hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95"
        aria-label="Notifications"
        title={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
      >
        {/* Theme-colored Notification Bell Icon (24x24 viewBox matching Wishlist Heart) */}
        <svg
          style={{
            color: primaryColor,
            fill: primaryColor,
            filter: `drop-shadow(0 1px 3px ${primaryColor}60)`,
          }}
          className="w-5 h-5 transition-transform duration-200 group-hover:scale-110"
          viewBox="0 0 24 24"
        >
          <path
            fillRule="evenodd"
            d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z"
            clipRule="evenodd"
          />
        </svg>
        {/* Only render badge if unreadCount > 0 */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px]">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
            <span className="relative inline-flex min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-black rounded-full items-center justify-center shadow-xs border border-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Notifications Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-sm sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-top-2">
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
              <RefreshButton
                onClick={() => fetchNotifications(activeFilter)}
                isRefreshing={loading}
                iconOnly
                variant="ghost"
                size="xs"
                iconSize={14}
                title="Refresh notifications"
              />

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-[var(--color-primary)] hover:opacity-80 font-semibold transition-colors flex items-center gap-1"
                >
                  <div style={{ width: 12, height: 12 }}>
                    <Icon source={CheckIcon} />
                  </div>
                  <span>Read all</span>
                </button>
              )}
            </div>
          </div>

          {/* Type Filter Pills */}
          <div className="px-3 py-2 bg-white border-b border-gray-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
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
                      ? 'bg-[var(--color-primary)] toggle-btn-active font-black shadow-2xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200/70 hover:text-black font-semibold'
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
                <span className="w-3 h-3 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-xs">
                No notifications right now.
              </div>
            ) : (
              notifications.map((item) => {
                const style = getTypeStyle(item.type, item.title, item.metadata);
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
                        {!isStandalone && storeName && (
                          <span className="font-semibold text-gray-500 truncate max-w-[120px]">
                            {storeName}
                          </span>
                        )}
                        {!isStandalone && storeName && <span>•</span>}
                        <span>{getRelativeTime(item.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Link & Refresh */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <RefreshButton
              onClick={() => fetchNotifications(activeFilter)}
              isRefreshing={loading}
              variant="ghost"
              size="xs"
              iconSize={13}
              label="Refresh"
              refreshingLabel="Refreshing..."
            />

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
