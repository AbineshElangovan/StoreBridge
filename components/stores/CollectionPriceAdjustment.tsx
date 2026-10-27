"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button, BlockStack, InlineStack } from '@shopify/polaris';
import { shopifyFetch } from '@/lib/shopify/Client';
import { Checkbox, Input, Select } from '@/components/forms';
import { Loading } from '@/components/common';
import { PriceAdjustmentPreview } from '@/components/price-adjustment/PriceAdjustmentPreview';

import { useTheme } from '@/components/providers/ThemeContext';

export default function CollectionPriceAdjustment({ storeId, storeName, isStandalone }: { storeId: string, storeName: string, isStandalone?: boolean }) {
  const { currentTheme } = useTheme();
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [bulkValue, setBulkValue] = useState('');

  const [showDropdown, setShowDropdown] = useState(false);

  // Guard ref to prevent duplicate fetching in dev mode / StrictMode
  const fetchedStoreIdRef = useRef<string | null>(null);

  // State maps keyed by collectionId
  const [enabledMap, setEnabledMap] = useState<{ [id: string]: boolean }>({});
  const [typeMap, setTypeMap] = useState<{ [id: string]: string }>({});
  const [valueMap, setValueMap] = useState<{ [id: string]: string }>({});
  const [savedValueMap, setSavedValueMap] = useState<{ [id: string]: string }>({});

  const loadCollections = async () => {
    setLoading(true);
    try {
      const res = await shopifyFetch(`/api/stores/${storeId}/collection-adjustments`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setCollections(data);

        const newEnabled: any = {};
        const newType: any = {};
        const newValue: any = {};

        data.forEach((col: any) => {
          const adj = col.priceAdjustment;
          newEnabled[col.id] = adj?.enabled || false;
          newValue[col.id] = adj?.adjustmentValue?.toString() || '0';
        });

        setEnabledMap(newEnabled);
        setTypeMap(newType);
        setValueMap(newValue);
        setSavedValueMap({ ...newValue });
      }
    } catch (err) {
      console.error("Failed to load collections", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId && fetchedStoreIdRef.current !== storeId) {
      fetchedStoreIdRef.current = storeId;
      loadCollections();
    }
  }, [storeId]);


  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.collection-dropdown-container')) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const adjustments = collections.map(col => ({
      collectionId: col.id,
      enabled: !!enabledMap[col.id],
      adjustmentType: 'PERCENTAGE',
      adjustmentValue: valueMap[col.id] || '0'
    }));

    try {
      const res = await shopifyFetch(`/api/stores/${storeId}/collection-adjustments`, {
        method: 'PUT',
        body: JSON.stringify({ adjustments })
      });

      if (res.ok) {
        setSavedValueMap({ ...valueMap });
        setMessage({ text: 'Collection adjustments saved successfully.', type: 'success' });
        setTimeout(() => setMessage(null), 3000);

        // Real-time polling for 3.5 seconds while background worker updates ProductCache DB & Shopify
        const pollInterval = setInterval(() => {
          setSavedValueMap(prev => ({ ...prev }));
        }, 1000);

        setTimeout(() => {
          clearInterval(pollInterval);
          setSaving(false);
        }, 3500);
      } else {
        setMessage({ text: 'Failed to save adjustments.', type: 'error' });
        setTimeout(() => setMessage(null), 3000);
        setSaving(false);
      }
    } catch (err) {
      setMessage({ text: 'Failed to save adjustments.', type: 'error' });
      setTimeout(() => setMessage(null), 3000);
      setSaving(false);
    }
  };

  if (loading) {
    return <Loading label="Loading collections..." />;
  }

  const activeCollections = collections.filter(c => enabledMap[c.id]);
  const primaryColor = currentTheme?.primaryColor || '#047857';
  const accentColor = currentTheme?.accentColor || '#d1fae5';
  const darkColor = currentTheme?.darkColor || '#022c22';
  const borderColor = currentTheme?.navbarBorder || '#34d399';

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mb-3">
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: darkColor }}>
            {isStandalone ? 'Collection Price Adjustments' : `Collection Price Adjustments for ${storeName}`}
          </h3>
          {collections.length > 0 && (
            <div className="w-full sm:w-[220px]">
              <Input
                type="text"
                label="Search collections"
                labelHidden
                placeholder="Search collections..."
                value={searchQuery}
                onChange={(val) => setSearchQuery(val)}
                autoComplete="off"
              />
            </div>
          )}
        </div>
        
        {/* Dynamic Theme Information Banner */}
        <div
          className="p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-colors shadow-2xs"
          style={{
            backgroundColor: `${accentColor}35`,
            borderColor: `${borderColor}70`,
            color: darkColor,
          }}
        >
          <svg className="w-4 h-4 shrink-0" style={{ color: primaryColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="leading-relaxed">
            Note: For a global adjustment across all collections, click <strong>"Select All"</strong>, enter a <strong>"Bulk Apply"</strong> percentage, and click <strong>"Save Collection"</strong>.
          </span>
        </div>
      </div>

      {collections.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#6b7280', fontSize: '14px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px dashed #e5e7eb' }}>
          No collections synced yet for this store.
        </div>
      ) : (
        <>
          {/* Table Header Styled with Active Theme */}
          <div
            className="flex items-center justify-between px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white rounded-t-xl shadow-2xs transition-colors"
            style={{ backgroundColor: primaryColor }}
          >
            <div style={{ minWidth: '150px' }}>Collection Name</div>
            <div style={{ width: '130px', textAlign: 'center' }}>Adjustment (%)</div>
          </div>

          <div
            className="rounded-b-xl max-h-64 overflow-y-auto divide-y transition-colors border border-t-0"
            style={{
              borderColor: `${borderColor}60`,
              backgroundColor: '#ffffff'
            }}
          >
            {collections.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase())).map((col) => {
              const isEnabled = enabledMap[col.id];
              return (
                <div
                  key={col.id}
                  className="p-3 transition-colors flex items-center justify-between flex-wrap gap-3"
                  style={{
                    backgroundColor: isEnabled ? `${accentColor}30` : undefined,
                  }}
                >
                  <div style={{ minWidth: '150px' }}>
                    <Checkbox
                      label={col.title}
                      checked={isEnabled}
                      onChange={(val) => setEnabledMap(prev => ({ ...prev, [col.id]: val }))}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: isEnabled ? 1 : 0.5, pointerEvents: isEnabled ? 'auto' : 'none' }}>
                    <span style={{ fontSize: '13px', color: darkColor, fontWeight: 600 }}>Adjustment:</span>
                    <div style={{ width: '80px' }}>
                      <Input
                        type="text"
                        label="Value"
                        labelHidden
                        value={valueMap[col.id]}
                        onChange={(val) => {
                          let numericValue = val.replace(/[^0-9]/g, '');
                          if (numericValue.length > 1 && numericValue.startsWith('0')) {
                            numericValue = numericValue.replace(/^0+/, '');
                          }
                          if (numericValue === '') numericValue = '0';
                          setValueMap(prev => ({ ...prev, [col.id]: numericValue }));
                        }}
                        autoComplete="off"
                      />
                    </div>
                    <span style={{ fontSize: '13px', color: darkColor, fontWeight: 700 }}>%</span>
                  </div>
                </div>
              );
            })}
            {collections.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '13px', backgroundColor: '#f9fafb' }}>
                No collections match your search.
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3.5 py-1.5 text-xs font-bold rounded-lg border shadow-2xs transition-all cursor-pointer hover:opacity-90 active:scale-95"
                  style={{
                    backgroundColor: `${accentColor}50`,
                    borderColor: borderColor,
                    color: darkColor,
                  }}
                  onClick={() => {
                    const newMap = { ...enabledMap };
                    collections.forEach(c => {
                      if (c.title.toLowerCase().includes(searchQuery.toLowerCase())) {
                        newMap[c.id] = true;
                      }
                    });
                    setEnabledMap(newMap);
                  }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="px-3.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 shadow-2xs transition-all cursor-pointer active:scale-95"
                  onClick={() => {
                    const newMap = { ...enabledMap };
                    collections.forEach(c => {
                      if (c.title.toLowerCase().includes(searchQuery.toLowerCase())) {
                        newMap[c.id] = false;
                      }
                    });
                    setEnabledMap(newMap);
                  }}
                >
                  Deselect All
                </button>
              </div>

              <div
                className="flex items-center gap-2 sm:pl-4 sm:border-l border-l-0 pl-0 transition-colors"
                style={{ borderLeftColor: `${borderColor}80` }}
              >
                <span style={{ fontSize: '13px', color: darkColor, fontWeight: 600 }}>Bulk Apply:</span>
                <div style={{ width: '70px' }}>
                  <Input
                    type="text"
                    label="Bulk Value"
                    labelHidden
                    placeholder="0"
                    value={bulkValue}
                    onChange={(val) => {
                      let numericValue = val.replace(/[^0-9]/g, '');
                      setBulkValue(numericValue);
                      
                      // Auto-apply to selected collections immediately!
                      const newValueMap = { ...valueMap };
                      collections.forEach(c => {
                        if (enabledMap[c.id]) {
                          newValueMap[c.id] = numericValue || '0';
                        }
                      });
                      setValueMap(newValueMap);
                    }}
                    autoComplete="off"
                  />
                </div>
                <span style={{ fontSize: '13px', color: darkColor, fontWeight: 700 }}>%</span>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {message && (
                <span style={{ color: message.type === 'success' ? '#16a34a' : '#dc2626', fontSize: '13px', fontWeight: 600 }}>
                  {message.text}
                </span>
              )}
              <button
                type="button"
                disabled={saving}
                className="px-4 py-2 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 active:scale-95 flex items-center gap-2"
                style={{
                  backgroundColor: primaryColor,
                }}
                onClick={handleSave}
              >
                {saving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  'Save Collection'
                )}
              </button>
            </div>
          </div>

          {/* Price Adjustment Real-time Preview Table */}
          <PriceAdjustmentPreview
            storeId={storeId}
            enabledMap={enabledMap}
            valueMap={valueMap}
            savedValueMap={savedValueMap}
            isSaving={saving}
          />
        </>
      )}
    </div>
  );
}
