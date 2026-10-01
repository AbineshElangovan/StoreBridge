"use client";

import React, { useState, useEffect, useRef } from "react";
import { shopifyFetch } from "@/lib/shopify/Client";
import { PriceAdjustmentPreviewResponse } from "@/services/price-adjustment/price-adjustment-preview-service";
import { AffectedProductSummary } from "./AffectedProductSummary";
import { PreviewProductTable } from "./PreviewProductTable";

import { useTheme } from "@/components/providers/ThemeContext";

interface PriceAdjustmentPreviewProps {
  storeId: string;
  enabledMap: { [collectionId: string]: boolean };
  valueMap: { [collectionId: string]: string };
  savedValueMap: { [collectionId: string]: string };
  isSaving?: boolean;
}

export function PriceAdjustmentPreview({
  storeId,
  enabledMap,
  valueMap,
  savedValueMap,
  isSaving,
}: PriceAdjustmentPreviewProps) {
  const { currentTheme } = useTheme();
  const [previewData, setPreviewData] = useState<PriceAdjustmentPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Request sequencing counter to prevent stale out-of-order responses from overwriting newer previews
  const requestIdRef = useRef(0);

  const hasActiveAdjustments = Object.keys(enabledMap).some((colId) => {
    return Boolean(enabledMap[colId]) || parseFloat(valueMap[colId] || "0") !== 0 || parseFloat(savedValueMap[colId] || "0") !== 0;
  });

  useEffect(() => {
    if (!storeId || (!hasActiveAdjustments && !isSaving)) {
      setPreviewData(null);
      setLoading(false);
      return;
    }

    const currentRequestId = ++requestIdRef.current;

    const timer = setTimeout(() => {
      fetchPreview(currentRequestId);
    }, 300); // 300ms debounce

    let pollInterval: NodeJS.Timeout | null = null;
    if (isSaving) {
      pollInterval = setInterval(() => {
        const reqId = ++requestIdRef.current;
        fetchPreview(reqId);
      }, 1000);
    }

    return () => {
      clearTimeout(timer);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [storeId, enabledMap, valueMap, savedValueMap, isSaving, hasActiveAdjustments]);

  const fetchPreview = async (requestId: number) => {
    try {
      setLoading(true);
      setError(null);

      const adjustments = Object.keys(enabledMap).map((colId) => ({
        collectionId: colId,
        enabled: Boolean(enabledMap[colId]),
        adjustmentType: "PERCENTAGE" as const,
        adjustmentValue: valueMap[colId] || "0",
        savedValue: savedValueMap[colId] || "0",
      }));

      const res = await shopifyFetch("/api/price-adjustment/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          adjustments,
        }),
      });

      // Ignore stale response if a newer request has already been issued
      if (requestId !== requestIdRef.current) return;

      if (!res.ok) {
        throw new Error("Failed to load price adjustment preview.");
      }

      const data: PriceAdjustmentPreviewResponse = await res.json();

      // Final check before state update
      if (requestId === requestIdRef.current) {
        setPreviewData(data);
      }
    } catch (err: any) {
      if (requestId === requestIdRef.current) {
        console.error("[Price Adjustment Preview Error]", err);
        setError(err.message || "Failed to load preview.");
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const primaryColor = currentTheme?.primaryColor || '#047857';
  const accentColor = currentTheme?.accentColor || '#d1fae5';
  const darkColor = currentTheme?.darkColor || '#022c22';
  const borderColor = currentTheme?.navbarBorder || '#34d399';

  if (!hasActiveAdjustments && !isSaving) {
    return (
      <div
        className="p-4 rounded-xl text-center text-xs font-semibold mt-4 border border-dashed transition-colors"
        style={{
          backgroundColor: `${accentColor}25`,
          borderColor: `${borderColor}60`,
          color: darkColor,
        }}
      >
        Select collections and enter price adjustment percentage (or use Bulk Apply) to preview affected products and price changes.
      </div>
    );
  }

  const tableRows = previewData?.tableRows || [];

  return (
    <div className="space-y-4 mt-4 pt-4 border-t" style={{ borderTopColor: `${borderColor}50` }}>
      {loading && (
        <div
          className="flex items-center justify-between px-3.5 py-2 text-2xs font-bold rounded-lg border transition-colors shadow-2xs"
          style={{
            backgroundColor: `${accentColor}35`,
            color: darkColor,
            borderColor: `${borderColor}60`,
          }}
        >
          <span>Updating price adjustment preview...</span>
          <div
            className="w-3.5 h-3.5 border-2 rounded-full animate-spin shrink-0"
            style={{
              borderColor: primaryColor,
              borderTopColor: 'transparent',
            }}
          />
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-900 text-xs font-semibold rounded-xl border border-red-200">
          {error}
        </div>
      )}

      {previewData && (
        <div className="space-y-3">
          <AffectedProductSummary
            totalCollections={previewData.totalSelectedCollections}
            totalAffectedProducts={previewData.totalAffectedProducts}
            shownProductsCount={tableRows.length}
          />

          <PreviewProductTable rows={tableRows} isSaving={isSaving} />
        </div>
      )}
    </div>
  );
}
