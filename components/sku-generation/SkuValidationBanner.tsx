"use client";
import React from "react";
import { ValidationErrorItem } from "@/services/sku/sku-validator";

interface SkuValidationBannerProps {
  errors: ValidationErrorItem[];
  duplicateSkuCount?: number;
  shopifyMessage?: string;
}

export function SkuValidationBanner({ errors, duplicateSkuCount = 0, shopifyMessage }: SkuValidationBannerProps) {
  if (errors.length === 0 && duplicateSkuCount === 0 && !shopifyMessage) {
    return null;
  }

  return (
    <div className="space-y-2 mb-4">
      {errors.map((err, idx) => (
        <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-800 flex items-center gap-2">
          <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{err.message}</span>
        </div>
      ))}

      {duplicateSkuCount > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            {duplicateSkuCount} SKU conflict(s) detected. Please adjust option values or update global sequence before applying.
          </span>
        </div>
      )}

      {shopifyMessage && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-semibold text-blue-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{shopifyMessage}</span>
        </div>
      )}
    </div>
  );
}
