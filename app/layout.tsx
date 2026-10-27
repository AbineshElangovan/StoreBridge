import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';
import './globals.css';
import ShopifyProvider from '@/components/providers/AppBridgeProvider';
import { Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { ResponsiveLayout } from '@/components/layout/ResponsiveLayout';
import { prisma } from '@/lib/db/prisma';
import { TimezoneProvider } from '@/components/providers/TimezoneContext';
import { LiveRefresher } from '@/components/providers/LiveRefresher';
import { StoreProvider } from '@/components/providers/StoreProvider';
import { NotificationProvider } from '@/components/providers/NotificationContext';
import { NavbarTitleProvider } from '@/components/providers/NavbarTitleContext';

import { ToastProvider } from '@/components/providers/ToastContext';
import { ThemeProvider } from '@/components/providers/ThemeContext';
import { AutoHideScrollbar } from '@/components/providers/AutoHideScrollbar';

export const dynamic = 'force-dynamic';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'StoreBridge',
  description: 'Multi-store inventory synchronization',
};

const FOOTER_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/products', label: 'Products' },
  { href: '/sync', label: 'Sync' },
  { href: '/settings', label: 'Settings' },
];

const BUSINESS_HOURS = [
  { day: 'Monday — Friday', hours: '10:00 AM – 6:00 PM', closed: false },
  { day: 'Saturday', hours: '12:00 PM – 6:00 PM', closed: false },
  { day: 'Sunday', hours: 'Holiday', closed: true },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {

  return (
    <html lang="en" data-theme="emerald_forest" suppressHydrationWarning>
      <head>
        <meta name="shopify-api-key" content={process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || ''} />
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var saved = localStorage.getItem('product_app_light_wallpaper') || localStorage.getItem('storebridge_inventory_theme') || 'emerald_forest';
                document.documentElement.setAttribute('data-theme', saved);
              } catch (e) {
                document.documentElement.setAttribute('data-theme', 'emerald_forest');
              }
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <ShopifyProvider>
          <StoreProvider>
            <ToastProvider>
              <NotificationProvider>
                <ThemeProvider>
                  <AutoHideScrollbar />
                  <NavbarTitleProvider>
                    <ResponsiveLayout sidebar={
                      <Suspense key="sidebar-suspense" fallback={<div className="w-[260px] bg-white border-r h-full animate-pulse" />}>
                        <Sidebar />
                      </Suspense>
                    }>
                      <TimezoneProvider>
                        {children}
                      </TimezoneProvider>
                    </ResponsiveLayout>
                  </NavbarTitleProvider>
                </ThemeProvider>
              </NotificationProvider>
            </ToastProvider>
          </StoreProvider>
        </ShopifyProvider>
      </body>
    </html>
  );
}
