"use client";
import React, { useState, useEffect } from "react";
import { Icon } from "@shopify/polaris";
import { XIcon } from "@shopify/polaris-icons";
import { shopifyFetch } from "@/lib/shopify/Client";
import { VariantOptionInput } from "@/services/sku/variant-combinations";
import { SkuPreviewResponse } from "@/services/sku/sku-preview-service";
import { ProductSelector, ProductItem } from "./ProductSelector";
import { VariantOptionSelector } from "./VariantOptionSelector";
import { SkuPreviewTable } from "./SkuPreviewTable";
import { SkuValidationBanner } from "./SkuValidationBanner";
import { SkuGenerationActions } from "./SkuGenerationActions";
import { ExistingVariantsManager, ExistingVariantItem } from "./ExistingVariantsManager";
import { useStoreContext } from "@/components/providers/StoreProvider";

export function SkuGeneratorContainer() {
  const { canManageSku } = useStoreContext();
  const hasWriteAccess = canManageSku;

  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [existingVariants, setExistingVariants] = useState<ExistingVariantItem[]>([]);
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());
  const [options, setOptions] = useState<VariantOptionInput[]>([]);
  const [previewData, setPreviewData] = useState<SkuPreviewResponse | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (selectedProduct) {
      loadProductVariantsAndOptions(selectedProduct.shopifyProductId);
    }
  }, [selectedProduct]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadProductVariantsAndOptions = async (shopifyProductId: string) => {
    try {
      const res = await shopifyFetch(`/api/sku-generation/products/${encodeURIComponent(shopifyProductId)}/variants`);
      const data = await res.json();
      if (data.success) {
        const loadedVariants: ExistingVariantItem[] = (data.variants || []).map((v: any) => ({
          id: v.id,
          shopifyVariantId: v.shopifyVariantId,
          title: v.title,
          sku: v.sku,
          imageUrl: v.imageUrl || data.product?.imageUrl || null,
          price: v.price,
          inventoryQuantity: v.inventoryQuantity,
        }));

        setExistingVariants(loadedVariants);
        // By default, select all variants
        setSelectedVariantIds(new Set(loadedVariants.map((v) => v.id)));

        // Start clean with empty options unless product already has genuine custom options
        if (data.detectedOptions && data.detectedOptions.length > 0 && data.detectedOptions.some((o: any) => o.name !== "Title" && o.values.length > 0)) {
          setOptions(data.detectedOptions);
        } else {
          setOptions([]);
        }
        setPreviewData(null);
      }
    } catch (err) {
      console.error("Failed to fetch product variants:", err);
      setExistingVariants([]);
      setSelectedVariantIds(new Set());
      setOptions([]);
    }
  };

  const handleToggleVariant = (variantId: string) => {
    setSelectedVariantIds((prev) => {
      const next = new Set(prev);
      if (next.has(variantId)) {
        next.delete(variantId);
      } else {
        next.add(variantId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedVariantIds.size === existingVariants.length) {
      setSelectedVariantIds(new Set());
    } else {
      setSelectedVariantIds(new Set(existingVariants.map((v) => v.id)));
    }
  };

  const handleGeneratePreview = async () => {
    if (!selectedProduct) {
      setToast({ message: "Please select a product first.", type: "error" });
      return;
    }

    try {
      setIsGenerating(true);
      const res = await shopifyFetch("/api/sku-generation/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopifyProductId: selectedProduct.shopifyProductId,
          options,
        }),
      });

      const data: SkuPreviewResponse = await res.json();
      setPreviewData(data);

      if (!data.canApply) {
        setToast({ message: "Validation notice: check SKU conflicts or option configuration.", type: "error" });
      } else {
        setToast({ message: "Preview generated successfully!", type: "success" });
      }
    } catch (err: any) {
      setToast({ message: err.message || "Failed to generate preview.", type: "error" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = async () => {
    if (!selectedProduct || !previewData || !previewData.canApply) return;

    try {
      setIsApplying(true);
      const res = await shopifyFetch("/api/sku-generation/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopifyProductId: selectedProduct.shopifyProductId,
          options,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setToast({
          message: `Successfully updated and synchronized ${data.summary.createdCount} variants with Shopify!`,
          type: "success",
        });

        // Refresh preview and product variants
        await loadProductVariantsAndOptions(selectedProduct.shopifyProductId);
      } else {
        setToast({ message: data.errors?.join("; ") || "Failed to apply SKU generation.", type: "error" });
      }
    } catch (err: any) {
      setToast({ message: err.message || "Failed to apply changes.", type: "error" });
    } finally {
      setIsApplying(false);
    }
  };

  const handleReset = () => {
    setOptions([]);
    setPreviewData(null);
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`p-4 rounded-xl border text-xs sm:text-sm font-semibold shadow-xs flex items-center justify-between ${
            toast.type === "success"
              ? "bg-green-50 text-green-900 border-green-200"
              : "bg-red-50 text-red-900 border-red-200"
          }`}
        >
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} className="text-gray-500 hover:text-gray-800 ml-2 p-0.5 flex items-center justify-center cursor-pointer" title="Dismiss">
            <span className="w-3.5 h-3.5 flex items-center"><Icon source={XIcon} tone="subdued" /></span>
          </button>
        </div>
      )}

      {/* Unified Product & Variants Card */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xs overflow-hidden divide-y divide-gray-100">
        <ProductSelector
          selectedProductId={selectedProduct?.shopifyProductId || ""}
          onSelectProduct={(p) => setSelectedProduct(p)}
          disabled={!hasWriteAccess || isGenerating || isApplying}
          borderless
        />

        {selectedProduct && existingVariants.length > 0 && (
          <ExistingVariantsManager
            productId={selectedProduct.shopifyProductId}
            productTitle={selectedProduct.title}
            productImage={selectedProduct.imageUrl}
            variants={existingVariants}
            selectedVariantIds={selectedVariantIds}
            onToggleVariant={handleToggleVariant}
            onToggleSelectAll={handleToggleSelectAll}
            onVariantUpdated={() => loadProductVariantsAndOptions(selectedProduct.shopifyProductId)}
            disabled={!hasWriteAccess || isGenerating || isApplying}
            borderless
          />
        )}
      </div>

      {/* Option Builder */}
      <VariantOptionSelector options={options} setOptions={setOptions} disabled={!hasWriteAccess || isGenerating || isApplying} />

      {/* Action Toolbar */}
      <SkuGenerationActions
        onGeneratePreview={handleGeneratePreview}
        onApply={handleApply}
        onReset={handleReset}
        isGenerating={isGenerating}
        isApplying={isApplying}
        canApply={Boolean(previewData && previewData.canApply)}
        disabled={!hasWriteAccess || !selectedProduct}
      />

      {/* Validation Banner */}
      {previewData && (
        <SkuValidationBanner
          errors={previewData.validationErrors}
          duplicateSkuCount={previewData.duplicateSkuCount}
        />
      )}

      {/* Preview Table */}
      {previewData && (
        <div className="bg-white p-4 sm:p-6 border border-teal-100 rounded-2xl shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-[#115e59]">
              Dynamic SKU & Variant Combination Preview
            </h3>
            <span className="text-xs text-gray-500 font-mono">
              Product: {previewData.product.title}
            </span>
          </div>

          <SkuPreviewTable
            optionNames={previewData.optionNames}
            items={previewData.items}
            totalCombinations={previewData.totalCombinations}
            existingCount={previewData.existingCount}
            newCount={previewData.newCount}
            duplicateSkuCount={previewData.duplicateSkuCount}
          />
        </div>
      )}
    </div>
  );
}
