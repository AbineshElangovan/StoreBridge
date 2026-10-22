'use client';

import React, { useState, useEffect } from 'react';
import { shopifyFetch } from '@/lib/shopify/Client';
import { Loading } from '@/components/common/Loading';
import { Toast } from '@/components/common/Toast';
import { Table, ColumnConfig } from '@/components/common/Table';
import { useTheme } from '@/components/providers/ThemeContext';
import {
  SettingsCard,
  SettingsToggle,
  SettingsInput,
  SettingsTextarea,
  SaveButton,
  PreviewCard,
} from '@/components/customer-experience/shared';
import { PreorderProductSelector } from '@/components/preorder/PreorderProductSelector';
import { PreorderCollectionSelector } from '@/components/preorder/PreorderCollectionSelector';
import { StandaloneGuard } from '@/components/ui/StandaloneGuard';
import { useStoreContext } from '@/components/providers/StoreProvider';
import { PageTabs, PageTab } from '@/components/ui/PageTabs';

export type PreorderTabId = 'general' | 'offers_payment' | 'orders';

function ProductThumbnail({ src, alt }: { src?: string | null; alt?: string }) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || 'Product'}
      className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-50 shadow-xs"
      onError={() => setHasError(true)}
    />
  );
}

export default function PreorderAdminPage() {
  const { isStandalone, currentStore } = useStoreContext();
  const { currentTheme } = useTheme();
  const primaryColor = currentTheme?.primaryColor || '#047857';
  const accentColor = currentTheme?.accentColor || '#d1fae5';
  const darkColor = currentTheme?.darkColor || '#022c22';

  // Navigation tab state: 1. Setup & Products, 2. Offer & Payment, 3. Pre-order Orders
  const [activeTab, setActiveTab] = useState<PreorderTabId>('general');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Selection Mode State (Specific Product, Collection-Based, All Products)
  const [selectionMode, setSelectionMode] = useState<'ALL_PRODUCTS' | 'SPECIFIC_PRODUCTS' | 'COLLECTIONS'>('ALL_PRODUCTS');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);

  // Form State
  const [enabled, setEnabled] = useState(true);
  const [inventoryThreshold, setInventoryThreshold] = useState('0');
  const [customerMessage, setCustomerMessage] = useState("Pre-order before it's gone.");
  const [shippingMessage, setShippingMessage] = useState('Shipping: As soon as possible');
  const [fulfillmentMessage, setFulfillmentMessage] = useState(
    'We will fulfill the item as soon as it becomes available'
  );
  const [maxQuantity, setMaxQuantity] = useState<string>('');

  // Payment Options State (Full Payment vs Half Payment)
  const [paymentType, setPaymentType] = useState<'FULL' | 'HALF'>('HALF');
  const [allowHalfPayment, setAllowHalfPayment] = useState(true);
  const [allowFullPayment, setAllowFullPayment] = useState(true);
  const [defaultPaymentOption, setDefaultPaymentOption] = useState<'HALF' | 'FULL'>('HALF');
  const [showSavings, setShowSavings] = useState(true);

  // Offer / Discount State
  const [discountType, setDiscountType] = useState<'none' | 'percentage' | 'fixed'>('none');
  const [discountValue, setDiscountValue] = useState<string>('0');
  const [calculation, setCalculation] = useState<any>(null);
  const [sample100, setSample100] = useState<any>(null);
  const [calculating, setCalculating] = useState(false);

  // Pre-order Orders Records State
  const [records, setRecords] = useState<any[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsTotalPages, setRecordsTotalPages] = useState(1);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsSearch, setRecordsSearch] = useState('');
  const [recordsStatus, setRecordsStatus] = useState('ALL');

  useEffect(() => {
    fetchConfig();
    fetchRecords(1, '', 'ALL');
  }, [currentStore?.shopDomain]);

  // Fetch pure calculations from backend API whenever discount settings change
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        setCalculating(true);
        const val = parseFloat(discountValue) || 0;
        const shopParam = currentStore?.shopDomain ? `&shop=${encodeURIComponent(currentStore.shopDomain)}` : '';
        const res = await shopifyFetch(
          `/api/preorder?action=calculate&basePrice=1240&discountType=${discountType}&discountValue=${val}${shopParam}`
        );
        const data = await res.json();
        if (active && data.success) {
          setCalculation(data.calculation);
          setSample100(data.sample100);
        }
      } catch (e) {
        console.warn('API calculation error:', e);
      } finally {
        if (active) setCalculating(false);
      }
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [discountType, discountValue, currentStore?.shopDomain]);

  // Debounced search for Pre-order orders
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecords(1, recordsSearch, recordsStatus);
    }, 300);
    return () => clearTimeout(timer);
  }, [recordsSearch, recordsStatus]);

  // Re-fetch records immediately when user switches to 'orders' tab
  useEffect(() => {
    if (activeTab === 'orders') {
      fetchRecords(1, recordsSearch, recordsStatus);
    }
  }, [activeTab]);

  const fetchRecords = async (page = recordsPage, search = recordsSearch, status = recordsStatus, isSilent = false) => {
    try {
      if (!isSilent) setRecordsLoading(true);
      const params = new URLSearchParams({
        type: 'records',
        page: String(page),
        pageSize: '10',
        search: search.trim(),
        paymentStatus: status,
      });
      if (currentStore?.shopDomain) {
        params.set('shop', currentStore.shopDomain);
      }
      const res = await shopifyFetch(`/api/preorder?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.data || []);
        if (data.pagination) {
          setRecordsTotal(data.pagination.total || 0);
          setRecordsTotalPages(data.pagination.totalPages || 1);
          setRecordsPage(data.pagination.page || page);
        }
      }
    } catch (err) {
      console.error('Failed to fetch preorder records:', err);
    } finally {
      if (!isSilent) setRecordsLoading(false);
    }
  };

  // Sync when tab is active and when window regains focus or visibility
  useEffect(() => {
    if (activeTab !== 'orders') return;

    const handleSync = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchRecords(recordsPage, recordsSearch, recordsStatus, true);
      }
    };

    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleSync);

    return () => {
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleSync);
    };
  }, [activeTab, recordsPage, recordsSearch, recordsStatus]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const url = currentStore?.shopDomain ? `/api/preorder?shop=${encodeURIComponent(currentStore.shopDomain)}` : '/api/preorder';
      const res = await shopifyFetch(url);
      const data = await res.json();
      if (data.success && data.config) {
        setEnabled(data.config.enabled);
        setInventoryThreshold(String(data.config.inventoryThreshold ?? 0));
        setCustomerMessage(data.config.customerMessage || "Pre-order before it's gone.");
        setShippingMessage(data.config.shippingMessage || 'Shipping: As soon as possible');
        setFulfillmentMessage(
          data.config.fulfillmentMessage || 'We will fulfill the item as soon as it becomes available'
        );
        setMaxQuantity(data.config.maxQuantity !== null && data.config.maxQuantity !== undefined ? String(data.config.maxQuantity) : '');
        setDiscountType(data.config.discountType || 'none');
        setDiscountValue(String(data.config.discountValue ?? 0));
        setSelectionMode(data.config.selectionMode || 'ALL_PRODUCTS');
        setSelectedProductIds(data.config.selectedProductIds || []);
        setSelectedCollectionIds(data.config.selectedCollectionIds || []);
        const isHalf = data.config.allowHalfPayment !== undefined ? data.config.allowHalfPayment : true;
        setAllowHalfPayment(isHalf);
        setAllowFullPayment(!isHalf);
        setPaymentType(isHalf ? 'HALF' : 'FULL');
        setDefaultPaymentOption(isHalf ? 'HALF' : 'FULL');
        if (data.calculation) {
          setCalculation(data.calculation);
        }
        if (data.sample100) {
          setSample100(data.sample100);
        }
      }
    } catch (err: any) {
      setToast({ message: 'Failed to load pre-order settings', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentTypeChange = (val: 'FULL' | 'HALF') => {
    setPaymentType(val);
    if (val === 'HALF') {
      setAllowHalfPayment(true);
      setAllowFullPayment(false);
      setDefaultPaymentOption('HALF');
    } else {
      setAllowHalfPayment(false);
      setAllowFullPayment(true);
      setDefaultPaymentOption('FULL');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const thresholdNum = parseInt(inventoryThreshold, 10);
      const maxQtyNum = maxQuantity.trim() ? parseInt(maxQuantity, 10) : null;
      const valNum = parseFloat(discountValue);

      const payload = {
        enabled,
        inventoryThreshold: isNaN(thresholdNum) ? 0 : thresholdNum,
        customerMessage: customerMessage.trim(),
        shippingMessage: shippingMessage.trim(),
        fulfillmentMessage: fulfillmentMessage.trim(),
        maxQuantity: maxQtyNum && !isNaN(maxQtyNum) ? maxQtyNum : null,
        discountType,
        discountValue: isNaN(valNum) ? 0 : valNum,
        selectionMode,
        selectedProductIds,
        selectedCollectionIds,
        allowHalfPayment: paymentType === 'HALF',
        allowFullPayment: paymentType === 'FULL',
        defaultPaymentOption: paymentType,
      };

      const res = await shopifyFetch('/api/preorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        if (data.calculation) setCalculation(data.calculation);
        if (data.sample100) setSample100(data.sample100);
        setToast({ message: 'Pre-order settings saved successfully!', type: 'success' });
      } else {
        setToast({ message: data.error || 'Failed to save settings', type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Error saving settings', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const tabs: PageTab<PreorderTabId>[] = [
    { id: 'general', label: 'Setup & Products' },
    { id: 'offers_payment', label: 'Offer & Payment' },
    { id: 'orders', label: 'Pre-order Orders' },
  ];

  const previewColumn = (
    <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-6">
      <PreviewCard
        enabled={enabled}
        customerMessage={customerMessage}
        shippingMessage={shippingMessage}
        fulfillmentMessage={fulfillmentMessage}
        notifyMeEnabled={true}
        allowHalfPayment={allowHalfPayment}
        allowFullPayment={allowFullPayment}
        defaultPaymentOption={defaultPaymentOption}
        showSavings={showSavings}
        calculation={calculation}
      />

      {/* Integration & Theme App Extension Guide */}
      <div className="bg-sky-50 border border-sky-200 rounded-2xl p-5 text-sky-950 space-y-2">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-sky-700">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <h4 className="font-bold text-sm text-sky-900">How StoreBridge Pre-order Works on Your Store</h4>
        </div>
        <p className="text-xs text-sky-800 leading-relaxed">
          When a customer visits your online store product page, the StoreBridge Theme App Extension reads the selected variant&apos;s inventory. If stock is &le; threshold ({inventoryThreshold}), it seamlessly replaces the theme&apos;s Sold Out button with the Pre-order &amp; Back in Stock UI and applies any configured promotional offer.
        </p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <Loading />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full overflow-x-hidden space-y-8">
      {/* Toast Alert */}
      {toast && (
        <Toast
          content={toast.message}
          error={toast.type === 'error'}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-gray-200">
        <div>
          <h1 className="page-title text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight m-0">Pre-order</h1>
          <p className="page-subtitle text-lg sm:text-xl font-medium text-slate-500 mt-1.5 m-0">
            Allow customers to pre-order items when stock drops to or below the configured inventory threshold.
          </p>
        </div>

        {activeTab !== 'orders' && (
          <SaveButton
            onClick={handleSave}
            loading={saving}
            label="Save Settings"
            loadingLabel="Saving..."
          />
        )}
      </div>

      {/* 3-Tab Navbar Navigation */}
      <PageTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* TAB 1: Setup & Products (Enable Pre-order, Product Selection, Customize Messaging) */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-6">
            {/* Main Activation Card */}
            <SettingsCard
              title="Pre-order Behavior"
              description="Control when and how pre-order is triggered on your storefront product pages."
            >
              <SettingsToggle
                label="Enable Pre-order"
                description="When turned on, out-of-stock or low-stock variants show Pre-order instead of Sold Out."
                checked={enabled}
                onChange={setEnabled}
              />

              <div className="pt-2 border-t border-gray-100">
                <SettingsInput
                  label="Inventory Threshold"
                  description="Variants with stock at or below this value (e.g. 0 or negative) display Pre-order. In-stock products (> threshold) show the normal Add to Cart button."
                  value={inventoryThreshold}
                  onChange={setInventoryThreshold}
                  type="number"
                  min={0}
                  max={9999}
                />
              </div>

              <div className="pt-2 border-t border-gray-100">
                <SettingsInput
                  label="Maximum Pre-order Quantity (Optional)"
                  description="Limit the maximum quantity of pre-order items allowed per cart. Leave empty for unlimited."
                  value={maxQuantity}
                  onChange={setMaxQuantity}
                  type="number"
                  min={1}
                  placeholder="No limit"
                />
              </div>
            </SettingsCard>

            {/* Product Selection Mode Card */}
            <SettingsCard
              title="Product Selection Mode"
              description="Control which products are targeted for pre-order offers. Only eligible out-of-stock items will support pre-order."
              badge={
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: accentColor,
                    color: primaryColor,
                    border: `1px solid ${primaryColor}40`,
                  }}
                >
                  {selectionMode === 'ALL_PRODUCTS'
                    ? 'All Products'
                    : selectionMode === 'SPECIFIC_PRODUCTS'
                    ? `${selectedProductIds.length} Products Selected`
                    : `${selectedCollectionIds.length} Collections Selected`}
                </span>
              }
            >
              <div className="space-y-4">
                {/* The 3 Selection Modes Radio Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 1. All Products */}
                  <label
                    className={`p-3.5 border rounded-xl cursor-pointer flex flex-col gap-1 transition-all ${
                      selectionMode === 'ALL_PRODUCTS'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-2xs ring-1 ring-emerald-600'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="selectionMode"
                        value="ALL_PRODUCTS"
                        checked={selectionMode === 'ALL_PRODUCTS'}
                        onChange={() => setSelectionMode('ALL_PRODUCTS')}
                        style={{ accentColor: primaryColor }}
                        className="h-4 w-4 cursor-pointer"
                      />
                      <span className="text-sm font-bold text-gray-900">All Products</span>
                    </div>
                    <p className="text-xs text-gray-500 pl-6 leading-relaxed">
                      Target all products in the store that meet inventory conditions.
                    </p>
                  </label>

                  {/* 2. Specific Product */}
                  <label
                    className={`p-3.5 border rounded-xl cursor-pointer flex flex-col gap-1 transition-all ${
                      selectionMode === 'SPECIFIC_PRODUCTS'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-2xs ring-1 ring-emerald-600'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="selectionMode"
                        value="SPECIFIC_PRODUCTS"
                        checked={selectionMode === 'SPECIFIC_PRODUCTS'}
                        onChange={() => setSelectionMode('SPECIFIC_PRODUCTS')}
                        style={{ accentColor: primaryColor }}
                        className="h-4 w-4 cursor-pointer"
                      />
                      <span className="text-sm font-bold text-gray-900">Specific Product</span>
                    </div>
                    <p className="text-xs text-gray-500 pl-6 leading-relaxed">
                      Select individual products from your Shopify catalog.
                    </p>
                  </label>

                  {/* 3. Collection-Based */}
                  <label
                    className={`p-3.5 border rounded-xl cursor-pointer flex flex-col gap-1 transition-all ${
                      selectionMode === 'COLLECTIONS'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-2xs ring-1 ring-emerald-600'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="selectionMode"
                        value="COLLECTIONS"
                        checked={selectionMode === 'COLLECTIONS'}
                        onChange={() => setSelectionMode('COLLECTIONS')}
                        style={{ accentColor: primaryColor }}
                        className="h-4 w-4 cursor-pointer"
                      />
                      <span className="text-sm font-bold text-gray-900">Collection-Based</span>
                    </div>
                    <p className="text-xs text-gray-500 pl-6 leading-relaxed">
                      Target eligible products belonging to selected collections.
                    </p>
                  </label>
                </div>

                {/* Dynamic Target Selection UI */}
                <div className="pt-2 border-t border-gray-100">
                  {selectionMode === 'ALL_PRODUCTS' && (
                    <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 text-emerald-950 text-xs space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                        <svg className="w-4 h-4 text-emerald-700 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        All Products Mode Active
                      </div>
                      <p className="text-emerald-800 leading-relaxed pl-5.5">
                        Pre-order offers apply across your entire catalog, but only for products or variants with stock ≤ {inventoryThreshold}. Products that are in stock remain standard purchases and will not show pre-order.
                      </p>
                    </div>
                  )}

                  {selectionMode === 'SPECIFIC_PRODUCTS' && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-gray-700">
                        Select individual products to target for Pre-order:
                      </div>
                      <PreorderProductSelector
                        selectedProductIds={selectedProductIds}
                        onChange={setSelectedProductIds}
                        inventoryThreshold={parseInt(inventoryThreshold, 10) || 0}
                      />
                    </div>
                  )}

                  {selectionMode === 'COLLECTIONS' && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-gray-700">
                        Select Shopify collections to target for Pre-order:
                      </div>
                      <PreorderCollectionSelector
                        selectedCollectionIds={selectedCollectionIds}
                        onChange={setSelectedCollectionIds}
                      />
                    </div>
                  )}
                </div>

                {/* Card Footer with Direct Save Button */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">
                    {selectionMode === 'COLLECTIONS'
                      ? `${selectedCollectionIds.length} collection${selectedCollectionIds.length === 1 ? '' : 's'} selected`
                      : selectionMode === 'SPECIFIC_PRODUCTS'
                      ? `${selectedProductIds.length} product${selectedProductIds.length === 1 ? '' : 's'} selected`
                      : 'All catalog products targeted'}
                  </span>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    style={{ backgroundColor: primaryColor }}
                    className="px-4 py-2 text-xs font-bold text-white rounded-lg shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        Save Selection
                      </>
                    )}
                  </button>
                </div>
              </div>
            </SettingsCard>

            {/* Customer Facing Messages Card */}
            <SettingsCard
              title="Customer Messaging"
              description="Customize the messaging shown on the product page Pre-order card."
            >
              <SettingsInput
                label="Customer Message"
                description="Prominent badge/callout text in the pre-order card."
                value={customerMessage}
                onChange={setCustomerMessage}
                placeholder="Pre-order before it's gone."
              />

              <SettingsInput
                label="Shipping Message"
                description="Estimated shipping timeline displayed with the truck icon."
                value={shippingMessage}
                onChange={setShippingMessage}
                placeholder="Shipping: As soon as possible"
              />

              <SettingsTextarea
                label="Fulfillment Message"
                description="Supporting message explaining when customer will receive their item."
                value={fulfillmentMessage}
                onChange={setFulfillmentMessage}
                rows={2}
                placeholder="We will fulfill the item as soon as it becomes available"
              />
            </SettingsCard>
          </div>
          {previewColumn}
        </div>
      )}

      {/* TAB 2: Offer & Payment */}
      {activeTab === 'offers_payment' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-6">
            {/* Pre-order Offer & Payment Settings Card (Matches Design) */}
            <SettingsCard
              title="Payment & Discount Settings"
              description="Configure payment options, upfront deposits, and promotional discounts for pre-orders."
              badge={
                discountType !== 'none' && calculation?.offerBadge ? (
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-black transition-colors"
                    style={{
                      backgroundColor: accentColor,
                      color: primaryColor,
                      border: `1px solid ${primaryColor}40`,
                    }}
                  >
                    {calculation.offerBadge}
                  </span>
                ) : undefined
              }
            >
              <div className="space-y-6">
                {/* 1. Discount on total price */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-bold text-gray-900">
                      1. Pre-order Discount
                    </label>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Applied first to product price
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3 font-normal leading-relaxed">
                    Set a promotional discount applied directly to the catalog price for pre-ordered items.
                  </p>
                  <div className="flex flex-wrap items-center gap-7">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-800 hover:text-gray-900 transition-colors">
                      <input
                        type="radio"
                        name="preorderDiscountType"
                        value="none"
                        checked={discountType === 'none'}
                        onChange={() => {
                          setDiscountType('none');
                          setDiscountValue('0');
                        }}
                        style={{ accentColor: primaryColor }}
                        className="h-4 w-4 cursor-pointer"
                      />
                      <span>None</span>
                    </label>

                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-800 hover:text-gray-900 transition-colors">
                      <input
                        type="radio"
                        name="preorderDiscountType"
                        value="percentage"
                        checked={discountType === 'percentage'}
                        onChange={() => {
                          setDiscountType('percentage');
                          if (discountValue === '0' || !discountValue) setDiscountValue('10');
                        }}
                        style={{ accentColor: primaryColor }}
                        className="h-4 w-4 cursor-pointer"
                      />
                      <span>Percent</span>
                    </label>

                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-800 hover:text-gray-900 transition-colors">
                      <input
                        type="radio"
                        name="preorderDiscountType"
                        value="fixed"
                        checked={discountType === 'fixed'}
                        onChange={() => {
                          setDiscountType('fixed');
                          if (discountValue === '0' || !discountValue) setDiscountValue('10');
                        }}
                        style={{ accentColor: primaryColor }}
                        className="h-4 w-4 cursor-pointer"
                      />
                      <span>Amount</span>
                    </label>
                  </div>

                  {/* Percentage input */}
                  {discountType === 'percentage' && (
                    <div className="max-w-xs mt-3 animate-fadeIn">
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Discount Percentage (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          placeholder="10"
                          style={{ borderColor: primaryColor }}
                          className="w-full px-3.5 py-2 text-sm font-semibold text-gray-900 bg-white border rounded-lg shadow-2xs outline-none pr-8 focus:ring-1"
                        />
                        <span className="absolute right-3 top-2 text-sm font-bold pointer-events-none" style={{ color: primaryColor }}>%</span>
                      </div>
                    </div>
                  )}

                  {/* Amount input */}
                  {discountType === 'fixed' && (
                    <div className="max-w-xs mt-3 animate-fadeIn">
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Discount Amount (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-sm font-bold pointer-events-none" style={{ color: primaryColor }}>₹</span>
                        <input
                          type="number"
                          min={1}
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          placeholder="10"
                          style={{ borderColor: primaryColor }}
                          className="w-full pl-8 pr-3.5 py-2 text-sm font-semibold text-gray-900 bg-white border rounded-lg shadow-2xs outline-none focus:ring-1"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Payment type Dropdown */}
                <div className="pt-6 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-bold text-gray-900">
                      2. Payment Plan Option
                    </label>
                    <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                      Calculated on discounted price
                    </span>
                  </div>
                  <div className="relative mt-2">
                    <select
                      value={paymentType}
                      onChange={(e) => handlePaymentTypeChange(e.target.value as 'FULL' | 'HALF')}
                      className="w-full appearance-none px-4 py-3 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-xl shadow-2xs focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none pr-10 cursor-pointer transition-colors hover:border-gray-400"
                    >
                      <option value="FULL">Full payment (100% upfront)</option>
                      <option value="HALF">Half payment (50% deposit upfront)</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 font-normal leading-relaxed">
                    {paymentType === 'FULL'
                      ? 'Customers will pay the full discounted price at checkout.'
                      : 'Customers pay a 50% deposit based on the discounted price today, and the remaining 50% upon restock.'}
                  </p>
                </div>

                {/* 3. Display Settings */}
                <div className="pt-6 border-t border-gray-100">
                  <label className="block text-sm font-bold text-gray-900 mb-3">
                    Display
                  </label>
                  <label className="inline-flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-gray-800 hover:text-gray-900 transition-colors">
                    <input
                      type="checkbox"
                      checked={showSavings}
                      onChange={(e) => setShowSavings(e.target.checked)}
                      style={{ accentColor: primaryColor }}
                      className="h-4 w-4 rounded cursor-pointer"
                    />
                    <span>Show payment &amp; discount savings</span>
                  </label>
                </div>

                {/* Card Footer with Direct Save Button */}
                <div className="pt-5 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">
                    {paymentType === 'HALF'
                      ? 'Half payment (50% deposit) active'
                      : 'Full payment (100%) active'}
                  </span>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    style={{ backgroundColor: primaryColor }}
                    className="px-4 py-2 text-xs font-bold text-white rounded-lg shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        Save Payment &amp; Discount
                      </>
                    )}
                  </button>
                </div>
              </div>
            </SettingsCard>
          </div>
          {previewColumn}
        </div>
      )}

      {/* TAB 3: Pre-order Orders Table */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight m-0">Pre-order Orders</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 m-0">
                Track initial deposits, outstanding customer balances, and payment statuses.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchRecords(recordsPage, recordsSearch, recordsStatus)}
              disabled={recordsLoading}
              className="self-start sm:self-auto px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-white border border-gray-300 rounded-lg shadow-2xs hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <svg
                className={`w-3.5 h-3.5 ${recordsLoading ? 'animate-spin text-emerald-600' : 'text-slate-500'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Orders
            </button>
          </div>

          <Table
            title="Pre-order Management"
            headerColor={primaryColor}
            columns={[
              { key: 'orderRef', title: 'Order Ref', type: 'react_node', width: '13%' },
              { key: 'product', title: 'Product & Variant', type: 'react_node', width: '27%' },
              { key: 'customer', title: 'Customer', type: 'react_node', width: '18%' },
              { key: 'totalAmount', title: 'Total', type: 'react_node', width: '9%' },
              { key: 'depositAmount', title: 'Initial Paid', type: 'react_node', width: '9%' },
              { key: 'remainingBalance', title: 'Remaining', type: 'react_node', width: '9%' },
              { key: 'paymentOption', title: 'Payment Plan', type: 'react_node', width: '10%' },
              { key: 'paymentStatus', title: 'Status', type: 'react_node', width: '9%' },
            ]}
            items={records.map((record) => {
              const isPartiallyPaid = record.paymentStatus === 'PARTIALLY_PAID' || record.remainingBalance > 0;
              const isPaid = record.paymentStatus === 'PAID' && record.remainingBalance <= 0;
              const curr = record.currency || 'INR';
              const currSym = curr === 'INR' ? '₹' : curr === 'USD' ? '$' : `${curr} `;

              const cleanOrderNumber = record.orderNumber
                ? (record.orderNumber.startsWith('#') || record.orderNumber.startsWith('PRE-') ? record.orderNumber : `#${record.orderNumber}`)
                : '—';

              return {
                id: record.id,
                orderNumber: record.orderNumber || '',
                rawPaymentStatus: record.paymentStatus || '',
                orderRef: (
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900 text-xs">{cleanOrderNumber}</span>
                    <span className="text-[10px] text-gray-400">
                      {record.createdAt ? new Date(record.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </span>
                  </div>
                ),
                product: (
                  <div className="flex items-center gap-3">
                    {record.imageUrl ? (
                      <img
                        src={record.imageUrl}
                        alt={record.productTitle || 'Product'}
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-50 shadow-xs"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex flex-col min-w-0 max-w-[210px]">
                      <span className="font-bold text-slate-900 text-xs truncate" title={record.productTitle || 'Pre-order Item'}>
                        {record.productTitle || 'Pre-order Item'}
                      </span>
                      {record.variantTitle && (
                        <span className="text-[11px] text-gray-500 font-medium truncate" title={record.variantTitle}>
                          {record.variantTitle}
                        </span>
                      )}
                    </div>
                  </div>
                ),
                customer: (
                  <div className="flex flex-col max-w-[170px]">
                    <span className="text-xs font-medium text-slate-800 truncate" title={record.customerName || 'Customer'}>
                      {record.customerName && !record.customerName.includes(':')
                        ? record.customerName
                        : (record.customerEmail ? record.customerEmail.split('@')[0] : 'Customer')}
                    </span>
                    {record.customerEmail && (
                      <span className="text-[11px] text-gray-400 truncate" title={record.customerEmail}>
                        {record.customerEmail}
                      </span>
                    )}
                  </div>
                ),
                totalAmount: (
                  <span className="text-xs font-bold text-slate-900">
                    {currSym}{(record.totalAmount || 0).toFixed(2)}
                  </span>
                ),
                depositAmount: (
                  <span className="text-xs font-semibold text-emerald-700">
                    {currSym}{(record.depositAmount || 0).toFixed(2)}
                  </span>
                ),
                remainingBalance: (
                  <div>
                    {record.remainingBalance > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                        {currSym}{(record.remainingBalance || 0).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-emerald-700">
                        {currSym}0.00
                      </span>
                    )}
                  </div>
                ),
                paymentOption: (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      record.paymentOption === 'HALF'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {record.paymentOption === 'HALF' ? 'Half (50%)' : 'Full (100%)'}
                  </span>
                ),
                paymentStatus: (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isPaid
                        ? 'bg-emerald-100 text-emerald-800'
                        : isPartiallyPaid
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isPaid ? 'bg-emerald-600' : isPartiallyPaid ? 'bg-amber-600' : 'bg-gray-500'
                      }`}
                    />
                    {isPaid ? 'Fully Paid' : isPartiallyPaid ? 'Partially Paid' : record.paymentStatus || 'Pending'}
                  </span>
                ),
              };
            })}
            loading={recordsLoading}
            searchable={true}
            searchKey="orderNumber"
            filterable={true}
            filterKey="paymentStatus"
            filterOptions={[
              { label: 'All Statuses', value: 'ALL' },
              { label: 'Partially Paid', value: 'PARTIALLY_PAID' },
              { label: 'Fully Paid', value: 'PAID' },
              { label: 'Pending', value: 'PENDING' },
            ]}
            serverSide={true}
            searchValue={recordsSearch}
            onSearchChange={(val) => {
              setRecordsSearch(val);
            }}
            filterValue={recordsStatus}
            onFilterChange={(val) => {
              setRecordsStatus(val);
              setRecordsPage(1);
              fetchRecords(1, recordsSearch, val);
            }}
            totalItems={recordsTotal}
            page={recordsPage}
            totalPages={recordsTotalPages}
            onPageChange={(p) => {
              setRecordsPage(p);
              fetchRecords(p, recordsSearch, recordsStatus);
            }}
            itemsPerPage={10}
            paginate={true}
          />
        </div>
      )}
    </div>
  );
}
