'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { shopifyFetch } from '@/lib/shopify/Client';
import { Loading } from '@/components/common/Loading';
import { useTheme } from '@/components/providers/ThemeContext';

export interface CollectionSummary {
  id: string;
  shopifyCollectionId: string;
  title: string;
  handle: string;
}

interface PreorderCollectionSelectorProps {
  selectedCollectionIds: string[];
  onChange: (collectionIds: string[]) => void;
  disabled?: boolean;
}

export function PreorderCollectionSelector({
  selectedCollectionIds,
  onChange,
  disabled = false,
}: PreorderCollectionSelectorProps) {
  const { currentTheme } = useTheme();
  const primaryColor = currentTheme?.primaryColor || '#047857';

  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      setLoading(true);
      const res = await shopifyFetch('/api/collections');
      const data = await res.json();
      if (Array.isArray(data)) {
        // Deduplicate collections by clean title
        const map = new Map<string, CollectionSummary>();
        data.forEach((c) => {
          const t = (c.title || '').trim();
          if (t && !map.has(t.toLowerCase())) {
            map.set(t.toLowerCase(), {
              id: c.id,
              shopifyCollectionId: c.shopifyCollectionId || c.id,
              title: t,
              handle: c.handle || '',
            });
          }
        });
        setCollections(Array.from(map.values()));
      }
    } catch (err) {
      console.error('[PreorderCollectionSelector] Failed to load collections:', err);
    } finally {
      setLoading(false);
    }
  };

  const normalizeId = (id: string) => id.replace(/^gid:\/\/shopify\/Collection\//, '');

  const normalizedSelected = useMemo(() => {
    return new Set(selectedCollectionIds.map(normalizeId));
  }, [selectedCollectionIds]);

  const filteredCollections = useMemo(() => {
    if (!searchTerm.trim()) return collections;
    const query = searchTerm.toLowerCase();
    return collections.filter((c) => c.title.toLowerCase().includes(query));
  }, [collections, searchTerm]);

  const toggleCollection = (colId: string) => {
    if (disabled) return;
    const clean = normalizeId(colId);
    const newSelected = new Set(normalizedSelected);
    if (newSelected.has(clean)) {
      newSelected.delete(clean);
    } else {
      newSelected.add(clean);
    }
    onChange(Array.from(newSelected));
  };

  const removeCollection = (cleanId: string) => {
    if (disabled) return;
    const newSelected = new Set(normalizedSelected);
    newSelected.delete(cleanId);
    onChange(Array.from(newSelected));
  };

  const selectAll = () => {
    if (disabled) return;
    const newSelected = new Set(normalizedSelected);
    filteredCollections.forEach((c) => newSelected.add(normalizeId(c.shopifyCollectionId || c.id)));
    onChange(Array.from(newSelected));
  };

  const clearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  const selectedCollectionsList = useMemo(() => {
    return collections.filter((c) => normalizedSelected.has(normalizeId(c.shopifyCollectionId || c.id)));
  }, [collections, normalizedSelected]);

  if (loading) {
    return (
      <div className="py-6 flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
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
          placeholder="Search collections by title..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={disabled}
          className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Action Header & Counts */}
      <div className="flex items-center justify-between text-xs font-medium text-gray-600 pb-1 border-b border-gray-100">
        <div>
          <span>
            {normalizedSelected.size} collection{normalizedSelected.size === 1 ? '' : 's'} selected
          </span>
          <span className="text-gray-400 mx-2">•</span>
          <span>{filteredCollections.length} visible</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectAll}
            disabled={disabled || filteredCollections.length === 0}
            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            Select All
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={disabled || normalizedSelected.size === 0}
            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear All
          </button>
        </div>
      </div>

      {/* Selected Collections Chips Tray */}
      {selectedCollectionsList.length > 0 && (
        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-2 bg-gray-50 rounded-lg border border-gray-200">
          {selectedCollectionsList.map((c) => {
            const clean = normalizeId(c.shopifyCollectionId || c.id);
            return (
              <span
                key={clean}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white border border-gray-300 text-gray-800 shadow-2xs"
              >
                <span className="truncate max-w-[150px]">{c.title}</span>
                <button
                  type="button"
                  onClick={() => removeCollection(clean)}
                  disabled={disabled}
                  className="hover:text-red-600 font-bold ml-0.5 cursor-pointer text-gray-400"
                  title="Remove collection"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Collection List */}
      <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white">
        {filteredCollections.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            No collections found matching your search.
          </div>
        ) : (
          filteredCollections.map((c) => {
            const clean = normalizeId(c.shopifyCollectionId || c.id);
            const isSelected = normalizedSelected.has(clean);

            return (
              <label
                key={clean}
                className={`flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                  isSelected ? 'bg-emerald-50/40' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleCollection(c.shopifyCollectionId || c.id)}
                    disabled={disabled}
                    style={{ accentColor: primaryColor }}
                    className="h-4 w-4 rounded cursor-pointer"
                  />
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{c.title}</div>
                    {c.handle && <div className="text-xs text-gray-400">/{c.handle}</div>}
                  </div>
                </div>
                {isSelected && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                    Selected
                  </span>
                )}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
