"use client";

import React, { useState, useEffect } from 'react';
import { Input, Checkbox, Select } from '@/components/forms';
import { useRouter } from 'next/navigation';
import { shopifyFetch } from '@/lib/shopify/Client';
import { Button } from '@/components/common/Button';
import { ThemedSection } from '@/components/ui/ThemedSection';
import { LocalizedDate } from '@/components/common/LocalizedDate';
import { Loading, Toast } from '@/components/common';
import { StoreRoleBadge } from '@/components/ui/StoreRoleBadge';
import { useStoreContext } from '@/components/providers/StoreProvider';
import { ConfirmToast } from '@/components/ui/ConfirmToast';
import { StorePerformanceRules, StorePerformanceSetting } from '@/components/settings/StorePerformanceRules';
import { Icon } from '@shopify/polaris';
import { CheckIcon } from '@shopify/polaris-icons';


export default function SettingsPage() {
  const router = useRouter();
  const { isStandalone } = useStoreContext();
  const [stores, setStores] = useState<any[]>([]);
  const [performanceStores, setPerformanceStores] = useState<StorePerformanceSetting[]>([]);
  const [threshold, setThreshold] = useState<string>('15');
  const [customThreshold, setCustomThreshold] = useState<string>('15');
  const [debugOutput, setDebugOutput] = useState<string>('');
  const [autoSync, setAutoSync] = useState<boolean>(true);
  const [dataRetentionEnabled, setDataRetentionEnabled] = useState<boolean>(true);
  const [notifyLowStock, setNotifyLowStock] = useState<boolean>(true);
  const [notifyInventoryUpdate, setNotifyInventoryUpdate] = useState<boolean>(true);
  const [notifyPriceUpdate, setNotifyPriceUpdate] = useState<boolean>(true);
  const [notifySyncUpdate, setNotifySyncUpdate] = useState<boolean>(true);
  const [notifySyncFailure, setNotifySyncFailure] = useState<boolean>(true);
  const [notifyStoreUpdate, setNotifyStoreUpdate] = useState<boolean>(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [masterLabels, setMasterLabels] = useState<{ [storeId: string]: string }>({});
  const [masterSaving, setMasterSaving] = useState(false);
  const [masterStoreId, setMasterStoreId] = useState<string | null>(null);

  const [standaloneSaving, setStandaloneSaving] = useState(false);
  const [confirmState, setConfirmState] = useState<{ open: boolean; storeId: string; autoLabel: string; isAlreadyMaster: boolean; type: 'MASTER' | 'STANDALONE' } | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      const storesRes = await shopifyFetch(`/api/stores?active=false`, { cache: 'no-store' });
      if (storesRes.ok) {
        const storesJson = await storesRes.json();
        setDebugOutput(JSON.stringify(storesJson));
        const loadedStores = storesJson.stores || [];
        setStores(loadedStores);

        const currentSettings = storesJson.storeSettings || {};
        if (currentSettings.threshold) setThreshold(currentSettings.threshold.toString());
        const initialMasterLabels: { [storeId: string]: string } = {};
        let initialMasterStoreId = null;

        loadedStores.forEach((store: any) => {
          initialMasterLabels[store.id] = store.masterLabel || '';
          if (store.isMaster) {
            initialMasterStoreId = store.id;
          }
        });
        setMasterLabels(initialMasterLabels);
        setMasterStoreId(initialMasterStoreId);
      } else {
        const errText = await storesRes.text();
        setDebugOutput(`API ERROR ${storesRes.status}: ${errText}`);
      }

      const settingsRes = await shopifyFetch(`/api/settings`, { cache: 'no-store' });
      if (settingsRes.ok) {
        const settingsJson = await settingsRes.json();
        const s = settingsJson.settings || {};
        if (settingsJson.stores) setPerformanceStores(settingsJson.stores);
        const threshVal = s.lowStockThreshold;
        setAutoSync(s.autoSyncEnabled);
        if (typeof s.dataRetentionEnabled === 'boolean') setDataRetentionEnabled(s.dataRetentionEnabled);
        if (typeof s.notifyLowStock === 'boolean') setNotifyLowStock(s.notifyLowStock);
        if (typeof s.notifyInventoryUpdate === 'boolean') setNotifyInventoryUpdate(s.notifyInventoryUpdate);
        if (typeof s.notifyPriceUpdate === 'boolean') setNotifyPriceUpdate(s.notifyPriceUpdate);
        if (typeof s.notifySyncUpdate === 'boolean') setNotifySyncUpdate(s.notifySyncUpdate);
        if (typeof s.notifySyncFailure === 'boolean') setNotifySyncFailure(s.notifySyncFailure);
        if (typeof s.notifyStoreUpdate === 'boolean') setNotifyStoreUpdate(s.notifyStoreUpdate);

        if ([5, 10, 20].includes(threshVal)) {
          setThreshold(threshVal.toString());
        } else {
          setThreshold('custom');
          setCustomThreshold(threshVal.toString());
        }
      }
    } catch (err) {
      console.error("Error loading settings data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSavePerformanceRules = async (targetStoreId: string, bestSellerThreshold: number, deadStockDays: number) => {
    try {
      const res = await shopifyFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          targetStoreId,
          bestSellerThreshold,
          deadStockDays
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.stores) setPerformanceStores(data.stores);
        setToastMessage({ message: 'Store Performance Rules saved.', type: 'success' });
        return true;
      } else {
        setToastMessage({ message: `Save failed: ${data.error}`, type: 'error' });
        return false;
      }
    } catch (err: any) {
      setToastMessage({ message: 'Save failed.', type: 'error' });
      return false;
    }
  };

  const handleSaveInventoryPlanningRules = async (
    targetStoreId: string,
    forecastPeriodDays: number,
    salesHistoryPeriodDays: number,
    supplierLeadTimeDays: number,
    safetyStockDays: number
  ) => {
    try {
      const res = await shopifyFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          targetStoreId,
          forecastPeriodDays,
          salesHistoryPeriodDays,
          supplierLeadTimeDays,
          safetyStockDays
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.stores) setPerformanceStores(data.stores);
        setToastMessage({ message: 'Inventory Planning Rules saved.', type: 'success' });
      } else {
        setToastMessage({ message: `Save failed: ${data.error}`, type: 'error' });
      }
    } catch (err: any) {
      setToastMessage({ message: 'Save failed.', type: 'error' });
    }
  };

  const hasLoadedRef = React.useRef(false);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadData();
  }, [loadData]);

  // Automatically hide any toast message after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleMasterLabelChange = (storeId: string, val: string) => {
    setMasterLabels(prev => ({ ...prev, [storeId]: val }));
  };

  const promptSetMaster = (storeId: string, autoLabel: string, isAlreadyMaster: boolean = false) => {
    setConfirmState({
      open: true,
      storeId,
      autoLabel,
      isAlreadyMaster,
      type: 'MASTER'
    });
  };

  const promptMakeStandalone = (storeId: string) => {
    const targetStore = stores.find((s) => s.id === storeId);
    if (targetStore?.isMaster) return;
    setConfirmState({
      open: true,
      storeId,
      autoLabel: '',
      isAlreadyMaster: false,
      type: 'STANDALONE'
    });
  };

  const handleSetMaster = async (storeId: string, autoLabel: string) => {
    setMasterSaving(true);
    try {
      const res = await shopifyFetch('/api/stores/master', {
        method: 'PUT',
        body: JSON.stringify({ storeId, masterLabel: autoLabel })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setToastMessage({ message: 'Master store changed successfully.', type: 'success' });
        setTimeout(() => {
          setToastMessage(prev => prev?.message === 'Master store changed successfully.' ? null : prev);
        }, 3000);
        await loadData();
        router.refresh();
      } else {
        setToastMessage({ message: `Failed: ${data.error}`, type: 'error' });
        setTimeout(() => {
          setToastMessage(prev => prev?.message === `Failed: ${data.error}` ? null : prev);
        }, 3000);
      }
    } catch (err: any) {
      setToastMessage({ message: 'Failed to change Master store.', type: 'error' });
      setTimeout(() => {
        setToastMessage(prev => prev?.message === 'Failed to change Master store.' ? null : prev);
      }, 3000);
    } finally {
      setMasterSaving(false);
    }
  };

  const handleMakeStandalone = async (storeId: string) => {
    setStandaloneSaving(true);
    try {
      const res = await shopifyFetch('/api/stores/standalone', {
        method: 'PUT',
        body: JSON.stringify({ storeId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToastMessage({ message: 'Store is now standalone.', type: 'success' });
        setTimeout(() => setToastMessage(null), 3000);
        await loadData();
        router.refresh();
      } else {
        setToastMessage({ message: `Failed: ${data.error}`, type: 'error' });
      }
    } catch (err: any) {
      setToastMessage({ message: 'Failed to make store standalone.', type: 'error' });
    } finally {
      setStandaloneSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const finalThreshold = threshold === 'custom'
        ? parseInt(customThreshold, 10) || 15
        : parseInt(threshold, 10);

      // Save threshold, autoSync, dataRetention, and notification settings
      const settingsRes = await shopifyFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          lowStockThreshold: finalThreshold,
          autoSyncEnabled: autoSync,
          dataRetentionEnabled: dataRetentionEnabled,
          notifyLowStock,
          notifyInventoryUpdate,
          notifyPriceUpdate,
          notifySyncUpdate,
          notifySyncFailure,
          notifyStoreUpdate,
        }),
      });

      if (settingsRes.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Error saving settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const formattedStores = stores.map((s) => ({
    id: s.id,
    domain: s.shopDomain,
    label: s.label || s.shopDomain,
    status: s.isActive ? 'CONNECTED' : 'DISCONNECTED',
    installedAt: <LocalizedDate date={s.installedAt} format="date" />,
  }));

  if (loading) {
    return <Loading label="Loading settings..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full overflow-x-hidden">
      <div className="flex flex-col gap-6 sm:gap-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="page-title text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight m-0">
              Settings
            </h1>
            <p className="page-subtitle text-lg sm:text-xl font-medium text-slate-500 mt-1.5 m-0">
              Manage store connections, threshold alerts, and synchronization rules.
            </p>
          </div>
        </div>

        {/* Configurations Grid */}
        <div className="flex flex-col lg:flex-row gap-6 sm:gap-8">
          {!isStandalone && (
            <div className="flex-1 flex flex-col gap-6 min-w-0">
              <ThemedSection
                title="Master Store Configuration"
                description="Identify the primary store. Synchronization originates from the Master Store."
                bgColor="#fff1f2"
                borderColor="#fecdd3"
                stripeColor="#f43f5e"
                titleColor="#9f1239"
                descColor="#be123c"
              >
                <div className="flex flex-col gap-3 sm:gap-4 mt-2">
                  {stores.length === 0 ? (
                    <div>
                      <p className="text-xs text-gray-500 m-0">No stores available to configure.</p>
                      <pre className="text-xs text-red-500 mt-2 whitespace-pre-wrap">{debugOutput}</pre>
                    </div>
                  ) : (
                    stores.map((s) => (
                      <div
                        key={s.id}
                        className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl border gap-4 transition-all ${s.isMaster
                            ? 'border-indigo-500 bg-indigo-50/70 shadow-2xs'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm sm:text-base text-gray-900 truncate">
                              {s.label || s.shopDomain}
                            </span>
                            {s.isMaster && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-800 text-white uppercase tracking-wider shadow-2xs shrink-0">
                                MASTER
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 truncate max-w-full sm:max-w-xs">
                            {s.shopDomain}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto shrink-0 justify-start sm:justify-end">
                          {!s.isMaster && (
                            <button
                              className="px-3.5 py-2 bg-[var(--color-primary-dark)] hover:bg-[var(--color-primary)] text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors shadow-2xs disabled:opacity-50 cursor-pointer flex-1 sm:flex-none text-center"
                              disabled={masterSaving}
                              onClick={() => promptSetMaster(s.id, masterLabels[s.id] || (s.label || s.shopDomain).replace('.myshopify.com', ''), false)}
                            >
                              {masterSaving ? 'Saving...' : 'Make Master'}
                            </button>
                          )}
                          <button
                            className={`px-3.5 py-2 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors shadow-2xs flex-1 sm:flex-none text-center ${s.isMaster ? 'bg-gray-400 cursor-not-allowed opacity-60' : 'bg-blue-600 hover:bg-blue-700 cursor-pointer disabled:opacity-50'}`}
                            disabled={standaloneSaving || s.isMaster}
                            title={s.isMaster ? "Master store cannot be set as standalone directly." : undefined}
                            onClick={() => promptMakeStandalone(s.id)}
                          >
                            Make Standalone
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                    <span className="font-semibold shrink-0">Note:</span>
                    <span>
                      Master store cannot be changed to Standalone directly. To disconnect this store, please set another connected store as Master first.
                    </span>
                  </div>
                </div>
              </ThemedSection>
            </div>
          )}

          {/* Right Column (Threshold Settings) */}
          <div className={`w-full ${isStandalone ? 'max-w-4xl' : 'lg:w-[360px] shrink-0'} flex flex-col gap-6`}>
            <ThemedSection
              title="Store Configurations"
              bgColor="#fffbeb"
              borderColor="#fde68a"
              stripeColor="#f59e0b"
              titleColor="#b45309"
            >
              <div className="flex flex-col gap-4 mt-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Low Stock Alert Threshold</h3>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-amber-100/50 transition-colors cursor-pointer text-sm text-gray-700 font-medium">
                      <input type="radio" name="threshold" checked={threshold === '10'} onChange={() => setThreshold('10')} className="w-4 h-4 text-[var(--color-primary-dark)] focus:ring-[var(--color-primary-dark)]" />
                      <span>10 units</span>
                    </label>
                    <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-amber-100/50 transition-colors cursor-pointer text-sm text-gray-700 font-medium">
                      <input type="radio" name="threshold" checked={threshold === '20'} onChange={() => setThreshold('20')} className="w-4 h-4 text-[var(--color-primary-dark)] focus:ring-[var(--color-primary-dark)]" />
                      <span>20 units</span>
                    </label>
                    <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-amber-100/50 transition-colors cursor-pointer text-sm text-gray-700 font-medium">
                      <input type="radio" name="threshold" checked={threshold === 'custom'} onChange={() => setThreshold('custom')} className="w-4 h-4 text-[var(--color-primary-dark)] focus:ring-[var(--color-primary-dark)]" />
                      <span>Custom Value</span>
                    </label>
                  </div>
                </div>

                {threshold === 'custom' && (
                  <div className="mt-1">
                    <Input
                      type="number"
                      label="Custom Threshold Value"
                      labelHidden
                      value={customThreshold}
                      onChange={(val) => setCustomThreshold(val)}
                      autoComplete="off"
                    />
                  </div>
                )}

                <div className="pt-2">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      className="w-full sm:w-auto px-5 py-2 bg-[var(--color-primary-dark)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--color-primary)] transition-colors shadow-2xs disabled:opacity-50 cursor-pointer text-center"
                      disabled={saving}
                      onClick={handleSave}
                    >
                      {saving ? 'Saving...' : 'Save Threshold'}
                    </button>
                    {saveSuccess && (
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 shrink-0">
                        <div style={{ width: 14, height: 14 }}>
                          <Icon source={CheckIcon} tone="success" />
                        </div>
                        Saved!
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </ThemedSection>
          </div>
        </div>



        {/* Store Performance Rules Section */}
        <div className={`w-full ${isStandalone ? 'max-w-4xl' : ''}`}>
          <StorePerformanceRules
            stores={performanceStores}
            onSavePerformanceRules={handleSavePerformanceRules}
            isSaving={saving}
          />
        </div>

        {/* Full-width Data Handling Section */}
        <div className={`w-full ${isStandalone ? 'max-w-4xl' : ''}`}>
          <ThemedSection
            title="Data & Privacy"
            description="Data handling - Built for Shopify app review"
            bgColor="#f0fdfa"
            borderColor="#ccfbf1"
            stripeColor="#0d9488"
            titleColor="#0f766e"
            descColor="#115e59"
          >
            <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs mt-2">
              <div className="flex flex-col">
                <span className="text-sm sm:text-base font-bold text-gray-900">Store activity logs for 90 days</span>
                <span className="text-xs text-gray-500 mt-0.5">Then permanently deleted.</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 self-end sm:self-auto">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={dataRetentionEnabled}
                  onChange={(e) => setDataRetentionEnabled(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
              </label>
            </div>
          </ThemedSection>
        </div>
      </div>

      <ConfirmToast
        open={!!confirmState?.open}
        message={
          confirmState?.type === 'STANDALONE'
            ? 'Make this store standalone?'
            : confirmState?.isAlreadyMaster
              ? 'Update Master Store Label?'
              : 'Change Master Store?'
        }
        subMessage={
          confirmState?.type === 'STANDALONE'
            ? 'This store will stop synchronizing with the multi-store network.'
            : 'All connected stores will align synchronization with this store.'
        }
        confirmLabel={confirmState?.type === 'STANDALONE' ? 'Make Standalone' : 'Set as Master'}
        cancelLabel="Cancel"
        variant={confirmState?.type === 'STANDALONE' ? 'standalone' : 'master'}
        loading={masterSaving || standaloneSaving}
        onConfirm={async () => {
          if (!confirmState) return;
          const { storeId, autoLabel, type } = confirmState;
          setConfirmState(null);
          if (type === 'STANDALONE') {
            await handleMakeStandalone(storeId);
          } else {
            await handleSetMaster(storeId, autoLabel);
          }
        }}
        onCancel={() => setConfirmState(null)}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <Toast
          content={toastMessage.message}
          error={toastMessage.type === 'error'}
          onDismiss={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
