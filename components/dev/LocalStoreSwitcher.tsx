'use client';

import React, { useState, useEffect } from 'react';
import { useStoreContext } from '@/components/providers/StoreProvider';

interface DevStore {
  id: string;
  shopDomain: string;
  label: string;
  isMaster: boolean;
  isStandalone: boolean;
  role: 'MASTER' | 'CONNECTED' | 'STANDALONE';
}

export function LocalStoreSwitcher() {
  // 1. Strict Environment Guard: Never render in production
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const { currentStore } = useStoreContext();
  const [stores, setStores] = useState<DevStore[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isAllowedHost, setIsAllowedHost] = useState(false);

  useEffect(() => {
    // 2. Strict Host Guard: Only allow localhost or local devtunnel
    if (typeof window !== 'undefined') {
      const h = window.location.hostname;
      const allowed = h.includes('localhost') || h.includes('127.0.0.1') || h.includes('devtunnels.ms');
      setIsAllowedHost(allowed);
      if (!allowed) return;

      fetch('/api/dev/stores')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success && Array.isArray(data.stores)) {
            setStores(data.stores);
          }
        })
        .catch(() => {});
    }
  }, []);

  if (!isAllowedHost || stores.length === 0) {
    return null;
  }

  const handleSwitch = (targetShop: string) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('storebridge_active_shop', targetShop);
      } catch (_) {}

      const url = new URL(window.location.href);
      url.searchParams.set('shop', targetShop);
      window.location.href = url.toString();
    }
  };

  const getRoleBadge = (role: 'MASTER' | 'CONNECTED' | 'STANDALONE') => {
    switch (role) {
      case 'MASTER':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'CONNECTED':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'STANDALONE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const currentShopDomain = currentStore?.shopDomain?.toLowerCase() || '';

  return (
    <aside aria-label="Development store switcher" className="fixed bottom-4 right-4 z-99999 font-sans text-xs">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-900/95 hover:bg-black text-white rounded-full shadow-lg border border-gray-700 backdrop-blur-md transition-all cursor-pointer hover:scale-105 active:scale-95"
          title="Click to switch local store session"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold">DEV:</span>
          <span className="truncate max-w-[130px] font-medium text-gray-200">
            {currentStore?.label || currentStore?.shopDomain?.split('.')[0] || 'Select Store'}
          </span>
          <span className="text-[10px] bg-gray-800 px-1.5 py-0.5 rounded text-gray-300 font-mono">
            Local DB
          </span>
        </button>
      ) : (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-3.5 w-80 max-w-[calc(100vw-32px)] flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-extrabold text-gray-900 text-xs">Local Dev Store Switcher</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-700 p-1 rounded-md text-sm font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="text-[11px] text-gray-500 flex items-center justify-between">
            <span>Database:</span>
            <span className="font-mono text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-semibold border border-emerald-200">
              localhost:5432 / shopify_sync
            </span>
          </div>

          <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
            {stores.map((s) => {
              const isSelected = currentShopDomain === s.shopDomain.toLowerCase();
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSwitch(s.shopDomain)}
                  className={`flex items-center justify-between p-2 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/80 border-indigo-300 text-indigo-900 font-bold shadow-2xs'
                      : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-800 hover:border-gray-300'
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-xs truncate font-medium">{s.label}</span>
                    <span className="text-[10px] text-gray-400 truncate font-mono">
                      {s.shopDomain}
                    </span>
                  </div>
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${getRoleBadge(
                      s.role
                    )}`}
                  >
                    {s.role}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="pt-1.5 border-t border-gray-100 text-[10px] text-gray-400 text-center">
            Zero git push needed. Hot-reloads in local DB.
          </div>
        </div>
      )}
    </aside>
  );
}

