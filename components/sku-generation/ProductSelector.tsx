"use client";
import React, { useState, useEffect, useRef } from "react";
import { shopifyFetch } from "@/lib/shopify/Client";

export interface ProductItem {
  id: string;
  shopifyProductId: string;
  title: string;
  sku: string | null;
  allSkus?: string[];
  imageUrl: string | null;
  price: number;
  variantCount?: number;
  collections?: { id: string; title: string }[];
  tags?: string[];
}

interface ProductSelectorProps {
  selectedProductId: string;
  onSelectProduct: (product: ProductItem | null) => void;
  disabled?: boolean;
  borderless?: boolean;
}

export function ProductSelector({ selectedProductId, onSelectProduct, disabled, borderless = false }: ProductSelectorProps) {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [collections, setCollections] = useState<{ id: string; title: string }[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
    fetchCollections();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchCollections = async () => {
    try {
      const res = await shopifyFetch("/api/collections");
      const data = await res.json();
      if (Array.isArray(data)) {
        // Deduplicate collections by clean title
        const uniqueMap = new Map<string, { id: string; title: string }>();
        for (const c of data) {
          const cleanTitle = (c.title || "").trim();
          if (cleanTitle && !uniqueMap.has(cleanTitle.toLowerCase())) {
            uniqueMap.set(cleanTitle.toLowerCase(), { id: c.id, title: cleanTitle });
          }
        }
        setCollections(Array.from(uniqueMap.values()));
      }
    } catch (err) {
      console.error("Failed to load collections:", err);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await shopifyFetch("/api/sku-generation/products");
      const data = await res.json();
      if (data.success && data.products) {
        setProducts(data.products);
        if (!selectedProductId && data.products.length > 0) {
          onSelectProduct(data.products[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load products for SKU generator:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    // 1. Collection filter
    if (selectedCollection !== "ALL") {
      const inCollection = p.collections?.some((c) => c.title.toLowerCase() === selectedCollection.toLowerCase() || c.id === selectedCollection);
      const matchesTitle = p.title.toLowerCase().includes(selectedCollection.toLowerCase());
      const matchesTags = p.tags?.some((t) => t.toLowerCase() === selectedCollection.toLowerCase());
      if (!inCollection && !matchesTitle && !matchesTags) {
        return false;
      }
    }

    // 2. Search query filter
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const titleMatch = p.title.toLowerCase().includes(term);
    const skuMatch = p.sku && p.sku.toLowerCase().includes(term);
    const allSkusMatch = p.allSkus && p.allSkus.some((s) => s.toLowerCase().includes(term));
    const shopifyIdMatch = p.shopifyProductId.toLowerCase().includes(term);
    return titleMatch || skuMatch || allSkusMatch || shopifyIdMatch;
  });

  const currentSelected = products.find(
    (p) => p.shopifyProductId === selectedProductId || p.id === selectedProductId
  );

  const handleSelect = (product: ProductItem) => {
    onSelectProduct(product);
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <div className={`p-4 sm:p-6 space-y-3 ${borderless ? "" : "bg-white border border-gray-200 rounded-2xl shadow-2xs"}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-2">
          <svg className="w-4 h-4 text-[#0db69d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span>Select Product</span>
        </label>
        {loading && <span className="text-2xs text-teal-600 font-bold animate-pulse">Loading products...</span>}
      </div>

      {/* FILTER & INTEGRATED SEARCHABLE DROPDOWN ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Collection Filter */}
        <div className="sm:col-span-1">
          <label className="block text-2xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">
            Collection Filter
          </label>
          <select
            value={selectedCollection}
            onChange={(e) => setSelectedCollection(e.target.value)}
            disabled={disabled || loading}
            className="w-full px-3 py-2 text-xs font-extrabold border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0db69d] focus:border-[#0db69d] bg-white cursor-pointer shadow-2xs text-gray-800"
          >
            <option value="ALL">All Collections & Categories</option>
            {collections.map((col) => (
              <option key={col.id} value={col.title}>
                {col.title}
              </option>
            ))}
          </select>
        </div>

        {/* Integrated Searchable Product Dropdown */}
        <div className="sm:col-span-2 relative" ref={dropdownRef}>
          <label className="block text-2xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">
            Search & Select Product
          </label>
          
          {/* Main Button / Input trigger */}
          <button
            type="button"
            disabled={disabled || loading}
            onClick={() => {
              setIsOpen(!isOpen);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            className="w-full px-3.5 py-2 text-xs sm:text-sm font-extrabold text-left border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0db69d] bg-white disabled:bg-gray-50 cursor-pointer shadow-2xs flex items-center justify-between gap-2"
          >
            <span className="truncate text-gray-900">
              {currentSelected
                ? `${currentSelected.title} ${
                    currentSelected.sku ? `[SKU: ${currentSelected.sku}]` : ""
                  }`
                : "Select product..."}
            </span>
            <span className="text-gray-400 text-xs shrink-0">▾</span>
          </button>

          {/* Floating Dropdown Menu with Live Search */}
          {isOpen && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl max-h-80 flex flex-col overflow-hidden divide-y divide-gray-100">
              {/* Sticky Search Input at the top of the dropdown */}
              <div className="p-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Type SKU or title (e.g. 'ts' for T-Shirt)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0db69d] focus:border-[#0db69d]"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="text-gray-400 hover:text-gray-600 text-xs font-bold px-1"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Items List */}
              <div className="overflow-y-auto max-h-60 p-1 divide-y divide-gray-50">
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-500 font-semibold">
                    No products found matching &quot;{searchTerm}&quot;
                    {selectedCollection !== "ALL" && ` in collection "${selectedCollection}"`}
                  </div>
                ) : (
                  filteredProducts.map((p) => {
                    const isSelected = p.shopifyProductId === selectedProductId;
                    const skusText = p.allSkus && p.allSkus.length > 0 ? p.allSkus.join(", ") : (p.sku || "No SKU");
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelect(p)}
                        className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-teal-50 text-[#0f766e] font-extrabold"
                            : "hover:bg-gray-50 text-gray-800"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.title}
                              className="w-7 h-7 object-cover rounded-md border border-gray-200 shrink-0 bg-white"
                            />
                          ) : (
                            <div className="w-7 h-7 bg-teal-100 text-[#0f766e] font-bold text-3xs rounded-md flex items-center justify-center shrink-0">
                              PROD
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-extrabold truncate m-0">{p.title}</p>
                            <p className="text-3xs text-gray-400 font-mono truncate m-0">
                              SKU: {skusText}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-3xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                            {p.variantCount || p.allSkus?.length || 1} var
                          </span>
                          <span className="text-2xs font-semibold text-gray-700">
                            ₹{p.price}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
