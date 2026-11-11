'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { shopifyFetch } from '@/lib/shopify/Client';
import { useStoreContext } from '@/components/providers/StoreProvider';
import { useTheme } from '@/components/providers/ThemeContext';

export function WishlistNavButton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shop = searchParams.get('shop');
  const host = searchParams.get('host');
  const { isStandalone } = useStoreContext();
  const { currentTheme } = useTheme();

  // Dynamic theme colors matching whichever theme is selected
  const primaryColor = currentTheme?.primaryColor || '#a7cd18';
  const darkColor = currentTheme?.darkColor || '#142403';
  const accentColor = currentTheme?.accentColor || '#f2fadc';

  const [count, setCount] = useState<number>(0);
  const [seenCount, setSeenCount] = useState<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const isWishlistPage = Boolean(pathname?.startsWith('/wishlist'));

  // Initialize seenCount from localStorage on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('wishlist_seen_count');
      if (stored !== null) {
        setSeenCount(parseInt(stored, 10) || 0);
      }
    } catch (_) {}
  }, []);

  const fetchCount = useCallback(async () => {
    if (!isStandalone) return;
    try {
      const res = await shopifyFetch(`/api/wishlist?t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        const currentTotal =
          typeof json.count === 'number'
            ? json.count
            : Array.isArray(json.items)
            ? json.items.length
            : 0;

        setCount(currentTotal);

        // If on wishlist page or first time opening, mark all current items as seen so old counts don't display like a cart
        const stored = localStorage.getItem('wishlist_seen_count');
        if (isWishlistPage || stored === null) {
          setSeenCount(currentTotal);
          try {
            localStorage.setItem('wishlist_seen_count', String(currentTotal));
          } catch (_) {}
        }
      }
    } catch (_) {}
  }, [isStandalone, isWishlistPage]);

  useEffect(() => {
    fetchCount();

    const handleUpdate = (e: any) => {
      if (e?.detail) {
        if (e.detail.wishlisted === true) {
          setCount((prev) => prev + 1);
        } else if (e.detail.wishlisted === false) {
          setCount((prev) => {
            const next = Math.max(0, prev - 1);
            setSeenCount((s) => Math.min(s, next));
            return next;
          });
        }
      }
      fetchCount();
    };

    const handleSeen = (e: any) => {
      const seen = typeof e?.detail?.count === 'number' ? e.detail.count : count;
      setSeenCount(seen);
      try {
        localStorage.setItem('wishlist_seen_count', String(seen));
      } catch (_) {}
    };

    window.addEventListener('wishlist-updated', handleUpdate);
    window.addEventListener('wishlist-seen', handleSeen);

    return () => {
      window.removeEventListener('wishlist-updated', handleUpdate);
      window.removeEventListener('wishlist-seen', handleSeen);
    };
  }, [fetchCount, count]);

  // Whenever user enters /wishlist (via sidebar, navbar or direct navigation), immediately clear the counter
  useEffect(() => {
    if (isWishlistPage) {
      setSeenCount((prev) => Math.max(prev, count));
      if (count > 0) {
        try {
          localStorage.setItem('wishlist_seen_count', String(count));
        } catch (_) {}
      }
    }
  }, [isWishlistPage, count]);

  if (!isStandalone) return null;

  const createHref = (basePath: string) => {
    const queryParams = new URLSearchParams();
    if (shop) queryParams.set('shop', shop);
    if (host) queryParams.set('host', host);
    const queryString = queryParams.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  // When user clicks the Wishlist button, immediately mark as seen so the number clears
  const handleClick = () => {
    setSeenCount(count);
    try {
      localStorage.setItem('wishlist_seen_count', String(count));
    } catch (_) {}
  };

  // Only show the badge number if there are newly added items AND user is NOT on /wishlist
  const unreadCount = isWishlistPage || count <= seenCount ? 0 : Math.max(0, count - seenCount);

  // Wishlist is strictly for Standalone stores. Hidden completely for Master and Connected stores.
  if (!isStandalone) {
    return null;
  }

  return (
    <Link
      href={createHref('/wishlist')}
      onClick={handleClick}
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
        backgroundColor: isHovered ? `${primaryColor}20` : '#ffffff',
        boxShadow: `0 2px 8px -1px ${primaryColor}40`,
      }}
      className="relative shrink-0 rounded-full transition-all duration-200 ease-out focus:outline-none flex items-center justify-center cursor-pointer group hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95"
      title={count > 0 ? `Wishlist (${count} items)` : 'Wishlist'}
      aria-label="Wishlist"
    >
      {/* Theme-colored Heart Icon (24x24 viewBox matching Notification Bell) */}
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
          d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z"
        />
      </svg>

      {/* Only render badge if there are new unviewed items AND user is NOT currently on /wishlist */}
      {!isWishlistPage && unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px]">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
          <span className="relative inline-flex min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-black rounded-full items-center justify-center shadow-xs border border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        </span>
      )}
    </Link>
  );
}
