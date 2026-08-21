"use client";

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/forms';
import { useRouter } from 'next/navigation';
import { shopifyFetch } from '@/lib/shopify/Client';
import CollectionPriceAdjustment from '@/components/stores/CollectionPriceAdjustment';
import { ThemedSection } from '@/components/ui/ThemedSection';
import { StoreRoleBadge } from '@/components/ui/StoreRoleBadge';
import { Loading } from '@/components/common';
import { useStoreContext } from '@/components/providers/StoreProvider';

export default function PriceAdjustmentPage() {
  const router = useRouter();
  const { isStandalone } = useStoreContext();
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [storeAdjustments, setStoreAdjustments] = useState<{ [storeId: string]: string }>({});
  const [storeSaving, setStoreSaving] = useState<{ [storeId: string]: boolean }>({});
  const [storeSuccessText, setStoreSuccessText] = useState<{ [storeId: string]: string }>({});
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const shopParam = searchParams.get('shop') || '';
      const storesRes = await shopifyFetch(`/api/stores?active=false&shop=${shopParam}&t=${Date.now()}`, { cache: 'no-store' });
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

  useEffect(() => {
    loadData();

    const handleFocus = () => loadData();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Automatically hide any toast message after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleStoreAdjustmentChange = (storeId: string, val: string) => {
    const numericValue = val.replace(/[^0-9.-]/g, '');
    
    setStoreAdjustments(prev => ({
      ...prev,
      [storeId]: numericValue
    }));
  };

  const handleStoreSave = async (storeId: string) => {
    const valStr = storeAdjustments[storeId];
    const val = parseFloat(valStr || '0');
    if (isNaN(val)) {
      setStoreSuccessText(prev => ({ ...prev, [storeId]: '✕ Invalid percentage value.' }));
      setToastMessage({ message: '❌ Failed to update price adjustment. Please try again.', type: 'error' });
      setTimeout(() => {
        setStoreSuccessText(prev => ({ ...prev, [storeId]: '' }));
        setToastMessage(prev => prev?.message === '❌ Failed to update price adjustment. Please try again.' ? null : prev);
      }, 3000);
      return;
    }

    setStoreSaving(prev => ({ ...prev, [storeId]: true }));
    try {
      const res = await shopifyFetch('/api/stores', {
        method: 'PUT',
        body: JSON.stringify({
          stores: [{
            id: storeId,
            priceAdjustmentValue: val,
            priceAdjustmentType: 'PERCENTAGE',
            isPriceAdjustmentEnabled: val !== 0,
          }]
        })
      });

      if (res.ok) {
        setStoreSuccessText(prev => ({ ...prev, [storeId]: '✓ Price adjustment updated successfully.' }));
        setToastMessage({ message: '✅ Price adjustment updated successfully.', type: 'success' });
        setTimeout(() => {
          setStoreSuccessText(prev => ({ ...prev, [storeId]: '' }));
          setToastMessage(prev => prev?.message === '✅ Price adjustment updated successfully.' ? null : prev);
        }, 3000);

        // Fetch fresh data from the server so the entire UI updates synchronously 
        await loadData();
      } else {
        setStoreSuccessText(prev => ({ ...prev, [storeId]: '✕ Failed to update price adjustment.' }));
        setToastMessage({ message: '❌ Failed to update price adjustment. Please try again.', type: 'error' });
        setTimeout(() => {
          setStoreSuccessText(prev => ({ ...prev, [storeId]: '' }));
          setToastMessage(prev => prev?.message === '❌ Failed to update price adjustment. Please try again.' ? null : prev);
        }, 3000);
      }
    } catch (err) {
      setStoreSuccessText(prev => ({ ...prev, [storeId]: '✕ Failed to update price adjustment.' }));
      setToastMessage({ message: '❌ Failed to update price adjustment. Please try again.', type: 'error' });
      setTimeout(() => {
        setStoreSuccessText(prev => ({ ...prev, [storeId]: '' }));
        setToastMessage(prev => prev?.message === '❌ Failed to update price adjustment. Please try again.' ? null : prev);
      }, 3000);
    } finally {
      setStoreSaving(prev => ({ ...prev, [storeId]: false }));
    }
  };

  if (loading) {
    return <Loading label="Loading adjustments..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <div className="flex flex-col gap-6 sm:gap-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 m-0">
              Price Adjustment
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-500 m-0">
              Configure store-specific and collection-based pricing rules for synchronized products.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
            {stores.length === 0 ? (
              <p className="text-xs sm:text-sm text-gray-500 m-0">No stores available to configure.</p>
            ) : (
              stores.map((s, index) => {
                // Alternate between 3 distinct colors, avoiding Yellow!
                const themes = [
                  { bg: '#ecfdf5', border: '#a7f3d0', stripe: '#10b981', title: '#065f46', desc: '#047857' }, // Emerald (Green)
                  { bg: '#f0f9ff', border: '#bae6fd', stripe: '#0ea5e9', title: '#0369a1', desc: '#075985' }, // Sky (Blue)
                  { bg: '#eef2ff', border: '#c7d2fe', stripe: '#6366f1', title: '#3730a3', desc: '#312e81' }, // Indigo (Purple)
                ];
                const t = themes[index % themes.length];

                return (
                  <ThemedSection
                    key={s.id}
                    title={`${s.label || s.shopDomain} Adjustments`}
                    description={`Manage collection-specific price adjustments for ${s.shopDomain}`}
                    bgColor={t.bg}
                    borderColor={t.border}
                    stripeColor={t.stripe}
                    titleColor={t.title}
                    descColor={t.desc}
                  >
                    <div className="flex flex-col gap-4 sm:gap-6 mt-2">
                      {/* Collection Adjustment */}
                      <div className="p-4 sm:p-6 bg-white border border-gray-200 rounded-xl shadow-2xs overflow-x-auto">
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
          className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 px-4 sm:px-6 py-3 rounded-lg shadow-lg flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold text-white max-w-[calc(100vw-32px)] sm:max-w-md ${
            toastMessage.type === 'success' ? 'bg-emerald-600 border border-emerald-500' : 'bg-red-600 border border-red-500'
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
