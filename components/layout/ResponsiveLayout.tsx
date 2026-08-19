'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from '@shopify/polaris';
import { MenuIcon, XIcon } from '@shopify/polaris-icons';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { StoreRoleBadge } from '@/components/ui/StoreRoleBadge';

export function ResponsiveLayout({ 
  sidebar, 
  children 
}: { 
  sidebar: React.ReactNode; 
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

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
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden text-gray-900 relative">
      
      {/* Mobile Header (Only visible on small screens) */}
      <div className="md:hidden absolute top-0 left-0 w-full h-[60px] bg-white border-b border-gray-200 z-40 flex items-center px-4 justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-bold text-gray-900">Store Bridge</h2>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-md"
            aria-label="Open menu"
          >
            <div style={{ width: 24, height: 24 }}>
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
        fixed md:relative top-0 left-0 h-full z-50 bg-white
        transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Mobile Close Button (inside sidebar) */}
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="md:hidden absolute top-4 right-4 p-2 text-gray-500 hover:bg-gray-100 rounded-md z-50"
          aria-label="Close menu"
        >
          <div style={{ width: 20, height: 20 }}>
            <Icon source={XIcon} />
          </div>
        </button>
        {sidebar}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[var(--bg-page)] relative pt-[60px] md:pt-0">
        {/* Desktop Top Header */}
        <div className="hidden md:flex h-16 min-h-[64px] py-3 bg-white border-b border-gray-200 px-6 items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">StoreBridge</span>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-bold text-gray-800 capitalize">
              {pathname === '/' ? 'Dashboard' : pathname.split('/').pop()?.replace('-', ' ')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <StoreRoleBadge />
            <NotificationBell />
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}
