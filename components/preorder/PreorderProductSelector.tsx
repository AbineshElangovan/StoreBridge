'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { shopifyFetch } from '@/lib/shopify/Client';
import { Loading } from '@/components/common/Loading';
import { PolarisSelect } from '@/components/common';
import { useTheme } from '@/components/providers/ThemeContext';

export interface ProductSummary {
  id: string;
  shopifyProductId: string;
  title: string;
  sku: string | null;
  imageUrl: string | null;
  price: number;
  totalInventory: number;
  variantCount?: number;
  isOutOfStock?: boolean;
  hasOutOfStockVariant?: boolean;
  collections?: { id: string; title: string }[];
}

interface PreorderProductSelectorProps {
  selectedProductIds: string[];
  onChange: (productIds: string[]) => void;
  inventoryThreshold?: number;
  disabled?: boolean;
}

export function PreorderProductSelector({
  selectedProductIds,
  onChange,
  inventoryThreshold = 0,
  disabled = false,
}: PreorderProductSelectorProps) {
  const { currentTheme } = useTheme();
  const primaryColor = currentTheme?.primaryColor || '#047857';

  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [collections, setCollections] = useState<{ id: string; title: string }[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<'OOS' | 'ALL'>('OOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const normalizeId = (id: string) => id.replace(/^gid:\/\/shopify\/Product\//, '');

  const loadData = async () => {
    try {
      setLoading(true);
      const [prodRes, colRes] = await Promise.all([
        shopifyFetch('/api/preorder?action=products'),
        shopifyFetch('/api/collections'),
      ]);

      const prodData = await prodRes.json();
      if (prodData.success && Array.isArray(prodData.products)) {
        setProducts(prodData.products);

        // Sanitize: remove any ghost or stale IDs that don't exist in current catalog
        const catalogIds = new Set(prodData.products.map((p: any) => normalizeId(p.shopifyProductId)));
        const sanitized = selectedProductIds.filter((id) => catalogIds.has(normalizeId(id)));
        if (sanitized.length !== selectedProductIds.length) {
          onChange(sanitized);
        }
      }

      const colData = await colRes.json();
      if (Array.isArray(colData)) {
        const unique = new Map<string, { id: string; title: string }>();
        colData.forEach((c) => {
          const t = (c.title || '').trim();
          if (t && !unique.has(t.toLowerCase())) {
            unique.set(t.toLowerCase(), { id: c.id, title: t });
          }
        });
        setCollections(Array.from(unique.values()));
      }
    } catch (err) {
      console.error('[PreorderProductSelector] Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  const normalizedSelected = useMemo(() => {
    return new Set(selectedProductIds.map(normalizeId));
  }, [selectedProductIds]);

  const selectedProductsList = useMemo(() => {
    return products.filter((p) => normalizedSelected.has(normalizeId(p.shopifyProductId)));
  }, [products, normalizedSelected]);

  const oosCount = useMemo(() => {
    return products.filter((p) => (
      p.totalInventory <= inventoryThreshold ||
      p.hasOutOfStockVariant ||
      p.isOutOfStock
    )).length;
  }, [products, inventoryThreshold]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Stock filter: OOS only vs All Products (selected items are always shown so user can view/unselect them)
      const isEligibleOOS =
        p.totalInventory <= inventoryThreshold ||
        p.hasOutOfStockVariant ||
        p.isOutOfStock;
      const isSelected = normalizedSelected.has(normalizeId(p.shopifyProductId));

      if (stockFilter === 'OOS' && !isEligibleOOS && !isSelected) {
        return false;
      }

      // 2. Collection filter
      if (selectedCollection !== 'ALL') {
        const inCol = p.collections?.some(
          (c) => c.title.toLowerCase() === selectedCollection.toLowerCase() || c.id === selectedCollection
        );
        if (!inCol) return false;
      }

      // 3. Search query
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchTitle = p.title.toLowerCase().includes(query);
        const matchSku = p.sku?.toLowerCase().includes(query);
        if (!matchTitle && !matchSku) return false;
      }

      return true;
    });
  }, [products, inventoryThreshold, selectedCollection, searchTerm, stockFilter, normalizedSelected]);

  const toggleProduct = (productId: string) => {
    if (disabled) return;
    const clean = normalizeId(productId);
    const newSelected = new Set(normalizedSelected);
    if (newSelected.has(clean)) {
      newSelected.delete(clean);
    } else {
      newSelected.add(clean);
    }
    onChange(Array.from(newSelected));
  };

  const removeProduct = (cleanId: string) => {
    if (disabled) return;
    const newSelected = new Set(normalizedSelected);
    newSelected.delete(cleanId);
    onChange(Array.from(newSelected));
  };

  const selectAllFiltered = () => {
    if (disabled) return;
    const newSelected = new Set(normalizedSelected);
    filteredProducts.forEach((p) => newSelected.add(normalizeId(p.shopifyProductId)));
    onChange(Array.from(newSelected));
  };

  const clearAllSelected = () => {
    if (disabled) return;
    onChange([]);
  };

  if (loading) {
    return (
      <div className="py-6 flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  const selectedCount = selectedProductsList.length;

  return (
    <div className="space-y-4">
      {/* Search, Stock Filter, and Collection Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <svg
            className="w-4 h-4 absolute left-3 top-3 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search products by title or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={disabled}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Stock Filter Toggle: Out of Stock vs All */}
        <div className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-0.5 text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setStockFilter('OOS')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              stockFilter === 'OOS'
                ? 'bg-[var(--color-primary)] toggle-btn-active font-black shadow-xs border border-[var(--color-primary-dark,var(--color-primary))]'
                : 'text-gray-600 hover:text-black font-semibold'
            }`}
          >
            Out of Stock ({oosCount})
          </button>
          <button
            type="button"
            onClick={() => setStockFilter('ALL')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              stockFilter === 'ALL'
                ? 'bg-[var(--color-primary)] toggle-btn-active font-black shadow-xs border border-[var(--color-primary-dark,var(--color-primary))]'
                : 'text-gray-600 hover:text-black font-semibold'
            }`}
          >
            All Products ({products.length})
          </button>
        </div>

        {collections.length > 0 && (
          <div className="w-48">
            <PolarisSelect
              label="Collection Filter"
              labelHidden
              value={selectedCollection}
              onChange={setSelectedCollection}
              disabled={disabled}
              options={[
                { label: 'All Collections', value: 'ALL' },
                ...collections.map((c) => ({ label: c.title, value: c.title })),
              ]}
            />
          </div>
        )}
      </div>

      {/* Action Header & Accurate Counts */}
      <div className="flex items-center justify-between text-xs font-medium text-gray-600 pb-2 border-b border-gray-100">
        <div>
          <span className="font-semibold text-gray-900">
            {selectedCount} product{selectedCount === 1 ? '' : 's'} selected
          </span>
          <span className="text-gray-400 mx-2">•</span>
          <span>{oosCount} out-of-stock product{oosCount === 1 ? '' : 's'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectAllFiltered}
            disabled={disabled || filteredProducts.length === 0}
            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            Select All
          </button>
          <button
            type="button"
            onClick={clearAllSelected}
            disabled={disabled || selectedCount === 0}
            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear All
          </button>
        </div>
      </div>

      {/* Selected Products Chips Tray */}
      {selectedProductsList.length > 0 && (
        <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-2 bg-gray-50 rounded-lg border border-gray-200">
          {selectedProductsList.map((p) => {
            const clean = normalizeId(p.shopifyProductId);
            return (
              <span
                key={clean}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white border border-gray-300 text-gray-800 shadow-2xs"
              >
                {p.imageUrl && (
                  <img src={p.imageUrl} alt="" className="w-4 h-4 rounded object-cover" />
                )}
                <span className="truncate max-w-[160px]">{p.title}</span>
                <button
                  type="button"
                  onClick={() => removeProduct(clean)}
                  disabled={disabled}
                  className="hover:text-red-600 font-bold ml-1 cursor-pointer text-gray-400"
                  title="Remove product"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Product List */}
      <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white">
        {filteredProducts.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500 space-y-1">
            <p className="font-semibold text-gray-700">No out-of-stock products found.</p>
            <p className="text-xs text-gray-400">
              Only products that are out of stock (≤ {inventoryThreshold} stock) can be selected for pre-order.
            </p>
          </div>
        ) : (
          filteredProducts.map((p) => {
            const clean = normalizeId(p.shopifyProductId);
            const isSelected = normalizedSelected.has(clean);

            return (
              <label
                key={clean}
                className={`flex items-center gap-3.5 p-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                  isSelected ? 'bg-emerald-50/40' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleProduct(p.shopifyProductId)}
                  disabled={disabled}
                  style={{ accentColor: primaryColor }}
                  className="h-4 w-4 rounded cursor-pointer"
                />
                <div className="w-10 h-10 rounded-md bg-gray-100 overflow-hidden shrink-0 border border-gray-200">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                      No img
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 truncate">{p.title}</span>
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                    {p.sku && <span>SKU: {p.sku}</span>}
                    {p.variantCount !== undefined && (
                      <span>• {p.variantCount} variant{p.variantCount === 1 ? '' : 's'}</span>
                    )}
                    {p.price > 0 && <span>• ₹{p.price.toFixed(2)}</span>}
                  </div>
                </div>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
