"use client";
import React, { useState, useEffect } from "react";
import { shopifyFetch } from "@/lib/shopify/Client";

export interface ProductItem {
  id: string;
  shopifyProductId: string;
  title: string;
  sku: string | null;
  allSkus?: string[];
  imageUrl: string | null;
  price: number;
}

interface ProductSelectorProps {
  selectedProductId: string;
  onSelectProduct: (product: ProductItem | null) => void;
  disabled?: boolean;
}

export function ProductSelector({ selectedProductId, onSelectProduct, disabled }: ProductSelectorProps) {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchProducts();
  }, []);

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

  const handleClearSearch = () => {
    setSearchTerm("");
  };

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-2xs space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-2">
          <svg className="w-4 h-4 text-[#0db69d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span>Select Product</span>
        </label>
        {loading && <span className="text-2xs text-teal-600 font-bold animate-pulse">Loading products...</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <select
            value={currentSelected?.shopifyProductId || ""}
            onChange={(e) => {
              const selected = products.find((p) => p.shopifyProductId === e.target.value);
              onSelectProduct(selected || null);
            }}
            disabled={disabled || loading}
            className="w-full px-3.5 py-2 text-xs sm:text-sm font-extrabold border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0db69d] focus:border-[#0db69d] bg-white disabled:bg-gray-50 cursor-pointer shadow-2xs"
          >
            {products.length === 0 && <option value="">No products found</option>}
            {filteredProducts.length === 0 && products.length > 0 && (
              <option value="">No products match "{searchTerm}"</option>
            )}
            {filteredProducts.map((p) => {
              const displaySkus = p.allSkus && p.allSkus.length > 0 
                ? (p.allSkus.length > 2 ? `${p.allSkus.slice(0, 2).join(", ")} (+${p.allSkus.length - 2} more)` : p.allSkus.join(", "))
                : (p.sku || "");
              return (
                <option key={p.id} value={p.shopifyProductId}>
                  {p.title} {displaySkus ? `[SKU: ${displaySkus}]` : ""}
                </option>
              );
            })}
          </select>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Filter product by title or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={disabled || loading}
            className="w-full pl-3.5 pr-9 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0db69d] focus:border-[#0db69d] shadow-2xs"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 font-bold text-xs cursor-pointer"
              title="Clear search filter"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {currentSelected && (
        <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {currentSelected.imageUrl ? (
              <img
                src={currentSelected.imageUrl}
                alt={currentSelected.title}
                className="w-10 h-10 object-cover rounded-lg border border-gray-200 shrink-0 bg-white"
                onError={(e) => {
                  // Fallback if image URL fails to load
                  (e.target as HTMLElement).style.display = "none";
                  (e.target as HTMLElement).nextElementSibling?.classList.remove("hidden");
                }}
              />
            ) : null}
            <div className={`w-10 h-10 bg-teal-100 text-[#0f766e] font-bold text-2xs rounded-lg flex items-center justify-center shrink-0 ${currentSelected.imageUrl ? "hidden" : ""}`}>
              PROD
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-gray-900">{currentSelected.title}</h4>
              <p className="text-xs font-semibold text-gray-600">Price: ₹{currentSelected.price}</p>
            </div>
          </div>

          <span className="px-2.5 py-1 text-2xs font-bold bg-teal-100 text-[#0f766e] rounded-md shrink-0">
            Active Product
          </span>
        </div>
      )}

      {searchTerm.trim() !== "" && filteredProducts.length === 0 && (
        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>No products found matching "<strong>{searchTerm}</strong>".</span>
          </div>
          <button
            type="button"
            onClick={handleClearSearch}
            className="text-xs font-bold text-amber-800 underline cursor-pointer hover:text-amber-950 shrink-0"
          >
            Clear Filter
          </button>
        </div>
      )}
    </div>
  );
}
