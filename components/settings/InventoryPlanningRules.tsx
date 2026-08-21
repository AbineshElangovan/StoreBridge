'use client';

import React, { useState, useEffect } from 'react';
import { NumberSettingInput } from './NumberSettingInput';

interface StoreItem {
  id: string;
  label: string;
  shopDomain: string;
  isMaster: boolean;
  forecastPeriodDays?: number;
  salesHistoryPeriodDays?: number;
  supplierLeadTimeDays?: number;
  safetyStockDays?: number;
}

interface InventoryPlanningRulesProps {
  stores: StoreItem[];
  onSaveStoreRules: (
    storeId: string,
    forecastPeriodDays: number,
    salesHistoryPeriodDays: number,
    supplierLeadTimeDays: number,
    safetyStockDays: number
  ) => Promise<void>;
  isSaving?: boolean;
}

export function InventoryPlanningRules({
  stores,
  onSaveStoreRules,
  isSaving = false
}: InventoryPlanningRulesProps) {
  const [formData, setFormData] = useState<Record<string, {
    forecastPeriodDays: string;
    salesHistoryPeriodDays: string;
    supplierLeadTimeDays: string;
    safetyStockDays: string;
  }>>({});

  const [errors, setErrors] = useState<Record<string, Record<string, string | null>>>({});
  const [successStoreId, setSuccessStoreId] = useState<string | null>(null);

  useEffect(() => {
    const initialForm: Record<string, any> = {};
    stores.forEach((s) => {
      initialForm[s.id] = {
        forecastPeriodDays: s.forecastPeriodDays !== undefined && s.forecastPeriodDays !== null ? String(s.forecastPeriodDays) : '',
        salesHistoryPeriodDays: s.salesHistoryPeriodDays !== undefined && s.salesHistoryPeriodDays !== null ? String(s.salesHistoryPeriodDays) : '',
        supplierLeadTimeDays: s.supplierLeadTimeDays !== undefined && s.supplierLeadTimeDays !== null ? String(s.supplierLeadTimeDays) : '',
        safetyStockDays: s.safetyStockDays !== undefined && s.safetyStockDays !== null ? String(s.safetyStockDays) : '',
      };
    });
    setFormData(initialForm);
  }, [stores]);

  const handleChange = (storeId: string, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [storeId]: {
        ...(prev[storeId] || {
          forecastPeriodDays: '',
          salesHistoryPeriodDays: '',
          supplierLeadTimeDays: '',
          safetyStockDays: ''
        }),
        [field]: value
      }
    }));

    if (errors[storeId]?.[field]) {
      setErrors((prev) => ({
        ...prev,
        [storeId]: {
          ...(prev[storeId] || {}),
          [field]: null
        }
      }));
    }
  };

  const handleReset = (store: StoreItem) => {
    setFormData((prev) => ({
      ...prev,
      [store.id]: {
        forecastPeriodDays: store.forecastPeriodDays !== undefined && store.forecastPeriodDays !== null ? String(store.forecastPeriodDays) : '',
        salesHistoryPeriodDays: store.salesHistoryPeriodDays !== undefined && store.salesHistoryPeriodDays !== null ? String(store.salesHistoryPeriodDays) : '',
        supplierLeadTimeDays: store.supplierLeadTimeDays !== undefined && store.supplierLeadTimeDays !== null ? String(store.supplierLeadTimeDays) : '',
        safetyStockDays: store.safetyStockDays !== undefined && store.safetyStockDays !== null ? String(store.safetyStockDays) : ''
      }
    }));
    setErrors((prev) => ({
      ...prev,
      [store.id]: {}
    }));
  };

  const handleSave = async (store: StoreItem) => {
    const storeForm = formData[store.id] || {
      forecastPeriodDays: '',
      salesHistoryPeriodDays: '',
      supplierLeadTimeDays: '',
      safetyStockDays: ''
    };

    const fcVal = parseInt(storeForm.forecastPeriodDays, 10);
    const shVal = parseInt(storeForm.salesHistoryPeriodDays, 10);
    const ltVal = store.supplierLeadTimeDays || 7;
    const ssVal = parseInt(storeForm.safetyStockDays, 10);

    const storeErr: Record<string, string | null> = {};

    if (!storeForm.forecastPeriodDays || isNaN(fcVal) || fcVal <= 0) {
      storeErr.forecastPeriodDays = 'Forecast period must be greater than 0';
    }
    if (!storeForm.salesHistoryPeriodDays || isNaN(shVal) || shVal <= 0) {
      storeErr.salesHistoryPeriodDays = 'Sales history period must be greater than 0';
    }
    if (!storeForm.safetyStockDays || isNaN(ssVal) || ssVal <= 0) {
      storeErr.safetyStockDays = 'Safety stock days must be greater than 0';
    }

    if (Object.keys(storeErr).length > 0) {
      setErrors((prev) => ({ ...prev, [store.id]: storeErr }));
      return;
    }

    try {
      await onSaveStoreRules(store.id, fcVal, shVal, ltVal, ssVal);
      setSuccessStoreId(store.id);
      setTimeout(() => {
        setSuccessStoreId(null);
      }, 3000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-white border border-sky-100 rounded-2xl p-6 shadow-2xs">
      <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4">
        <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-700">
          <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 leading-tight">
            Inventory Planning Rules
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure store-specific demand forecast periods, sales history windows, supplier lead times, and safety stock.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5 mt-3">
        {stores.map((store) => {
          const storeForm = formData[store.id] || {
            forecastPeriodDays: store.forecastPeriodDays !== undefined && store.forecastPeriodDays !== null ? String(store.forecastPeriodDays) : '',
            salesHistoryPeriodDays: store.salesHistoryPeriodDays !== undefined && store.salesHistoryPeriodDays !== null ? String(store.salesHistoryPeriodDays) : '',
            supplierLeadTimeDays: store.supplierLeadTimeDays !== undefined && store.supplierLeadTimeDays !== null ? String(store.supplierLeadTimeDays) : '',
            safetyStockDays: store.safetyStockDays !== undefined && store.safetyStockDays !== null ? String(store.safetyStockDays) : '',
          };

          const storeErr = errors[store.id] || {};

          return (
            <div
              key={store.id}
              className="flex flex-col gap-4 p-4 sm:p-5 border border-sky-100 rounded-xl bg-white shadow-2xs"
            >
              {/* Store Header */}
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

              {/* Planning Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                <NumberSettingInput
                  id={`fc-days-${store.id}`}
                  label="Forecast Period (Days)"
                  value={storeForm.forecastPeriodDays}
                  onChange={(val) => handleChange(store.id, 'forecastPeriodDays', val)}
                  error={storeErr.forecastPeriodDays}
                  helpText="Future period used to estimate demand"
                  disabled={isSaving}
                  placeholder="Enter days"
                />

                <NumberSettingInput
                  id={`sh-days-${store.id}`}
                  label="Sales History Period (Days)"
                  value={storeForm.salesHistoryPeriodDays}
                  onChange={(val) => handleChange(store.id, 'salesHistoryPeriodDays', val)}
                  error={storeErr.salesHistoryPeriodDays}
                  helpText="Past period used to compute daily sales"
                  disabled={isSaving}
                  placeholder="Enter days"
                />

                <NumberSettingInput
                  id={`ss-days-${store.id}`}
                  label="Safety Stock (Days)"
                  value={storeForm.safetyStockDays}
                  onChange={(val) => handleChange(store.id, 'safetyStockDays', val)}
                  error={storeErr.safetyStockDays}
                  helpText="Buffer days of extra stock required"
                  disabled={isSaving}
                  placeholder="Enter days"
                />
              </div>

              {/* Actions & Status */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                {successStoreId === store.id && (
                  <span className="text-xs font-bold text-emerald-600 sm:mr-auto flex items-center gap-1">
                    <svg className="w-4 h-4 fill-current text-emerald-600 shrink-0" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Inventory Planning Rules saved!
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => handleReset(store)}
                  disabled={isSaving}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors duration-150 disabled:opacity-50 text-center"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => handleSave(store)}
                  disabled={isSaving}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 rounded-lg transition-colors duration-150 shadow-2xs disabled:opacity-50 flex items-center justify-center gap-1.5 text-center"
                >
                  {isSaving ? 'Saving...' : 'Save Rules'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
