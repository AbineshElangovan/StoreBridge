'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@shopify/polaris';
import { MenuIcon, XIcon, HomeIcon, ChevronRightIcon, CheckCircleIcon } from '@shopify/polaris-icons';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { StoreRoleBadge } from '@/components/ui/StoreRoleBadge';
import { useNavbarTitle } from '@/components/providers/NavbarTitleContext';
import { ThemeSwitcher } from '@/components/layout/ThemeSwitcher';
import { useStoreContext } from '@/components/providers/StoreProvider';

export function ResponsiveLayout({ 
  sidebar, 
  children 
}: { 
  sidebar: React.ReactNode; 
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shop = searchParams.get('shop');
  const host = searchParams.get('host');
  const { customTitle } = useNavbarTitle();
  const { isStandalone } = useStoreContext();

  const createHref = (basePath: string) => {
    if (!basePath || basePath === '#' || basePath.startsWith('http')) return basePath;
    const queryParams = new URLSearchParams();
    if (shop) queryParams.set('shop', shop);
    if (host) queryParams.set('host', host);
    const queryString = queryParams.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const getBreadcrumbDisplay = () => {
    if (customTitle) return customTitle;
    if (!pathname || pathname === '/') return 'Dashboard';

    const segments = pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] || '';

    // Check if last segment is UUID or numeric ID (e.g. B576e76e-C268-45d8-945e-B54b800bda1f or 10304904134947)
    const isIdOrUuid = /^[0-9a-fA-F-]{8,}/.test(lastSegment) || /^\d+$/.test(lastSegment);

    if (isIdOrUuid) {
      if (segments[0] === 'products') {
        return 'Products / Product Details';
      }
      return 'Details';
    }

    if (segments[0] === 'sync') {
      return isStandalone ? 'Import' : 'Import & Sync';
    }

    return lastSegment.replace(/[-_]+/g, ' ');
  };

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSidebarOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <div className="flex h-screen w-full bg-transparent overflow-hidden text-gray-900 relative">
      
      {/* Mobile Header (Only visible on small screens) */}
      <div className="md:hidden absolute top-0 left-0 w-full h-[60px] ys-theme-navbar border-b z-40 flex items-center px-4 justify-between shadow-xs transition-colors duration-300">
        <div className="flex items-center gap-2">
          <Link href={createHref('/')} className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[var(--color-primary)] text-black flex items-center justify-center font-black text-xs shadow-2xs">
              SB
            </span>
            <span className="text-sm font-extrabold text-gray-900 tracking-tight">StoreBridge</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <NotificationBell />
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-gray-700 hover:bg-black/5 rounded-lg transition-colors cursor-pointer"
            aria-label="Open menu"
          >
            <div style={{ width: 22, height: 22 }}>
              <Icon source={MenuIcon} />
            </div>
          </button>
        </div>
      </div>

      {/* Backdrop overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed md:relative top-0 left-0 h-full z-50 bg-transparent
        transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Mobile Close Button (inside sidebar) */}
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="md:hidden absolute top-4 right-4 p-2 text-gray-500 hover:bg-black/5 rounded-lg z-50 cursor-pointer"
          aria-label="Close menu"
        >
          <div style={{ width: 20, height: 20 }}>
            <Icon source={XIcon} />
          </div>
        </button>
        {sidebar}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 w-full max-w-full overflow-y-auto overflow-x-hidden bg-transparent relative pt-[60px] md:pt-0">
        {/* Desktop Top Header (Polaris-Inspired Innovative Navbar) */}
        <div className="hidden md:flex h-16 min-h-[64px] py-2 ys-theme-navbar border-b-2 px-6 items-center justify-between sticky top-0 z-30 shadow-md backdrop-blur-xl transition-all duration-300">
          
          {/* Left Side: Innovative Breadcrumb Dock */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/80 dark:bg-black/20 backdrop-blur-md rounded-xl border border-black/10 shadow-2xs">
              <Link
                href={createHref('/')}
                className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-[var(--color-primary)] transition-colors"
                title="Go to Dashboard"
              >
                <div style={{ width: 15, height: 15 }}>
                  <Icon source={HomeIcon} />
                </div>
                <span>StoreBridge</span>
              </Link>

              <div style={{ width: 12, height: 12 }} className="text-gray-400">
                <Icon source={ChevronRightIcon} />
              </div>

              <span className="text-xs font-extrabold text-gray-900 capitalize tracking-tight flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
                {getBreadcrumbDisplay()}
              </span>
            </div>
          </div>

          {/* Right Side: Innovative Polaris Actions & Controls */}
          <div className="flex items-center gap-2.5">
            {/* 4K Theme Switcher */}
            <ThemeSwitcher />

            {/* Store Role Badge */}
            <StoreRoleBadge />

            {/* Notification Bell */}
            <NotificationBell />
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}
