'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  HomeIcon, ProductIcon, ImportIcon, HeartIcon,
  DiscountIcon,
  CashDollarIcon,
  SettingsIcon,
  LinkIcon,
  CodeIcon,
  ClockIcon,
  NotificationIcon,
  CartIcon,
  EmailIcon,
  OrderIcon
} from '@shopify/polaris-icons';
import { Icon } from '@shopify/polaris';
import { useStoreContext } from '@/components/providers/StoreProvider';
import { useNotifications } from '@/components/providers/NotificationContext';
import { useTheme } from '@/components/providers/ThemeContext';
import { StoreLogo } from '@/components/common';

interface MenuItem {
  label: string;
  href: string;
  icon: any;
  badge?: string;
  hideInSingleStore?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shop = searchParams.get('shop');
  const host = searchParams.get('host');
  const { currentTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  
  const { 
    activeStores, 
    currentStore, 
    sessionStore, 
    sessionShopDomain, 
    isMasterSession, 
    canSwitchStores, 
    isStandalone, 
    canManageNetwork, 
    loading 
  } = useStoreContext();

  const { unreadCount } = useNotifications();

  const handleStoreSwitch = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!canSwitchStores) return;
    const selectedShop = e.target.value;
    if (selectedShop) {
      try {
        localStorage.setItem('storebridge_active_shop', selectedShop);
      } catch (err) {}
      const url = new URL(window.location.href);
      url.searchParams.set('shop', selectedShop);
      const masterDomain = sessionShopDomain || sessionStore?.shopDomain;
      if (masterDomain && isMasterSession) {
        url.searchParams.set('master_shop', masterDomain);
        try {
          localStorage.setItem('storebridge_master_shop', masterDomain);
        } catch (err) {}
      }
      window.location.href = url.toString();
    }
  };

  const createHref = (basePath: string) => {
    if (!basePath || basePath === '#' || basePath.startsWith('http')) return basePath;
    const queryParams = new URLSearchParams();
    if (shop) queryParams.set('shop', shop);
    if (host) queryParams.set('host', host);
    const queryString = queryParams.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const menuSections: MenuSection[] = [
    {
      title: 'OVERVIEW',
      items: [
        { label: 'Dashboard', href: '/', icon: HomeIcon },
        { label: 'Notifications', href: '/dashboard/notifications', icon: NotificationIcon, badge: unreadCount > 0 ? String(unreadCount) : undefined },
        { label: 'Activity', href: '/activity', icon: ClockIcon },
      ]
    },
    {
      title: 'INVENTORY',
      items: [
        { label: 'Products', href: '/products', icon: ProductIcon },
      ]
    },
    {
      title: 'ANALYTICS',
      items: [
        { label: 'Product Insights', href: '/insights', icon: HeartIcon },
        { label: 'Inventory Planning', href: '/insights/planning', icon: ClockIcon },
      ]
    },
    {
      title: 'OPERATIONS',
      items: [
        { label: 'Import & Sync', href: '/sync', icon: ImportIcon },
      ]
    },
    {
      title: 'RULES',
      items: [
        { label: 'SKU Generation', href: '/sku', icon: DiscountIcon },
        { label: 'Price Adjustment', href: '/price-adjustment', icon: CashDollarIcon },
      ]
    },
    ...(isStandalone ? [{
      title: 'CUSTOMER EXPERIENCE',
      items: [
        { label: 'Pre-order', href: '/preorder', icon: CartIcon },
        { label: 'Notify Me', href: '/notify-me', icon: EmailIcon },
        { label: 'Back in Stock', href: '/back-in-stock', icon: OrderIcon },
      ]
    }] : []),
    {
      title: 'MULTI-STORE',
      items: [
        { label: 'Store Connections', href: '/connections', icon: LinkIcon },
      ]
    },
    {
      title: 'SETTINGS',
      items: [
        { label: 'Settings', href: '/settings', icon: SettingsIcon },
      ]
    },
    {
      title: 'RESOURCES',
      items: [
        { label: 'Developer Docs', href: '#', icon: CodeIcon },
      ]
    }
  ];

  return (
    <div className="w-[260px] flex-shrink-0 border-r ys-theme-sidebar h-screen max-h-screen sticky top-0 flex flex-col z-20 transition-colors duration-300 overflow-hidden">
      
      {/* Innovative Brand Logo Header */}
      <Link
        href={createHref('/')}
        className="px-5 py-5 flex items-center gap-3 border-b border-[var(--theme-border-accent)]/50 bg-white/40 hover:bg-white/60 transition-all cursor-pointer group shrink-0"
        title="Go to Dashboard"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white flex items-center justify-center shadow-xs flex-shrink-0 relative overflow-hidden border border-white/30 group-hover:scale-105 transition-transform">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
            <path d="M4 7V4h16v3" />
            <path d="M9 20h6" />
            <path d="M12 4v16" />
            <circle cx="6" cy="14" r="2.5" fill="currentColor" fillOpacity="0.25" />
            <circle cx="18" cy="14" r="2.5" fill="currentColor" fillOpacity="0.25" />
            <path d="M6 14h12" />
          </svg>
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-black text-gray-900 leading-tight tracking-tight flex items-center gap-1.5 group-hover:text-[var(--color-primary)] transition-colors">
            StoreBridge
          </h2>
          {!isStandalone && (
            <p className="text-[11px] text-gray-500 leading-tight font-semibold mt-0.5">Multi-store sync</p>
          )}
        </div>
      </Link>

      {/* Store Role Indicator Card */}
      <div className="px-4 py-4 shrink-0">
        {(() => {
          const isMasterStore = currentStore?.isMaster;
          const isConnectedStore = !isMasterStore && !isStandalone;

          let roleLabel = isStandalone 
            ? null 
            : (isMasterStore ? 'MASTER STORE' : 'CONNECTED STORE');

          return (
            <div className="px-3.5 py-2.5 rounded-xl border border-[var(--theme-border-accent)] bg-white/85 shadow-2xs flex flex-col relative transition-all duration-200">
              {canSwitchStores ? (
                <div className="flex items-center gap-2.5 min-w-0">
                  <StoreLogo 
                    shopDomain={currentStore?.shopDomain} 
                    label={currentStore?.label} 
                    isMaster={currentStore?.isMaster} 
                    isStandalone={isStandalone} 
                    size="sm" 
                  />
                  <div className="min-w-0 flex-1">
                    <select
                      value={currentStore?.shopDomain || ''}
                      onChange={handleStoreSwitch}
                      className="bg-transparent text-xs sm:text-sm font-bold border-none outline-none focus:ring-0 cursor-pointer w-full pr-1 truncate text-gray-900"
                    >
                      {activeStores.map((s) => {
                        const tag = s.isMaster ? '(Master)' : (s.isStandalone ? '' : '(Connected)');
                        return (
                          <option key={s.id} value={s.shopDomain} className="bg-white text-gray-900 font-semibold py-1">
                            {s.label || s.shopDomain} {tag}
                          </option>
                        );
                      })}
                    </select>
                    {roleLabel && (
                      <span className="text-[10px] font-extrabold mt-0.5 tracking-wider uppercase text-[var(--color-primary)] block">
                        {roleLabel}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 min-w-0">
                  <StoreLogo 
                    shopDomain={currentStore?.shopDomain} 
                    label={currentStore?.label} 
                    isMaster={currentStore?.isMaster} 
                    isStandalone={isStandalone} 
                    size="sm" 
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs sm:text-sm font-bold truncate text-gray-900 block">
                      {loading ? 'Loading...' : (currentStore?.label || currentStore?.shopDomain || 'ESHAN Store')}
                    </span>
                    {roleLabel && (
                      <span className="text-[10px] font-extrabold mt-0.5 tracking-wider uppercase text-[var(--color-primary)] block">
                        {roleLabel}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Nav Menu */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 ys-sidebar-scroll">
        {menuSections.map((section, idx) => (
          <div key={idx} className="mb-6">
            <h3 
              className="px-3 mb-3 text-xs font-black tracking-wider uppercase transition-colors select-none"
              style={{ color: mounted ? (currentTheme?.darkColor || 'var(--color-primary-dark, #022c22)') : 'var(--color-primary-dark, #022c22)' }}
            >
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                if (!canManageNetwork && item.hideInSingleStore) return null;
                
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.label}
                    href={createHref(item.href)}
                    prefetch={false}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-150 group cursor-pointer ${isActive
                      ? 'bg-[var(--color-primary)] text-white font-bold shadow-xs'
                      : 'text-gray-700 hover:bg-black/5 font-medium'
                      }`}
                  >
                    <span className={isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-900 transition-colors'}>
                      <Icon source={item.icon} tone="inherit" />
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span className="bg-red-500 text-white font-extrabold text-[11px] px-2 py-0.5 rounded-full shadow-xs">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
