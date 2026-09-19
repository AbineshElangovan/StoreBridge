"use client";
import React from "react";

interface SkuGenerationActionsProps {
  onGeneratePreview: () => void;
  onApply: () => void;
  onReset: () => void;
  isGenerating?: boolean;
  isApplying?: boolean;
  canApply?: boolean;
  disabled?: boolean;
}

export function SkuGenerationActions({
  onGeneratePreview,
  onApply,
  onReset,
  isGenerating,
  isApplying,
  canApply,
  disabled,
}: SkuGenerationActionsProps) {
  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
      {/* Button 1: Reset Options with Refresh Icon */}
      <button
        type="button"
        onClick={onReset}
        disabled={disabled || isGenerating || isApplying}
        className="px-4 py-2.5 text-xs sm:text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 active:bg-amber-700 border border-amber-600 rounded-lg transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 group"
        title="Reset all variant option inputs"
      >
        <svg
          className="w-4 h-4 text-amber-100 group-hover:rotate-180 transition-transform duration-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span>Reset Options</span>
      </button>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Button 2: Generate Preview with Search/Eye Icon */}
        <button
          type="button"
          onClick={onGeneratePreview}
          disabled={disabled || isGenerating || isApplying}
          className="px-5 py-2.5 bg-indigo-600 text-white border border-indigo-700 text-xs sm:text-sm font-bold rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-indigo-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          )}
          <span>{isGenerating ? "Generating..." : "Generate Preview"}</span>
        </button>

        {/* Button 3: Apply & Sync with Lightning Icon */}
        <button
          type="button"
          onClick={onApply}
          disabled={disabled || !canApply || isGenerating || isApplying}
          className="px-6 py-2.5 bg-[#0db69d] text-white border border-[#0a9984] text-xs sm:text-sm font-bold rounded-lg hover:bg-[#0a9984] active:bg-[#087867] transition-all shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#0db69d] cursor-pointer flex items-center justify-center gap-2"
        >
          {isApplying ? (
            <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-emerald-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          )}
          <span>{isApplying ? "Applying & Syncing..." : "Apply & Sync to Shopify"}</span>
        </button>
      </div>
    </div>
  );
}
