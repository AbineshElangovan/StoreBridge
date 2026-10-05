'use client';

import React, { useState, useEffect } from 'react';
import { ThemedSection } from '@/components/ui/ThemedSection';
import { NumberSettingInput } from './NumberSettingInput';
import { StoreLogo } from '@/components/common';
import { Icon } from '@shopify/polaris';
import { CheckIcon } from '@shopify/polaris-icons';

export interface StorePlanningSetting {
  id: string;
  label: string;
  shopDomain: string;
  isMaster: boolean;
  isStandalone?: boolean;
  highRiskDays: number;
  forecastPeriodDays: number;
  salesHistoryPeriodDays: number;
  safetyStockDays: number;
  bestSellerThreshold?: number;
  deadStockDays?: number;
}

interface PlanningStoreConfigProps {
  stores: StorePlanningSetting[];
  onSavePlanningRules: (
    storeId: string,
    values: {
      highRiskDays: number;
      forecastPeriodDays: number;
      salesHistoryPeriodDays: number;
      safetyStockDays: number;
      bestSellerThreshold: number;
      deadStockDays: number;
    }
  ) => Promise<boolean>;
  isSaving: boolean;
}

export function PlanningStoreConfig({
  stores,
  onSavePlanningRules,
  isSaving
}: PlanningStoreConfigProps) {
  const [formData, setFormData] = useState<{
    [storeId: string]: {
      highRiskDays: string;
      forecastPeriodDays: string;
      salesHistoryPeriodDays: string;
      safetyStockDays: string;
      bestSellerThreshold: string;
      deadStockDays: string;
    };
  }>({});

  const [savingStoreId, setSavingStoreId] = useState<string | null>(null);
  const [successStoreId, setSuccessStoreId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    [storeId: string]: {
      highRiskDays?: string;
      forecastPeriodDays?: string;
      salesHistoryPeriodDays?: string;
      safetyStockDays?: string;
      bestSellerThreshold?: string;
      deadStockDays?: string;
    };
  }>({});

  useEffect(() => {
    if (stores && stores.length > 0) {
      setFormData((prev) => {
        const updated = { ...prev };
        stores.forEach((s) => {
          if (!updated[s.id]) {
            updated[s.id] = {
              highRiskDays: s.highRiskDays !== undefined && s.highRiskDays !== null ? String(s.highRiskDays) : '10',
              forecastPeriodDays: s.forecastPeriodDays !== undefined && s.forecastPeriodDays !== null ? String(s.forecastPeriodDays) : '7',
              salesHistoryPeriodDays: s.salesHistoryPeriodDays !== undefined && s.salesHistoryPeriodDays !== null ? String(s.salesHistoryPeriodDays) : '30',
              safetyStockDays: s.safetyStockDays !== undefined && s.safetyStockDays !== null ? String(s.safetyStockDays) : '3',
              bestSellerThreshold: s.bestSellerThreshold !== undefined && s.bestSellerThreshold !== null ? String(s.bestSellerThreshold) : '20',
              deadStockDays: s.deadStockDays !== undefined && s.deadStockDays !== null ? String(s.deadStockDays) : '90'
            };
          }
        });
        return updated;
      });
    }
  }, [stores]);

  const handleChange = (
    storeId: string,
    field: 'highRiskDays' | 'forecastPeriodDays' | 'salesHistoryPeriodDays' | 'safetyStockDays' | 'bestSellerThreshold' | 'deadStockDays',
    value: string
  ) => {
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
          highRiskDays: store.highRiskDays !== undefined && store.highRiskDays !== null ? String(store.highRiskDays) : '10',
          forecastPeriodDays: store.forecastPeriodDays !== undefined && store.forecastPeriodDays !== null ? String(store.forecastPeriodDays) : '7',
          salesHistoryPeriodDays: store.salesHistoryPeriodDays !== undefined && store.salesHistoryPeriodDays !== null ? String(store.salesHistoryPeriodDays) : '30',
          safetyStockDays: store.safetyStockDays !== undefined && store.safetyStockDays !== null ? String(store.safetyStockDays) : '3',
          bestSellerThreshold: store.bestSellerThreshold !== undefined && store.bestSellerThreshold !== null ? String(store.bestSellerThreshold) : '20',
          deadStockDays: store.deadStockDays !== undefined && store.deadStockDays !== null ? String(store.deadStockDays) : '90'
        }
      }));
      setErrors((prev) => ({ ...prev, [storeId]: {} }));
    }
  };

  const handleSave = async (storeId: string) => {
    const current = formData[storeId] || {
      highRiskDays: '10',
      forecastPeriodDays: '7',
      salesHistoryPeriodDays: '30',
      safetyStockDays: '3',
      bestSellerThreshold: '20',
      deadStockDays: '90'
    };

    const fieldErrors: {
      highRiskDays?: string;
      forecastPeriodDays?: string;
      salesHistoryPeriodDays?: string;
      safetyStockDays?: string;
      bestSellerThreshold?: string;
      deadStockDays?: string;
    } = {};

    const hr = parseInt(current.highRiskDays, 10);
    if (!current.highRiskDays || isNaN(hr) || hr <= 0) {
      fieldErrors.highRiskDays = 'Enter a valid number of days (> 0).';
    }

    const fc = parseInt(current.forecastPeriodDays, 10);
    if (!current.forecastPeriodDays || isNaN(fc) || fc <= 0) {
      fieldErrors.forecastPeriodDays = 'Enter a valid forecast period (> 0).';
    }

    const sh = parseInt(current.salesHistoryPeriodDays, 10);
    if (!current.salesHistoryPeriodDays || isNaN(sh) || sh <= 0) {
      fieldErrors.salesHistoryPeriodDays = 'Enter a valid history window (> 0).';
    }

    const ss = parseInt(current.safetyStockDays, 10);
    if (isNaN(ss) || ss < 0) {
      fieldErrors.safetyStockDays = 'Enter a valid buffer stock (>= 0).';
    }

    const bs = parseInt(current.bestSellerThreshold, 10);
    if (!current.bestSellerThreshold || isNaN(bs) || bs <= 0) {
      fieldErrors.bestSellerThreshold = 'Enter a valid threshold (> 0).';
    }

    const ds = parseInt(current.deadStockDays, 10);
    if (!current.deadStockDays || isNaN(ds) || ds <= 0) {
      fieldErrors.deadStockDays = 'Enter valid consecutive days (> 0).';
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors((prev) => ({ ...prev, [storeId]: fieldErrors }));
      return;
    }

    setSavingStoreId(storeId);
    setSuccessStoreId(null);

    const success = await onSavePlanningRules(storeId, {
      highRiskDays: hr,
      forecastPeriodDays: fc,
      salesHistoryPeriodDays: sh,
      safetyStockDays: ss,
      bestSellerThreshold: bs,
      deadStockDays: ds
    });

    setSavingStoreId(null);
    if (success) {
      setSuccessStoreId(storeId);
      setTimeout(() => {
        setSuccessStoreId((curr) => (curr === storeId ? null : curr));
      }, 3000);
    }
  };

  return (
    <ThemedSection
      title="Planning Store Config"
      description="Configure low stock alerts, demand forecast periods, past sales analysis windows, and buffer stock per store."
    >
      <div className="flex flex-col gap-5 mt-2">
        {stores.length === 0 ? (
          <p className="text-sm text-gray-500 italic p-4 text-center">No stores available to configure.</p>
        ) : (
          stores.map((store) => {
            const storeValues = formData[store.id] || {
              highRiskDays: '10',
              forecastPeriodDays: '7',
              salesHistoryPeriodDays: '30',
              safetyStockDays: '3',
              bestSellerThreshold: '20',
              deadStockDays: '90'
            };
            const storeErrors = errors[store.id] || {};
            const isStoreSaving = savingStoreId === store.id || isSaving;
            const isStoreSuccess = successStoreId === store.id;

            return (
              <div
                key={store.id}
                className="bg-white/95 border border-[var(--border-color)] rounded-xl p-4 sm:p-5 shadow-2xs transition-all hover:border-[var(--color-primary)]/60"
              >
                {/* Store Header Info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <StoreLogo shopDomain={store.shopDomain} label={store.label} isMaster={store.isMaster} size="sm" />
                    <span className="font-bold text-base text-gray-900">{store.label || store.shopDomain}</span>
                    {store.isMaster ? (
                      <span 
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border shadow-2xs"
                        style={{
                          backgroundColor: 'var(--color-primary-light)',
                          color: 'var(--color-primary)',
                          borderColor: 'var(--theme-border-accent)'
                        }}
                      >
                        MASTER
                      </span>
                    ) : store.isStandalone ? (
                      <span
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-2xs"
                        style={{
                          backgroundColor: 'var(--theme-surface-2, #e2e8f0)',
                          color: 'var(--theme-text-muted, #64748b)',
                          borderColor: 'var(--theme-border, #cbd5e1)',
                        }}
                      >
                        STANDALONE
                      </span>
                    ) : (
                      <span 
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-2xs"
                        style={{
                          backgroundColor: 'var(--color-primary-light)',
                          color: 'var(--color-primary)',
                          borderColor: 'var(--theme-border-accent)',
                          opacity: 0.8,
                        }}
                      >
                        CONNECTED
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono text-gray-400">{store.shopDomain}</span>
                </div>

                {/* Planning & Risk Parameters Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                  {/* Low Stock Alert */}
                  <NumberSettingInput
                    id={`high-risk-${store.id}`}
                    label="Low Stock Alert (Days)"
                    value={storeValues.highRiskDays}
                    onChange={(val) => handleChange(store.id, 'highRiskDays', val)}
                    error={storeErrors.highRiskDays}
                    helpText="Alerts as High Risk if your stock will run out within this many days (e.g. supplier delivery time)."
                    disabled={isStoreSaving}
                    min={1}
                    placeholder="10"
                    quickPicks={[5, 10, 15, 30]}
                    quickPickUnit="days"
                  />

                  {/* Forecast Period */}
                  <NumberSettingInput
                    id={`forecast-days-${store.id}`}
                    label="Forecast Period (Days)"
                    value={storeValues.forecastPeriodDays}
                    onChange={(val) => handleChange(store.id, 'forecastPeriodDays', val)}
                    error={storeErrors.forecastPeriodDays}
                    helpText="Number of upcoming days to forecast customer demand and sales (default: 7 days)."
                    disabled={isStoreSaving}
                    min={1}
                    placeholder="7"
                  />

                  {/* Past Sales Analyzed */}
                  <NumberSettingInput
                    id={`history-days-${store.id}`}
                    label="Past Sales Analyzed (Days)"
                    value={storeValues.salesHistoryPeriodDays}
                    onChange={(val) => handleChange(store.id, 'salesHistoryPeriodDays', val)}
                    error={storeErrors.salesHistoryPeriodDays}
                    helpText="Number of past sales days used to calculate average daily sales speed (default: 30 days)."
                    disabled={isStoreSaving}
                    min={1}
                    placeholder="30"
                  />

                  {/* Extra Buffer Stock */}
                  <NumberSettingInput
                    id={`safety-stock-${store.id}`}
                    label="Extra Buffer Stock (Days)"
                    value={storeValues.safetyStockDays}
                    onChange={(val) => handleChange(store.id, 'safetyStockDays', val)}
                    error={storeErrors.safetyStockDays}
                    helpText="Extra buffer days of stock added to restock orders to prevent sudden stockouts."
                    disabled={isStoreSaving}
                    min={0}
                    placeholder="3"
                  />

                  {/* Best Seller Threshold */}
                  <NumberSettingInput
                    id={`bestseller-${store.id}`}
                    label="Best Seller Threshold (Units)"
                    value={storeValues.bestSellerThreshold}
                    onChange={(val) => handleChange(store.id, 'bestSellerThreshold', val)}
                    error={storeErrors.bestSellerThreshold}
                    helpText="Minimum units sold in 30 days to qualify as Best Seller."
                    disabled={isStoreSaving}
                    min={1}
                    placeholder="20"
                  />

                  {/* Dead Stock Inactivity */}
                  <NumberSettingInput
                    id={`deadstock-${store.id}`}
                    label="Dead Stock Days (Days)"
                    value={storeValues.deadStockDays}
                    onChange={(val) => handleChange(store.id, 'deadStockDays', val)}
                    error={storeErrors.deadStockDays}
                    helpText="Consecutive days of zero sales to flag as Dead Stock."
                    disabled={isStoreSaving}
                    min={1}
                    placeholder="90"
                  />
                </div>

                {/* Action Buttons & Feedback */}
                <div className="flex items-center justify-end gap-3 mt-5 pt-3 border-t border-gray-100">
                  {isStoreSuccess && (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 mr-auto">
                      <div style={{ width: 14, height: 14 }}>
                        <Icon source={CheckIcon} tone="success" />
                      </div>
                      Settings saved successfully!
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleCancel(store.id)}
                    disabled={isStoreSaving}
                    className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                  >
                    Reset
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSave(store.id)}
                    disabled={isStoreSaving}
                    className="px-4 py-2 text-xs font-bold text-white rounded-lg focus:outline-none transition-all shadow-2xs disabled:opacity-50 cursor-pointer flex items-center gap-2"
                    style={{
                      backgroundColor: 'var(--color-primary)'
                    }}
                  >
                    {isStoreSaving ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                        Saving...
                      </>
                    ) : (
                      'Save Planning Config'
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </ThemedSection>
  );
}
