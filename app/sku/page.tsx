"use client";
import React, { useState, useEffect, useRef } from 'react';
import { shopifyFetch } from '@/lib/shopify/Client';
import { Loading } from '@/components/common';
import CollectionSkuRule from '@/components/stores/CollectionSkuRule';
import { Input } from '@/components/forms/Input';
import { StoreRoleBadge } from '@/components/ui/StoreRoleBadge';
import { useStoreContext } from '@/components/providers/StoreProvider';

export default function SkuSettingsPage() {
  const [skuPrefix, setSkuPrefix] = useState('SHOE');
  const [skuSequence, setSkuSequence] = useState('0001');

  const [storeId, setStoreId] = useState('');
  const [storeName, setStoreName] = useState('');
  
  const [selectedCollectionPrefix, setSelectedCollectionPrefix] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isMaster, setIsMaster] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  
  const [skuMode, setSkuMode] = useState<'default' | 'collection'>('default');

  const { canManageSku, isStandalone } = useStoreContext();
  const hasWriteAccess = canManageSku;

  const collectionRuleRef = useRef<any>(null);

  useEffect(() => {
    fetchSettings();
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

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await shopifyFetch('/api/settings/sku');
      const data = await res.json();
      if (data.success && data.setting) {
        setSkuPrefix(data.setting.skuPrefix || 'SHOE');

        // Ensure sequence displays nicely as 4 digits minimum
        const seq = data.setting.skuSequence || 1;
        setSkuSequence(seq.toString().padStart(4, '0'));
        setIsMaster(data.isMaster !== false);
        setStoreId(data.setting.storeId);
        setStoreName(data.storeName || 'Store');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setToastMessage(null);
    setInlineError(null);

    try {
      // 1. Save SKU Prefix and Sequence
      const finalPrefix = skuPrefix.trim() || 'SHOE';

      const res = await shopifyFetch('/api/settings/sku', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skuPrefix: finalPrefix, skuSequence })
      });
      const data = await res.json();

      // 2. Save Collection Rule via Ref
      if (collectionRuleRef.current && hasWriteAccess) {
        await collectionRuleRef.current.saveRules();
      }

      if (data.success) {
        setSkuPrefix(data.setting.skuPrefix);
        setSkuSequence(data.setting.skuSequence.toString().padStart(4, '0'));
        setToastMessage({ message: '✅ SKU configuration and collection rules saved successfully.', type: 'success' });
      } else {
        setToastMessage({ message: data.error || 'Failed to save configuration.', type: 'error' });

        // Handle specific validation errors for Prefix History Sequence mismatch
        if (data.nextSequence) {
          setInlineError(`⚠ Prefix "${skuPrefix}" already exists. Next available sequence: ${data.nextSequence}.`);
          setSkuSequence(data.nextSequence.toString().padStart(4, '0'));
        }
      }
    } catch (err: any) {
      setToastMessage({ message: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loading label="Loading SKU rules..." />;
  }

  const generatedPreview = `STB-${skuPrefix || "SHOE"}-${(skuMode === 'collection' && selectedCollectionPrefix) ? selectedCollectionPrefix + '-' : ''}${skuSequence ? skuSequence.toString().padStart(4, '0') : "0001"}`;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto mb-16">
      <div className="mb-6 border-b border-gray-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 m-0">
            SKU Configuration
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-500 m-0">
            Manage product prefixes, sequence rules, and collection restrictions.
          </p>
        </div>
      </div>

      {!hasWriteAccess && (
        <div className="mb-6 p-4 rounded-md font-medium shadow-sm border bg-red-50 text-red-800 border-red-200 text-xs sm:text-sm">
          ⚠ Only the Master Store can configure SKU settings. These settings are read-only for this store.
        </div>
      )}

      {hasWriteAccess && (
        <div className="mb-6 p-4 bg-blue-50 text-blue-800 rounded-md border border-blue-200 text-xs sm:text-sm">
          <strong>Note:</strong> SKU Sequence and Prefix are managed here. The Collections list below is read-only and automatically syncs from Shopify.
        </div>
      )}

      <div className="flex flex-col gap-6">
          <div className="p-4 sm:p-6 bg-[#f0fdfa] border border-[#ccfbf1] rounded-xl sm:rounded-2xl shadow-2xs">
            <div className="mb-5 border-l-4 sm:border-l-6 border-[#0a9984] pl-3 sm:pl-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold text-[#115e59] m-0">
                  SKU Generation Rules
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-[#0f766e] m-0">
                  Define how SKUs are automatically generated for products missing a valid SKU.
                </p>
              </div>
              
              <div className={`flex items-center gap-1.5 p-1 bg-white/50 backdrop-blur-sm rounded-lg border border-teal-100 shrink-0 self-start md:self-auto ${!hasWriteAccess ? 'opacity-60 cursor-not-allowed' : ''}`}>
                <button
                  type="button"
                  onClick={() => {
                    if (hasWriteAccess) {
                      setSkuMode('default');
                      setSelectedCollectionPrefix('');
                    }
                  }}
                  className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors ${skuMode === 'default' ? 'bg-[#0a9984] text-white shadow-xs' : 'text-[#0f766e] hover:bg-teal-50'}`}
                  disabled={!hasWriteAccess}
                >
                  Default SKU
                </button>
                <button
                  type="button"
                  onClick={() => hasWriteAccess && setSkuMode('collection')}
                  className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors ${skuMode === 'collection' ? 'bg-[#0a9984] text-white shadow-xs' : 'text-[#0f766e] hover:bg-teal-50'}`}
                  disabled={!hasWriteAccess}
                >
                  Collection SKU
                </button>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 sm:p-6 border border-teal-100 shadow-2xs flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Input
                      label="Product Prefix"
                      prefix="STB -"
                      value={skuPrefix}
                      onChange={(val) => setSkuPrefix(val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                      autoComplete="off"
                      disabled={!hasWriteAccess}
                    />
                  </div>

                  <div>
                    <Input
                      label="Starting Sequence"
                      value={skuSequence}
                      onChange={(val) => setSkuSequence(val.replace(/[^0-9]/g, '').slice(0, 6))}
                      autoComplete="off"
                      error={inlineError || undefined}
                      disabled={!hasWriteAccess}
                    />
                  </div>
                </div>

                <div className="text-xs sm:text-sm text-gray-600 bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-100">
                  <span className="font-semibold text-gray-800">Dynamic Insertion:</span> If a product belongs to a Collection or has Variants (e.g. Size/Color), the system will automatically extract their short-form abbreviations and insert them into the generated SKU.
                </div>

                {storeId && skuMode === 'collection' && (
                  <div>
                    <CollectionSkuRule 
                      ref={collectionRuleRef}
                      storeId={storeId} 
                      onSelectCollection={(id, prefix) => setSelectedCollectionPrefix(prefix)}
                    />
                  </div>
                )}

                <div className="mt-2 p-4 bg-teal-50 border-2 border-teal-200 rounded-xl shadow-2xs text-center">
                  <p className="text-gray-500 text-xs sm:text-sm mb-1.5">Generated SKU Example</p>
                  <span className="text-lg sm:text-xl font-bold text-[#0a9984] tracking-wider break-all">
                    {generatedPreview}
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-teal-100 flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3">
                  {toastMessage && (
                    <span className={`text-xs sm:text-sm font-semibold text-center sm:text-left sm:mr-auto ${toastMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                      {toastMessage.message}
                    </span>
                  )}
                  <button className="w-full sm:w-auto px-5 py-2.5 bg-[#0a9984] text-white text-sm font-semibold rounded-lg hover:bg-[#087d6c] transition-colors shadow-2xs disabled:opacity-50 text-center" onClick={handleSave} disabled={saving || !hasWriteAccess}>
                    {saving ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
            </div>
          </div>
      </div>
    </div>
  );
}
