'use client';

import React, { useState, useEffect } from 'react';
import { shopifyFetch } from '@/lib/shopify/Client';
import { Loading } from '@/components/common/Loading';
import { Toast } from '@/components/common/Toast';
import { StatusBadge } from '@/components/ui/StatusBadge';
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

export default function PreorderAdminPage() {
  const { isStandalone } = useStoreContext();
  const { currentTheme } = useTheme();
  const primaryColor = currentTheme?.primaryColor || '#047857';
  const accentColor = currentTheme?.accentColor || '#d1fae5';
  const darkColor = currentTheme?.darkColor || '#022c22';

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

  // Offer / Discount State
  const [discountType, setDiscountType] = useState<'none' | 'percentage' | 'fixed'>('none');
  const [discountValue, setDiscountValue] = useState<string>('0');
  const [calculation, setCalculation] = useState<any>(null);
  const [sample100, setSample100] = useState<any>(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    if (isStandalone) {
      fetchConfig();
    }
  }, [isStandalone]);

  // Fetch pure calculations from backend API whenever discount settings change
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        setCalculating(true);
        const val = parseFloat(discountValue) || 0;
        const res = await shopifyFetch(
          `/api/preorder?action=calculate&basePrice=1240&discountType=${discountType}&discountValue=${val}`
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
  }, [discountType, discountValue]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await shopifyFetch('/api/preorder');
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

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <Loading />
      </div>
    );
  }

  return (
    <StandaloneGuard featureName="Pre-order">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Alert */}
      {toast && (
        <Toast
          content={toast.message}
          error={toast.type === 'error'}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Pre-order</h1>
            <StatusBadge
              status={enabled ? 'success' : 'default'}
              label={enabled ? 'ACTIVE' : 'DISABLED'}
            />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Allow customers to pre-order items when stock drops to or below the configured inventory threshold.
          </p>
        </div>

        <SaveButton
          onClick={handleSave}
          loading={saving}
          label="Save Settings"
          loadingLabel="Saving..."
        />
      </div>

      {/* Main Grid: Left Settings / Right Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Configuration Forms (7 cols) */}
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

          {/* Pre-order Offer / Discount Card (Single-line Radio Options) */}
          <SettingsCard
            title="Pre-order Offer & Discount"
            description="Give special promotional pricing to motivate shoppers to pre-order out-of-stock products."
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
            <div className="space-y-4">
              {/* Single line radio buttons: None, Percentage, Fixed Price */}
              <div className="flex flex-wrap items-center gap-7 pt-1">
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
                  <span style={{ color: discountType === 'none' ? primaryColor : undefined, fontWeight: discountType === 'none' ? 700 : 600 }}>
                    None
                  </span>
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
                  <span style={{ color: discountType === 'percentage' ? primaryColor : undefined, fontWeight: discountType === 'percentage' ? 700 : 600 }}>
                    Percentage (%)
                  </span>
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
                  <span style={{ color: discountType === 'fixed' ? primaryColor : undefined, fontWeight: discountType === 'fixed' ? 700 : 600 }}>
                    Fixed Price (₹)
                  </span>
                </label>
              </div>

              {/* Single input box for Percentage */}
              {discountType === 'percentage' && (
                <div className="max-w-xs pt-1 animate-fadeIn">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
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
                      style={{
                        borderColor: primaryColor,
                      }}
                      className="w-full px-3.5 py-2 text-sm font-semibold text-gray-900 bg-white border rounded-lg shadow-2xs outline-none pr-8 focus:ring-1"
                    />
                    <span className="absolute right-3 top-2 text-sm font-bold pointer-events-none" style={{ color: primaryColor }}>%</span>
                  </div>
                </div>
              )}

              {/* Single input box for Fixed Price */}
              {discountType === 'fixed' && (
                <div className="max-w-xs pt-1 animate-fadeIn">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Fixed Discount Amount (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-sm font-bold pointer-events-none" style={{ color: primaryColor }}>₹</span>
                    <input
                      type="number"
                      min={1}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder="10"
                      style={{
                        borderColor: primaryColor,
                      }}
                      className="w-full pl-8 pr-3.5 py-2 text-sm font-semibold text-gray-900 bg-white border rounded-lg shadow-2xs outline-none focus:ring-1"
                    />
                  </div>
                </div>
              )}
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
              When a customer visits your online store product page, the StoreBridge Theme App Extension reads the selected variant's inventory. If stock is ≤ threshold ({inventoryThreshold}), it seamlessly replaces the theme's Sold Out button with the Pre-order &amp; Notify Me UI and applies any configured promotional offer.
            </p>
          </div>
        </div>

        {/* Right Column: Live Storefront Preview (5 cols) */}
        <div className="lg:col-span-5">
          <PreviewCard
            enabled={enabled}
            customerMessage={customerMessage}
            shippingMessage={shippingMessage}
            fulfillmentMessage={fulfillmentMessage}
            notifyMeEnabled={true}
            calculation={calculation}
          />
        </div>
      </div>
    </div>
    </StandaloneGuard>
  );
}
