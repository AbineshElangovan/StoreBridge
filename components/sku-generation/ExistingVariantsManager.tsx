"use client";
import React, { useState } from "react";
import { Icon } from "@shopify/polaris";
import { XIcon } from "@shopify/polaris-icons";

export interface ExistingVariantItem {
  id: string;
  shopifyVariantId: string;
  title: string;
  sku: string | null;
  imageUrl?: string | null;
  price: number;
  inventoryQuantity: number;
}

interface ExistingVariantsManagerProps {
  productId?: string;
  productTitle: string;
  productImage?: string | null;
  variants: ExistingVariantItem[];
  selectedVariantIds?: Set<string>;
  onToggleVariant?: (variantId: string) => void;
  onToggleSelectAll?: () => void;
  onVariantUpdated?: () => void;
  disabled?: boolean;
  borderless?: boolean;
}

export function ExistingVariantsManager({
  productId: _productId,
  productTitle,
  productImage,
  variants,
  disabled: _disabled = false,
  borderless = false,
}: ExistingVariantsManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredVariants = variants.filter((v) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      v.title.toLowerCase().includes(term) ||
      (v.sku && v.sku.toLowerCase().includes(term)) ||
      String(v.price).includes(term)
    );
  });

  if (variants.length === 0) {
    return null;
  }

  return (
    <div className={`p-4 sm:p-6 space-y-4 ${borderless ? "" : "bg-white border border-gray-200 rounded-2xl shadow-2xs"}`}>
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0db69d]" />
          <div>
            <div className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
              <span>Existing Product Variants</span>
              <span className="text-2xs font-mono bg-teal-50 text-[#0f766e] px-2 py-0.5 rounded-full border border-teal-100">
                {variants.length} {variants.length === 1 ? "Variant" : "Variants"}
              </span>
            </div>
            <p className="text-xs text-gray-500 m-0">
              All variants of this product. When you generate new variants, old ones will be replaced while retaining collections.
            </p>
          </div>
        </div>

        {/* Search inside variants */}
        <div className="relative sm:w-64">
          <input
            type="text"
            placeholder="Search variant or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-8 py-1.5 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0db69d]"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1.5 text-gray-400 hover:text-gray-600 flex items-center justify-center p-0.5 cursor-pointer"
              title="Clear search"
            >
              <span className="w-3 h-3 flex items-center"><Icon source={XIcon} tone="subdued" /></span>
            </button>
          )}
        </div>
      </div>

      {/* Variants List: One by one without checkboxes */}
      <div className="flex flex-col space-y-2.5">
        {filteredVariants.map((v) => {
          const displayImage = v.imageUrl || productImage;

          return (
            <div
              key={v.id}
              className="p-3 rounded-xl border border-gray-200 bg-white hover:border-teal-200 hover:bg-teal-50/20 transition-all flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Variant Thumbnail */}
                {displayImage ? (
                  <img
                    src={displayImage}
                    alt={v.title}
                    className="w-11 h-11 object-cover rounded-lg border border-gray-200 shrink-0 bg-white"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-11 h-11 bg-gray-100 text-gray-500 font-bold text-3xs rounded-lg flex items-center justify-center shrink-0 border border-gray-200">
                    VAR
                  </div>
                )}

                {/* Variant Info */}
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-gray-900 truncate m-0">
                    {(() => {
                      if (!v.title || v.title === "Default Title") return productTitle;
                      if (v.title.includes(" - ")) {
                        return v.title.split(" - ").slice(1).join(" - ").trim();
                      }
                      if (v.title.startsWith(`${productTitle} - `)) {
                        return v.title.replace(`${productTitle} - `, "").trim();
                      }
                      return v.title;
                    })()}
                  </h4>
                  <div className="flex items-center gap-3 mt-0.5 text-2xs text-gray-500">
                    <span className="font-semibold text-gray-700">₹{v.price}</span>
                    <span>•</span>
                    <span className={`font-semibold ${v.inventoryQuantity > 0 ? "text-emerald-700" : "text-gray-400"}`}>
                      Stock: {v.inventoryQuantity}
                    </span>
                  </div>
                </div>
              </div>

              {/* SKU Pill */}
              <div className="shrink-0 flex items-center gap-2">
                <span className="text-3xs uppercase tracking-wider text-gray-400 font-semibold hidden sm:inline">SKU:</span>
                <span className="text-xs font-mono font-bold text-gray-800 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-lg">
                  {v.sku || "No SKU"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
