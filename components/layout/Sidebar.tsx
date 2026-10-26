'use client';
import React, { useState, useEffect, useRef } from 'react';
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
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);
  const storeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(event.target as Node)) {
        setStoreMenuOpen(false);
      }
    }
    if (storeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [storeMenuOpen]);

  const switchStore = (selectedShop: string) => {
    if (!canSwitchStores || !selectedShop) return;
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
        className="px-5 py-5 flex items-center gap-3 border-b border-[var(--theme-sidebar-border)] bg-transparent hover:bg-[var(--theme-brand-bg,#cae174)] active:bg-[var(--color-primary)] transition-all duration-200 cursor-pointer group shrink-0"
        title="Go to Dashboard"
      >
        <div 
          className="w-10 h-10 rounded-xl bg-white text-white flex items-center justify-center shadow-xs flex-shrink-0 relative overflow-hidden border border-black/10 group-hover:scale-105 transition-transform p-0.5"
          suppressHydrationWarning
        >
          <img 
            src="/logos/storebridge.jpg" 
            alt="StoreBridge" 
            className="w-full h-full object-cover rounded-lg"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className="text-gray-950 tracking-tight flex items-center gap-1.5 group-hover:text-black group-hover:-translate-y-0.5 transition-all duration-200 ease-out"
            style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1.1, margin: 0 }}
          >
            StoreBridge
          </h3>
          {!isStandalone && (
            <p className="text-[11px] text-gray-700 leading-tight font-bold mt-1">Multi-store sync</p>
          )}
        </div>
      </Link>

      {/* Store Role Indicator Card */}
      <div className="px-4 py-4 shrink-0 relative z-30">
        {(() => {
          const isMasterStore = currentStore?.isMaster;
          const isConnectedStore = !isMasterStore && !isStandalone;

          let roleLabel = isStandalone 
            ? null 
            : (isMasterStore ? 'MASTER STORE' : 'CONNECTED STORE');

          return (
            <div 
              ref={storeDropdownRef}
              className="px-3.5 py-2.5 rounded-xl border border-[var(--theme-border-accent)] bg-white/90 shadow-2xs flex flex-col relative transition-all duration-200"
            >
              {canSwitchStores ? (
                <div className="relative min-w-0">
                  <button
                    type="button"
                    onClick={() => setStoreMenuOpen(!storeMenuOpen)}
                    className={`flex ${roleLabel ? 'items-start' : 'items-center'} gap-2.5 w-full text-left cursor-pointer group focus:outline-none`}
                  >
                    <div className={`${roleLabel ? 'pt-0.5' : ''} shrink-0`}>
                      <StoreLogo 
                        shopDomain={currentStore?.shopDomain} 
                        label={currentStore?.label} 
                        logoUrl={currentStore?.logoUrl}
                        isMaster={currentStore?.isMaster} 
                        isStandalone={isStandalone} 
                        size="sm" 
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`flex ${roleLabel ? 'items-start' : 'items-center'} justify-between gap-1.5`}>
                        <span className="text-xs sm:text-sm font-bold text-gray-900 group-hover:text-[var(--color-primary)] transition-colors leading-snug break-words">
                          {currentStore?.label || currentStore?.shopDomain || 'Select Store'}
                        </span>
                        <svg
                          className={`w-3.5 h-3.5 text-gray-400 group-hover:text-[var(--color-primary)] transition-transform duration-200 shrink-0 ${roleLabel ? 'mt-0.5' : ''} ${
                            storeMenuOpen ? 'rotate-180 text-[var(--color-primary)]' : ''
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      {roleLabel && (
                        <span className="text-[10px] font-extrabold mt-1 tracking-wider uppercase text-[var(--color-primary)] block">
                          {roleLabel}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Custom Purple Floating Dropdown Menu - Aligned 100% to Card Width, Full Name Visible */}
                  {storeMenuOpen && (
                    <div 
                      className="absolute left-0 right-0 w-full top-full mt-2 rounded-xl border border-[var(--theme-border-accent)]/80 shadow-2xl py-1.5 z-50 overflow-hidden ring-1 ring-black/10 animate-in fade-in-50 zoom-in-95 duration-150"
                      style={{ backgroundColor: '#ffffff', opacity: 1 }}
                    >
                      <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-gray-400 border-b border-gray-100 flex items-center justify-between bg-white">
                        <span>Switch Store</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]"></span>
                      </div>
                      <div className="max-h-72 overflow-y-auto py-1 bg-white divide-y divide-gray-50">
                        {activeStores.map((s) => {
                          const isSelected = s.shopDomain === currentStore?.shopDomain;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setStoreMenuOpen(false);
                                if (!isSelected) {
                                  switchStore(s.shopDomain);
                                }
                              }}
                              className={`w-full px-3 py-2 text-left flex items-start justify-between gap-2 text-xs transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-text,#000000)] font-bold border-l-4 border-[var(--color-primary-dark)] shadow-2xs'
                                  : 'text-gray-800 hover:bg-[var(--theme-brand-bg,#cae174)]/70 hover:text-black active:bg-[var(--color-primary)]'
                              }`}
                              style={{ backgroundColor: isSelected ? undefined : '#ffffff' }}
                            >
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <div className="pt-0.5 shrink-0">
                                  <StoreLogo 
                                    shopDomain={s.shopDomain} 
                                    label={s.label} 
                                    logoUrl={s.logoUrl}
                                    isMaster={s.isMaster} 
                                    isStandalone={s.isStandalone} 
                                    size="sm" 
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="font-bold text-gray-900 leading-snug break-words block">
                                    {s.label || s.shopDomain}
                                  </span>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    {s.isMaster ? (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] border border-[var(--color-primary)]/40 shrink-0">
                                        Master
                                      </span>
                                    ) : !s.isStandalone ? (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-gray-600 bg-gray-100 border border-gray-200 shrink-0">
                                        Connected
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                              {isSelected && (
                                <div className="pt-0.5 shrink-0 ml-1">
                                  <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`flex ${roleLabel ? 'items-start' : 'items-center'} gap-2.5 min-w-0`}>
                  <div className={`${roleLabel ? 'pt-0.5' : ''} shrink-0`}>
                    <StoreLogo 
                      shopDomain={currentStore?.shopDomain} 
                      label={currentStore?.label} 
                      logoUrl={currentStore?.logoUrl}
                      isMaster={currentStore?.isMaster} 
                      isStandalone={isStandalone} 
                      size="sm" 
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs sm:text-sm font-bold text-gray-900 block leading-snug break-words">
                      {loading ? 'Loading...' : (currentStore?.label || currentStore?.shopDomain || 'ESHAN Store')}
                    </span>
                    {roleLabel && (
                      <span className="text-[10px] font-extrabold mt-1 tracking-wider uppercase text-[var(--color-primary)] block">
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
                      ? 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover,#96bb13)] text-[var(--color-primary-text,#000000)] font-black shadow-md border border-[var(--theme-sidebar-border,#91b212)]'
                      : 'text-gray-950 hover:bg-[var(--theme-brand-bg,#cae174)] hover:text-black active:bg-[var(--color-primary)] active:text-[var(--color-primary-text,#000000)] active:scale-[0.98] font-bold'
                      }`}
                  >
                    <span className={isActive ? 'text-[var(--color-primary-text,#000000)]' : 'text-gray-900 group-hover:text-black transition-colors'}>
                      <Icon source={item.icon} tone="inherit" />
                    </span>
                    <span className={`flex-1 truncate ${isActive ? 'text-[var(--color-primary-text,#000000)] font-black' : ''}`}>{item.label}</span>
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
