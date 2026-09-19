"use client";
import React from "react";
import { Icon } from "@shopify/polaris";
import { DiscountIcon } from "@shopify/polaris-icons";
import { CATEGORY_PRESETS, CategoryPreset } from "@/lib/constants/variant-library";

interface CategoryPresetPickerProps {
  onSelectCategory: (preset: CategoryPreset) => void;
  disabled?: boolean;
}

export function CategoryPresetPicker({ onSelectCategory, disabled }: CategoryPresetPickerProps) {
  return (
    <div className="mb-6 p-4 bg-teal-50/70 border border-teal-100 rounded-xl shadow-2xs">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs sm:text-sm font-bold text-[#115e59] uppercase tracking-wider flex items-center gap-1.5">
          <div style={{ width: 16, height: 16 }}>
            <Icon source={DiscountIcon} tone="subdued" />
          </div>
          Category-Aware Presets
        </h3>
        <span className="text-2xs sm:text-xs text-[#0f766e]">Select to quick-load option templates</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORY_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelectCategory(preset)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-teal-200 text-[#0f766e] hover:bg-[#0db69d] hover:text-white hover:border-[#0db69d] transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <span>{preset.icon}</span>
            <span>{preset.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
