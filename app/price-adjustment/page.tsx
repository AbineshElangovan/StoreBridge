"use client";

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/forms';
import { useRouter } from 'next/navigation';
import { shopifyFetch } from '@/lib/shopify/Client';
import CollectionPriceAdjustment from '@/components/stores/CollectionPriceAdjustment';
import { ThemedSection } from '@/components/ui/ThemedSection';
import { Loading } from '@/components/common';
import { useStoreContext } from '@/components/providers/StoreProvider';
import { useTheme } from '@/components/providers/ThemeContext';

export default function PriceAdjustmentPage() {
  const router = useRouter();
  const { currentStore, isMaster, isStandalone } = useStoreContext();
  const { currentTheme } = useTheme();
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('ALL');

  const [storeAdjustments, setStoreAdjustments] = useState<{ [storeId: string]: string }>({});
  const [storeSaving, setStoreSaving] = useState<{ [storeId: string]: boolean }>({});
  const [storeSuccessText, setStoreSuccessText] = useState<{ [storeId: string]: string }>({});
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const shopParam = searchParams.get('shop') || '';
      const storesRes = await shopifyFetch(`/api/stores?active=false&shop=${shopParam}`, { cache: 'no-store' });
      if (storesRes.ok) {
        const storesJson = await storesRes.json();
        const loadedStores = storesJson.stores || [];
        setStores(loadedStores);

        const initialAdjustments: { [storeId: string]: string } = {};

        loadedStores.forEach((store: any) => {
          let initialVal = '0';
          if (store.priceAdjustmentValue !== undefined && store.priceAdjustmentValue !== null) {
            initialVal = store.priceAdjustmentValue.toString();
          }
          initialAdjustments[store.id] = initialVal;
        });
        setStoreAdjustments(initialAdjustments);
      }
    } catch (err) {
      console.error("Error loading stores data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const hasLoadedRef = React.useRef(false);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadData();
  }, [loadData]);

  // Filter stores based on role & dropdown selection
  const displayedStores = React.useMemo(() => {
    if (!stores || stores.length === 0) return [];
    if (isMaster) {
      if (selectedStoreFilter === 'ALL') {
        return stores;
      }
      return stores.filter(s => s.id === selectedStoreFilter);
    }
    if (currentStore?.id) {
      return stores.filter(s => s.id === currentStore.id);
    }
    // Fallback while store context is initializing
    return stores;
  }, [stores, isMaster, currentStore, selectedStoreFilter]);

  if (loading) {
    return <Loading label="Loading adjustments..." />;
  }

  // Dynamic palette derived from active theme
  const themePrimary = currentTheme?.primaryColor || '#047857';
  const themeAccent = currentTheme?.accentColor || '#d1fae5';
  const themeDark = currentTheme?.darkColor || '#022c22';
  const themeBorder = currentTheme?.navbarBorder || '#34d399';
  const themeCardBg = currentTheme?.cardBg || 'rgba(240, 253, 248, 0.95)';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full overflow-x-hidden">
      <div className="flex flex-col gap-6 sm:gap-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="page-title text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight m-0">
                Price Adjustment
              </h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-2xs ${currentTheme?.badgeColor || 'bg-emerald-100 text-emerald-950 border-emerald-300'}`}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: themePrimary }} />
                <span>{currentTheme?.name || 'Theme Active'}</span>
              </span>
            </div>
            <p className="page-subtitle text-lg sm:text-xl font-medium text-slate-500 mt-1.5 m-0">
              Configure store-specific and collection-based pricing rules for synchronized products.
            </p>
          </div>

          {/* Master Store Selector Dropdown */}
          {isMaster && stores.length > 1 && (
            <div
              className="flex items-center gap-2.5 px-4 py-2 rounded-xl shadow-2xs transition-colors"
              style={{
                backgroundColor: currentTheme?.navbarBg || '#ffffff',
                border: `1.5px solid ${themeBorder}`,
              }}
            >
              <label htmlFor="master-store-select" className="text-xs sm:text-sm font-bold whitespace-nowrap" style={{ color: themeDark }}>
                Select Store:
              </label>
              <select
                id="master-store-select"
                value={selectedStoreFilter}
                onChange={(e) => setSelectedStoreFilter(e.target.value)}
                className="bg-white border text-gray-900 text-xs sm:text-sm rounded-lg p-2 font-semibold cursor-pointer outline-none transition-shadow"
                style={{
                  borderColor: themeBorder,
                }}
              >
                <option value="ALL">All Stores</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label || s.shopDomain} {s.isMaster ? '(Master)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {displayedStores.length === 0 ? (
            <p className="text-xs sm:text-sm text-gray-500 m-0">No stores available to configure.</p>
          ) : (
            displayedStores.map((s) => {
              return (
                <ThemedSection
                  key={s.id}
                  title={`${s.label || s.shopDomain} Adjustments`}
                  description={`Manage collection-specific price adjustments for ${s.shopDomain}`}
                  bgColor={themeCardBg}
                  borderColor={themeBorder}
                  stripeColor={themePrimary}
                  titleColor={themeDark}
                  descColor={themePrimary}
                >
                  <div className="flex flex-col gap-4 sm:gap-6 mt-2">
                    {/* Collection Adjustment */}
                    <div
                      className="p-4 sm:p-6 bg-white rounded-xl shadow-2xs overflow-x-auto transition-colors"
                      style={{ border: `1px solid ${themeBorder}40` }}
                    >
                      <CollectionPriceAdjustment storeId={s.id} storeName={s.label || s.shopDomain} />
                    </div>
                  </div>
                </ThemedSection>
              );
            })
          )}
        </div>
      </div>

      {toastMessage && (
        <div
          className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 px-4 sm:px-6 py-3 rounded-lg shadow-lg flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold text-white max-w-[calc(100vw-32px)] sm:max-w-md ${toastMessage.type === 'success' ? 'bg-emerald-600 border border-emerald-500' : 'bg-red-600 border border-red-500'
            }`}
          style={{ animation: 'settingsToastSlideIn 0.3s ease-out' }}
        >
          <style>{`
            @keyframes settingsToastSlideIn {
              from { transform: translateY(100px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>
          <span className="truncate">{toastMessage.message}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="bg-transparent border-none text-white cursor-pointer ml-2 text-sm opacity-80 hover:opacity-100 shrink-0"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
