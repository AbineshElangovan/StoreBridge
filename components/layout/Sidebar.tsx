'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  HomeIcon, ProductIcon, ImportIcon, HeartIcon,
  DiscountIcon,
  CashDollarIcon,
  SettingsIcon,
  LinkIcon,
  CodeIcon,
  ClockIcon,
  NotificationIcon
} from '@shopify/polaris-icons';
import { Icon } from '@shopify/polaris';
import { useStoreContext } from '@/components/providers/StoreProvider';
import { shopifyFetch } from '@/lib/shopify/Client';

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
  
  const { activeStores, currentStore, isStandalone, canManageNetwork, loading } = useStoreContext();
  const [unreadCount, setUnreadCount] = React.useState<number>(0);

  const handleStoreSwitch = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedShop = e.target.value;
    if (selectedShop) {
      try {
        localStorage.setItem('storebridge_active_shop', selectedShop);
      } catch (err) {}
      const url = new URL(window.location.href);
      url.searchParams.set('shop', selectedShop);
      window.location.href = url.toString();
    }
  };

  React.useEffect(() => {
    const fetchUnread = async () => {
      try {
        const shopParam = shop ? `&shop=${encodeURIComponent(shop)}` : '';
        const res = await shopifyFetch(`/api/notifications?limit=1${shopParam}`);
        if (res.ok) {
          const json = await res.json();
          setUnreadCount(json.unreadCount || 0);
        }
      } catch (e) {
        // silent fail
      }
    };

    fetchUnread();

    const handleCountChange = (event: any) => {
      if (typeof event?.detail === 'number') {
        setUnreadCount(event.detail);
      }
    };

    window.addEventListener('notification-count-changed', handleCountChange);
    window.addEventListener('notification-updated', fetchUnread);
    return () => {
      window.removeEventListener('notification-count-changed', handleCountChange);
      window.removeEventListener('notification-updated', fetchUnread);
    };
  }, [shop]);

  const createHref = (basePath: string) => {
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
    <div className="w-[260px] flex-shrink-0 border-r border-[#0db69d]/10 bg-[#f0fdfa] h-screen sticky top-0 flex flex-col">
      {/* Brand */}
      <div className="px-6 py-6 flex items-center gap-3">
        <Image src="/logo.png" alt="Logo" width={32} height={32} className="w-8 h-8 rounded-lg object-contain" priority />
        <div>
          <h2 className="text-[15px] font-bold text-gray-900 leading-tight">StoreBridge</h2>
          <p className="text-[11px] text-gray-500 leading-tight">Multi-store inventory sync</p>
        </div>
      </div>

      <div className="px-4 mb-6">
        {(() => {
          const isMasterStore = currentStore?.isMaster;
          const isConnectedStore = !isMasterStore && !isStandalone;

          let boxStyle = 'bg-blue-100 border-blue-300 text-blue-950';
          let badgeStyle = 'text-blue-800 font-black';

          if (isMasterStore) {
            boxStyle = 'bg-emerald-100 border-emerald-300 text-emerald-950';
            badgeStyle = 'text-emerald-800 font-black';
          } else if (isConnectedStore) {
            boxStyle = 'bg-purple-100 border-purple-300 text-purple-950';
            badgeStyle = 'text-purple-800 font-black';
          }

          const roleLabel = isStandalone 
            ? 'STANDALONE STORE' 
            : (isMasterStore ? 'MASTER STORE' : 'CONNECTED STORE');

          return (
            <div className={`px-3 py-2.5 rounded-xl border shadow-2xs flex flex-col relative transition-colors ${boxStyle}`}>
              {activeStores.length > 1 ? (
                <select
                  value={currentStore?.shopDomain || ''}
                  onChange={handleStoreSwitch}
                  className="bg-transparent text-sm font-bold border-none outline-none focus:ring-0 cursor-pointer w-full pr-1 truncate"
                >
                  {activeStores.map((s) => {
                    const tag = s.isMaster ? '(Master)' : (isStandalone ? '(Standalone)' : '(Connected)');
                    return (
                      <option key={s.id} value={s.shopDomain} className="bg-white text-gray-900 font-semibold py-1">
                        {s.label || s.shopDomain} {tag}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <span className="text-sm font-bold truncate">
                  {loading ? 'Loading...' : (currentStore?.label || currentStore?.shopDomain || 'ESHAN Store')}
                </span>
              )}
              <span className={`text-[10px] font-extrabold mt-0.5 tracking-wider uppercase ${badgeStyle}`}>
                {roleLabel}
              </span>
            </div>
          );
        })()}
      </div>

      <div className="flex-1 overflow-y-scroll px-4 pb-6 ys-sidebar-scroll">
        {menuSections.map((section, idx) => (
          <div key={idx} className="mb-5">
            <h3 className="px-3 mb-2 text-[11px] font-bold text-gray-400 tracking-wider uppercase">
              {section.title}
            </h3>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                if (!canManageNetwork && item.hideInSingleStore) return null;
                
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.label}
                    href={createHref(item.href)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors group ${isActive
                      ? 'bg-[#e0f8f5] text-[#0b9c86] font-semibold'
                      : 'text-gray-600 hover:bg-[#0db69d] hover:text-white font-medium'
                      }`}
                  >
                    <span className={isActive ? 'text-[#0b9c86]' : 'text-gray-400 group-hover:text-white transition-colors'}>
                      <Icon source={item.icon} tone="inherit" />
                    </span>
                    <span className="flex-1">{item.label}</span>
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
