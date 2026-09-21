"use client";
import React, { useState, useRef, useEffect } from "react";
import { Icon } from "@shopify/polaris";
import { CheckIcon } from "@shopify/polaris-icons";
import { VariantOptionInput } from "@/services/sku/variant-combinations";
import { VariantOptionRow } from "./VariantOptionRow";
import { AttributeLibraryModal } from "./AttributeLibraryModal";
import { CategoryPresetPicker } from "./CategoryPresetPicker";
import { MASTER_ATTRIBUTE_FAMILIES, AttributeFamily, CategoryPreset } from "@/lib/constants/variant-library";

interface VariantOptionSelectorProps {
  options: VariantOptionInput[];
  setOptions: React.Dispatch<React.SetStateAction<VariantOptionInput[]>>;
  disabled?: boolean;
}

export function VariantOptionSelector({ options, setOptions, disabled }: VariantOptionSelectorProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [menuSearchTerm, setMenuSearchTerm] = useState("");
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredFamilies = MASTER_ATTRIBUTE_FAMILIES.filter(
    (f) =>
      f.name.toLowerCase().includes(menuSearchTerm.toLowerCase()) ||
      f.suggestedValues.some((v) => v.toLowerCase().includes(menuSearchTerm.toLowerCase()))
  );

  const handleSelectCategoryPreset = (preset: CategoryPreset) => {
    const newOptions: VariantOptionInput[] = preset.suggestedOptionNames.map((name) => {
      const matchedFamily = MASTER_ATTRIBUTE_FAMILIES.find(
        (f) =>
          f.name.toLowerCase() === name.toLowerCase() ||
          f.id.toLowerCase() === name.toLowerCase() ||
          name.toLowerCase().includes(f.name.toLowerCase()) ||
          f.name.toLowerCase().includes(name.toLowerCase())
      );
      return {
        name,
        values: matchedFamily ? matchedFamily.suggestedValues.slice(0, 3) : [],
      };
    });
    setOptions(newOptions);
  };

  const handleSelectAttribute = (family: AttributeFamily) => {
    const existingIndex = options.findIndex(
      (o) => o.name.toLowerCase() === family.name.toLowerCase()
    );

    if (existingIndex >= 0) {
      setOptions((prev) => {
        const next = [...prev];
        const merged = Array.from(new Set([...next[existingIndex].values, ...family.suggestedValues.slice(0, 4)]));
        next[existingIndex] = { ...next[existingIndex], values: merged };
        return next;
      });
    } else {
      setOptions((prev) => [
        ...prev,
        {
          name: family.name,
          values: family.suggestedValues.slice(0, 3),
        },
      ]);
    }
    setShowAddMenu(false);
    setMenuSearchTerm("");
  };

  const handleAddCustomOption = () => {
    setOptions((prev) => [
      ...prev,
      { name: `Custom Option ${prev.length + 1}`, values: [] },
    ]);
    setShowAddMenu(false);
    setMenuSearchTerm("");
  };

  const handleChangeOptionName = (index: number, newName: string) => {
    setOptions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], name: newName };
      return next;
    });
  };

  const handleAddValue = (index: number, val: string) => {
    setOptions((prev) => {
      const next = [...prev];
      const currentValues = next[index].values || [];
      if (!currentValues.includes(val)) {
        next[index] = { ...next[index], values: [...currentValues, val] };
      }
      return next;
    });
  };

  const handleRemoveValue = (index: number, valIndex: number) => {
    setOptions((prev) => {
      const next = [...prev];
      const currentValues = next[index].values || [];
      next[index] = {
        ...next[index],
        values: currentValues.filter((_, idx) => idx !== valIndex),
      };
      return next;
    });
  };

  const handleSetValues = (index: number, newValues: string[]) => {
    setOptions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], values: newValues };
      return next;
    });
  };

  const handleRemoveOption = (index: number) => {
    setOptions((prev) => prev.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-4">
      {/* Category-Aware Presets Quick Picker */}
      <CategoryPresetPicker
        onSelectCategory={handleSelectCategoryPreset}
        disabled={disabled}
      />

      {/* Main Options Card Container */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xs p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-gray-900 m-0">Variants</h3>
            <p className="text-xs text-gray-500 m-0">
              Click &quot;+ Add Variant&quot; to select Color, Size, Age, Shoe Size, Waist, Material or Custom options.
            </p>
          </div>

          {/* PRIMARY + ADD VARIANT BUTTON WITH ENLARGED DROPDOWN */}
          <div className="relative" ref={addMenuRef}>
            <button
              type="button"
              onClick={() => setShowAddMenu(!showAddMenu)}
              disabled={disabled}
              className="px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white bg-[#0db69d] hover:bg-[#0a9984] rounded-xl transition-all shadow-2xs disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              <span className="text-lg font-bold">+</span>
              <span>Add Variant</span>
              <span className="text-xs">▾</span>
            </button>

            {/* ENLARGED INTERACTIVE VARIANT SELECTION MENU */}
            {showAddMenu && (
              <div className="absolute right-0 top-full mt-2 z-40 bg-white border border-gray-200 rounded-2xl shadow-2xl w-80 sm:w-[420px] max-h-[480px] overflow-hidden flex flex-col divide-y divide-gray-100">
                {/* Header */}
                <div className="p-3.5 bg-teal-50/80 border-b border-teal-100 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#0f766e] uppercase tracking-wider">
                    Select Variant Option
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMenu(false);
                      setIsLibraryOpen(true);
                    }}
                    className="text-xs font-extrabold text-[#0db69d] hover:underline"
                  >
                    View All Library →
                  </button>
                </div>

                {/* Filter & Custom Option Banner */}
                <div className="p-3 bg-white space-y-2">
                  <input
                    type="text"
                    placeholder="Search option e.g. Color, Size, Age, Shoe..."
                    value={menuSearchTerm}
                    onChange={(e) => setMenuSearchTerm(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0db69d]"
                  />

                  {/* PROMINENT TOP CREATE CUSTOM OPTION BUTTON */}
                  <button
                    type="button"
                    onClick={handleAddCustomOption}
                    className="w-full py-2.5 px-3 text-xs font-extrabold text-white bg-[#0db69d] hover:bg-[#0a9984] rounded-xl flex items-center justify-center gap-2 shadow-2xs cursor-pointer transition-all"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Create Custom Option</span>
                  </button>
                </div>

                {/* Option Families List */}
                <div className="p-2 space-y-1 overflow-y-auto flex-1 max-h-72">
                  {filteredFamilies.map((family) => {
                    const isAdded = options.some(
                      (o) => o.name.toLowerCase() === family.name.toLowerCase()
                    );
                    return (
                      <button
                        key={family.id}
                        type="button"
                        onClick={() => handleSelectAttribute(family)}
                        className={`w-full text-left px-3.5 py-2.5 text-xs sm:text-sm rounded-xl flex items-center justify-between transition-colors ${
                          isAdded
                            ? "bg-teal-50 text-[#0db69d] font-bold"
                            : "hover:bg-teal-50 text-gray-900 font-semibold"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <svg className="w-4 h-4 text-[#0db69d] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h10M7 12h10m-7 5h7" />
                          </svg>
                          <span className="font-extrabold">{family.name}</span>
                        </div>
                        {isAdded ? (
                          <span className="text-xs font-bold text-[#0db69d] flex items-center gap-1">
                            <div style={{ width: 14, height: 14 }}>
                              <Icon source={CheckIcon} tone="success" />
                            </div>
                            Added
                          </span>
                        ) : (
                          <span className="text-2xs text-gray-400 font-mono">
                            {family.suggestedValues.length} values
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {filteredFamilies.length === 0 && (
                    <div className="p-4 text-xs text-gray-500 text-center">
                      No matching predefined option found. Click <strong>Create Custom Option</strong> above to add it.
                    </div>
                  )}
                </div>

                {/* Footer Custom Option Button */}
                <div className="p-2.5 bg-gray-50 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleAddCustomOption}
                    className="w-full text-left px-3 py-2 text-xs font-extrabold text-[#0db69d] hover:bg-teal-50 rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <svg className="w-4 h-4 text-[#0db69d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Create Custom Option</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* OPTION CARDS LIST */}
        {options.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 border border-dashed border-gray-300 rounded-xl space-y-3">
            <p className="text-xs sm:text-sm text-gray-600 font-bold">No variants configured for this product.</p>
            <p className="text-2xs text-gray-400">Click &quot;+ Add Variant&quot; above or select a Category-Aware Preset to quick-load option templates.</p>
            <button
              type="button"
              onClick={() => setShowAddMenu(true)}
              disabled={disabled}
              className="px-5 py-2.5 text-xs font-extrabold text-white bg-[#0db69d] hover:bg-[#0a9984] rounded-xl transition-colors cursor-pointer shadow-2xs"
            >
              + Add Variant
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {options.map((opt, idx) => (
              <VariantOptionRow
                key={idx}
                index={idx}
                option={opt}
                onChangeOptionName={handleChangeOptionName}
                onAddValue={handleAddValue}
                onRemoveValue={handleRemoveValue}
                onRemoveOption={handleRemoveOption}
                onSetValues={handleSetValues}
                disabled={disabled}
              />
            ))}
          </div>
        )}

        {/* BOTTOM ADD VARIANT BUTTON */}
        {options.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAddMenu(true)}
              disabled={disabled}
              className="w-full py-3 px-4 text-xs sm:text-sm font-bold text-[#0db69d] bg-teal-50/60 hover:bg-teal-50 border border-dashed border-teal-300 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span className="text-base font-extrabold">+</span> Add Another Variant
            </button>
          </div>
        )}
      </div>

      {/* Universal Attribute Library Modal */}
      <AttributeLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onSelectAttribute={handleSelectAttribute}
      />
    </div>
  );
}
