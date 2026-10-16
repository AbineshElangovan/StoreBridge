"use client";
import React, { useState } from "react";
import { Icon } from "@shopify/polaris";
import { XIcon } from "@shopify/polaris-icons";
import { VariantOptionInput } from "@/services/sku/variant-combinations";
import { MASTER_ATTRIBUTE_FAMILIES, AttributeFamily } from "@/lib/constants/variant-library";
import { ColorSwatchIcon } from "@/components/ui/ColorSwatchIcon";
import { ColorPickerModal } from "./ColorPickerModal";

interface VariantOptionRowProps {
  index: number;
  option: VariantOptionInput;
  onChangeOptionName: (index: number, newName: string) => void;
  onAddValue: (index: number, val: string) => void;
  onRemoveValue: (index: number, valIndex: number) => void;
  onRemoveOption: (index: number) => void;
  onSetValues?: (index: number, newValues: string[]) => void;
  disabled?: boolean;
}

export function VariantOptionRow({
  index,
  option,
  onChangeOptionName,
  onAddValue,
  onRemoveValue,
  onRemoveOption,
  onSetValues,
  disabled,
}: VariantOptionRowProps) {
  const [newValueInput, setNewValueInput] = useState("");
  const [isColorModalOpen, setIsColorModalOpen] = useState(false);

  const optNameLower = option.name.trim().toLowerCase();
  const isColorOption =
    optNameLower === "color" ||
    optNameLower === "colors" ||
    optNameLower === "colour" ||
    optNameLower === "colours" ||
    optNameLower === "pattern" ||
    optNameLower === "print" ||
    optNameLower.includes("color");

  const matchedFamily: AttributeFamily | undefined = MASTER_ATTRIBUTE_FAMILIES.find(
    (f) =>
      f.name.toLowerCase() === option.name.toLowerCase() ||
      f.id.toLowerCase() === option.name.toLowerCase() ||
      option.name.toLowerCase().includes(f.name.toLowerCase()) ||
      f.name.toLowerCase().includes(option.name.toLowerCase())
  );

  const handleKeyDownValue = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (newValueInput.trim()) {
        onAddValue(index, newValueInput.trim());
        setNewValueInput("");
      }
    }
  };

  const handleAddValueClick = () => {
    if (newValueInput.trim()) {
      onAddValue(index, newValueInput.trim());
      setNewValueInput("");
    }
  };

  const handleToggleColorValue = (colorName: string) => {
    if (option.values.includes(colorName)) {
      const valIdx = option.values.indexOf(colorName);
      if (valIdx >= 0) onRemoveValue(index, valIdx);
    } else {
      onAddValue(index, colorName);
    }
  };

  const handleAddCustomColor = (colorName: string) => {
    if (!option.values.includes(colorName)) {
      onAddValue(index, colorName);
    }
  };

  const handleSelectMultipleColors = (colors: string[]) => {
    if (onSetValues) {
      onSetValues(index, colors);
    } else {
      // Fallback: replace values iteratively
      const toRemove = option.values.filter((v) => !colors.includes(v));
      toRemove.forEach((v) => {
        const idx = option.values.indexOf(v);
        if (idx >= 0) onRemoveValue(index, idx);
      });
      colors.forEach((c) => {
        if (!option.values.includes(c)) onAddValue(index, c);
      });
    }
  };

  const isNameEmpty = !option.name || option.name.trim().length === 0;
  const isValuesEmpty = !option.values || option.values.length === 0;

  return (
    <div
      className={`p-4 sm:p-5 bg-white border rounded-xl shadow-2xs space-y-4 transition-all relative ${
        isNameEmpty ? "border-red-200 bg-red-50/10" : "border-gray-200 hover:border-teal-200"
      }`}
    >
      {/* CARD HEADER */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200/80 flex items-center justify-center text-[#0db69d] shrink-0 shadow-2xs">
            {isColorOption ? (
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            ) : (
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h10M7 12h10m-7 5h7" />
              </svg>
            )}
          </div>

          <h3
            className="font-heading text-lg sm:text-xl font-black text-slate-900 tracking-tight m-0 select-none"
            style={{
              fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              fontWeight: 900,
              letterSpacing: "-0.03em",
            }}
          >
            {option.name || `Option #${index + 1}`}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {isColorOption && (
            <button
              type="button"
              onClick={() => setIsColorModalOpen(true)}
              disabled={disabled}
              className="px-3 py-1.5 text-xs font-extrabold text-[#0db69d] bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 text-[#0db69d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              <span>Color Swatches</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onRemoveOption(index)}
            disabled={disabled}
            className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>

      {/* SELECTED VALUES PILLS */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <span>Selected Values ({option.values.length})</span>
            {isColorOption && (
              <span className="text-2xs text-[#0db69d] font-bold">
                (Visual Swatches Active)
              </span>
            )}
          </label>

          {isColorOption && (
            <button
              type="button"
              onClick={() => setIsColorModalOpen(true)}
              disabled={disabled}
              className="text-xs font-extrabold text-[#0db69d] hover:underline flex items-center gap-1"
            >
              + Select from Catalog / Custom →
            </button>
          )}
        </div>

        <div
          className={`p-2.5 bg-white rounded-lg border min-h-[46px] flex flex-wrap items-center gap-1.5 transition-all ${
            isValuesEmpty ? "border-red-300 bg-red-50/20" : "border-gray-300 focus-within:ring-2 focus-within:ring-[#0db69d]"
          }`}
        >
          {option.values.map((val, valIdx) => (
            <span
              key={valIdx}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-[#0db69d] text-white rounded-lg shadow-2xs border border-[#0a9984]"
            >
              {isColorOption && <ColorSwatchIcon colorName={val} size="sm" />}
              <span>{val}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onRemoveValue(index, valIdx)}
                  className="text-teal-100 hover:text-white p-0.5 ml-0.5 cursor-pointer flex items-center justify-center"
                  title="Remove value"
                >
                  <span className="w-2.5 h-2.5 flex items-center"><Icon source={XIcon} tone="inherit" /></span>
                </button>
              )}
            </span>
          ))}

          <input
            type="text"
            placeholder={
              option.values.length === 0
                ? isColorOption
                  ? "Type custom color e.g. Navy, Rose gold, Midnight Teal & press Enter"
                  : "Type custom value e.g. 10Y, 500ml & press Enter"
                : "Add custom value..."
            }
            value={newValueInput}
            onChange={(e) => setNewValueInput(e.target.value)}
            onKeyDown={handleKeyDownValue}
            disabled={disabled}
            className="flex-1 min-w-[180px] bg-transparent text-xs sm:text-sm font-semibold focus:outline-none px-1 py-0.5 text-gray-900 placeholder:text-gray-400"
          />

          {newValueInput.trim() && (
            <button
              type="button"
              onClick={handleAddValueClick}
              disabled={disabled}
              className="px-3 py-1 text-xs font-bold bg-[#0db69d] text-white rounded-md hover:bg-[#0a9984] cursor-pointer"
            >
              + Add
            </button>
          )}
        </div>

        {isValuesEmpty && (
          <p className="mt-1 text-xs text-red-600 font-semibold flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>Option value is required.</span>
          </p>
        )}
      </div>

      {/* QUICK PRE-DEFINED VALUES LIST / COLOR GRID */}
      {matchedFamily && matchedFamily.suggestedValues.length > 0 && (
        <div className="p-3.5 bg-teal-50/60 border border-teal-100 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#0f766e] flex items-center gap-1.5">
              {isColorOption ? (
                <svg className="w-3.5 h-3.5 text-[#0db69d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-[#0db69d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
              <span>Quick Pre-defined {matchedFamily.name} Values</span>
            </span>
            {isColorOption ? (
              <button
                type="button"
                onClick={() => setIsColorModalOpen(true)}
                disabled={disabled}
                className="text-2xs font-extrabold text-[#0db69d] hover:underline"
              >
                View All Colors Modal →
              </button>
            ) : (
              <span className="text-2xs text-[#0f766e] font-medium">Click any value to toggle</span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
            {matchedFamily.suggestedValues.map((val) => {
              const isSelected = option.values.includes(val);
              return (
                <button
                  key={val}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleToggleColorValue(val)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer shadow-2xs ${
                    isSelected
                      ? "bg-[#0db69d] text-white border-[#0db69d]"
                      : "bg-white text-gray-800 border-teal-200 hover:bg-teal-100 hover:border-teal-300"
                  }`}
                >
                  {isColorOption && <ColorSwatchIcon colorName={val} size="sm" />}
                  <span>
                    {isSelected ? (
                      <svg className="w-3 h-3 text-white inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                    ) : "+ "}
                    {val}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Color Picker Modal */}
      {isColorOption && (
        <ColorPickerModal
          isOpen={isColorModalOpen}
          onClose={() => setIsColorModalOpen(false)}
          selectedValues={option.values}
          onToggleValue={handleToggleColorValue}
          onAddCustomColor={handleAddCustomColor}
          onSelectMultiple={handleSelectMultipleColors}
        />
      )}
    </div>
  );
}
