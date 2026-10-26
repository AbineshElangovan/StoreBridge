'use client';

import React, { useState, useEffect } from 'react';
import { ThemedSection } from '@/components/ui/ThemedSection';
import { NumberSettingInput } from './NumberSettingInput';

export interface StorePerformanceSetting {
  id: string;
  label: string;
  shopDomain: string;
  isMaster: boolean;
  bestSellerThreshold: number;
  deadStockDays: number;
}

interface StorePerformanceRulesProps {
  stores: StorePerformanceSetting[];
  onSavePerformanceRules: (storeId: string, bestSellerThreshold: number, deadStockDays: number) => Promise<boolean>;
  isSaving: boolean;
}

export function StorePerformanceRules({
  stores,
  onSavePerformanceRules,
  isSaving
}: StorePerformanceRulesProps) {
  const [formData, setFormData] = useState<{
    [storeId: string]: { bestSellerThreshold: string; deadStockDays: string }
  }>({});
  const [savingStoreId, setSavingStoreId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    [storeId: string]: { bestSellerThreshold?: string; deadStockDays?: string }
  }>({});
  const [successStoreId, setSuccessStoreId] = useState<string | null>(null);

  useEffect(() => {
    if (stores && stores.length > 0) {
      setFormData((prev) => {
        const updated = { ...prev };
        stores.forEach((s) => {
          if (!updated[s.id]) {
            updated[s.id] = {
              bestSellerThreshold: s.bestSellerThreshold !== undefined && s.bestSellerThreshold !== null ? String(s.bestSellerThreshold) : '',
              deadStockDays: s.deadStockDays !== undefined && s.deadStockDays !== null ? String(s.deadStockDays) : ''
            };
          }
        });
        return updated;
      });
    }
  }, [stores]);

  const handleChange = (storeId: string, field: 'bestSellerThreshold' | 'deadStockDays', value: string) => {
    setFormData((prev) => ({
      ...prev,
      [storeId]: {
        ...prev[storeId],
        [field]: value
      }
    }));
    setErrors((prev) => ({
      ...prev,
      [storeId]: {
        ...prev[storeId],
        [field]: undefined
      }
    }));
  };

  const handleCancel = (storeId: string) => {
    const store = stores.find((s) => s.id === storeId);
    if (store) {
      setFormData((prev) => ({
        ...prev,
        [storeId]: {
          bestSellerThreshold: store.bestSellerThreshold !== undefined && store.bestSellerThreshold !== null ? String(store.bestSellerThreshold) : '',
          deadStockDays: store.deadStockDays !== undefined && store.deadStockDays !== null ? String(store.deadStockDays) : ''
        }
      }));
      setErrors((prev) => ({ ...prev, [storeId]: {} }));
    }
  };

  const handleSave = async (storeId: string) => {
    const currentData = formData[storeId] || { bestSellerThreshold: '', deadStockDays: '' };
    const fieldErrors: { bestSellerThreshold?: string; deadStockDays?: string } = {};

    const bsVal = parseInt(currentData.bestSellerThreshold, 10);
    if (!currentData.bestSellerThreshold || isNaN(bsVal) || bsVal <= 0 || !Number.isInteger(Number(currentData.bestSellerThreshold))) {
      fieldErrors.bestSellerThreshold = 'Please enter a valid threshold (positive integer > 0).';
    }

    const dsVal = parseInt(currentData.deadStockDays, 10);
    if (!currentData.deadStockDays || isNaN(dsVal) || dsVal <= 0 || !Number.isInteger(Number(currentData.deadStockDays))) {
      fieldErrors.deadStockDays = 'Please enter valid consecutive days (positive integer > 0).';
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors((prev) => ({ ...prev, [storeId]: fieldErrors }));
      return;
    }

    setSavingStoreId(storeId);
    setErrors((prev) => ({ ...prev, [storeId]: {} }));
    try {
      const ok = await onSavePerformanceRules(storeId, bsVal, dsVal);
      if (ok) {
        setSuccessStoreId(storeId);
        setTimeout(() => setSuccessStoreId(null), 3000);
      }
    } finally {
      setSavingStoreId(null);
    }
  };

  if (!stores || stores.length === 0) {
    return null;
  }

  return (
    <ThemedSection
      title="Store Performance Rules"
      description="Set store-level performance thresholds. Insights dynamically applies your custom values (e.g. 120 days, 365 days) to classify your products."
      bgColor="#f0f9ff"
      borderColor="#bae6fd"
      stripeColor="#0284c7"
      titleColor="#0369a1"
      descColor="#075985"
    >
      <div className="flex flex-col gap-4 mt-3">
        {stores.map((store) => {
          const storeForm = formData[store.id] || {
            bestSellerThreshold: store.bestSellerThreshold !== undefined && store.bestSellerThreshold !== null ? String(store.bestSellerThreshold) : '',
            deadStockDays: store.deadStockDays !== undefined && store.deadStockDays !== null ? String(store.deadStockDays) : ''
          };

          const storeErr = errors[store.id] || {};

          const parsedBs = parseInt(storeForm.bestSellerThreshold, 10);
          const validBs = !isNaN(parsedBs) && parsedBs > 0 ? parsedBs : store.bestSellerThreshold;

          const parsedDs = parseInt(storeForm.deadStockDays, 10);
          const validDs = !isNaN(parsedDs) && parsedDs > 0 ? parsedDs : store.deadStockDays;

          return (
            <div
              key={store.id}
              className="flex flex-col gap-4 p-4 sm:p-5 border border-sky-100 rounded-xl bg-white shadow-2xs"
            >
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-sm sm:text-base font-bold text-gray-900 truncate">
                    {store.label}
                  </span>
                  {store.isMaster && (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 tracking-wider">
                      MASTER STORE
                    </span>
                  )}
                </div>
                <span className="self-start sm:self-auto text-xs text-gray-900 font-bold tracking-tight bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200 truncate max-w-full sm:max-w-xs">
                  {store.shopDomain}
                </span>
              </div>

              {/* Threshold Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <NumberSettingInput
                  id={`bs-threshold-${store.id}`}
                  label="Best Seller Threshold"
                  value={storeForm.bestSellerThreshold}
                  onChange={(val) => handleChange(store.id, 'bestSellerThreshold', val)}
                  error={storeErr.bestSellerThreshold}
                  helpText="Products selling above this units value"
                  disabled={isSaving}
                  placeholder="Enter threshold"
                />

                <NumberSettingInput
                  id={`ds-days-${store.id}`}
                  label="Dead Stock Days"
                  value={storeForm.deadStockDays}
                  onChange={(val) => handleChange(store.id, 'deadStockDays', val)}
                  error={storeErr.deadStockDays}
                  helpText="Mark as Dead Stock after this many days without a sale"
                  disabled={isSaving}
                  placeholder="Enter days"
                />
              </div>

              {/* Action Buttons & Status */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                {successStoreId === store.id && (
                  <span className="text-xs font-bold text-emerald-600 sm:mr-auto flex items-center gap-1">
                    <svg className="w-4 h-4 fill-current text-emerald-600 shrink-0" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Store Performance Rules saved!
                  </span>
                )}

                <button
                  type="button"
                  disabled={isSaving || savingStoreId === store.id}
                  onClick={() => handleCancel(store.id)}
                  className="w-full sm:w-auto px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 disabled:opacity-50 text-xs font-bold rounded-lg transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isSaving || savingStoreId === store.id}
                  onClick={() => handleSave(store.id)}
                  className="w-full sm:w-auto px-5 py-2 bg-[var(--color-primary,#a7cd18)] hover:bg-[var(--color-primary-hover,#96bb13)] text-[var(--color-primary-text,#000000)] border border-[var(--theme-sidebar-border,#91b212)] disabled:opacity-50 text-xs font-black rounded-lg transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-1.5 text-center"
                >
                  {savingStoreId === store.id ? 'Saving...' : 'Save'}
                </button>
              </div>

              {/* Dynamic Classification Preview Banner */}
              <div className="mt-1 pt-3 border-t border-gray-100 flex flex-col gap-2">
                <span className="text-gray-500 font-semibold text-[11px] uppercase tracking-wider">
                  Insights Rules:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1.5 rounded-md font-semibold truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
                    Best Seller: <strong className="font-bold truncate">{validBs ? `> ${validBs} sales` : 'Set threshold'}</strong>
                  </span>

                  <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1.5 rounded-md font-semibold truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0"></span>
                    Slow Mover: <strong className="font-bold truncate">{validBs ? `1 to ${validBs} sales` : 'Set threshold'}</strong>
                  </span>

                  <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-1.5 rounded-md font-semibold truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0"></span>
                    Dead Stock: <strong className="font-bold truncate">{validDs ? `0 sales (${validDs}+ days)` : 'Set days'}</strong>
                  </span>

                  <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 border border-gray-200 px-2.5 py-1.5 rounded-md font-semibold truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500 shrink-0"></span>
                    Out of Stock: <strong className="font-bold truncate">0 stock</strong>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ThemedSection>
  );
}
