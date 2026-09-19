"use client";
import React, { useState } from "react";
import { PREDEFINED_COLORS, ColorItem } from "@/lib/constants/color-library";
import { ColorSwatchIcon } from "@/components/ui/ColorSwatchIcon";

interface ColorPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedValues: string[];
  onToggleValue: (colorName: string) => void;
  onAddCustomColor: (colorName: string, hex?: string) => void;
  onSelectMultiple: (colors: string[]) => void;
}

export function ColorPickerModal({
  isOpen,
  onClose,
  selectedValues,
  onToggleValue,
  onAddCustomColor,
  onSelectMultiple,
}: ColorPickerModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [customName, setCustomName] = useState("");
  const [customHex, setCustomHex] = useState("#0db69d");

  if (!isOpen) return null;

  const filteredColors = PREDEFINED_COLORS.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categories: ("Standard" | "Default entries" | "Patterns & Prints")[] = [
    "Standard",
    "Default entries",
    "Patterns & Prints",
  ];

  const handleCreateCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customName.trim();
    if (!trimmed) return;

    onAddCustomColor(trimmed, customHex);
    setCustomName("");
  };

  const handleSelectAllStandard = () => {
    const standardNames = PREDEFINED_COLORS.filter((c) => c.category === "Standard").map((c) => c.name);
    const combined = Array.from(new Set([...selectedValues, ...standardNames]));
    onSelectMultiple(combined);
  };

  const handleClearAll = () => {
    onSelectMultiple([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col border border-gray-200 overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-teal-50/50">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#0db69d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              <span>Color & Pattern Selector</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">
              Select pre-defined colors, patterns, or type custom color combinations.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3.5 border-b border-gray-100 bg-white flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Filter colors e.g. Rose, Gold, Blue, Camo, Striped..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0db69d] focus:border-[#0db69d]"
            />
            <svg
              className="w-4 h-4 text-gray-400 absolute left-3 top-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleSelectAllStandard}
              className="px-2.5 py-1.5 text-2xs font-extrabold text-[#0db69d] bg-teal-50 hover:bg-teal-100 rounded-lg cursor-pointer transition-colors"
            >
              Select Top
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="px-2.5 py-1.5 text-2xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-100 rounded-lg cursor-pointer transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Custom Color Creator Banner */}
        <form onSubmit={handleCreateCustom} className="p-3 bg-teal-50/40 border-b border-teal-100 flex items-center gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              type="color"
              value={customHex}
              onChange={(e) => setCustomHex(e.target.value)}
              className="w-8 h-8 rounded-lg cursor-pointer border border-gray-300 p-0.5 bg-white"
              title="Pick Hex Color"
            />
          </div>
          <input
            type="text"
            placeholder="Type custom color name e.g. Midnight Teal, Sunset Amber..."
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="flex-1 px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0db69d] bg-white"
          />
          <button
            type="submit"
            disabled={!customName.trim()}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#0db69d] hover:bg-[#0a9984] rounded-lg transition-colors cursor-pointer disabled:opacity-40 shrink-0"
          >
            + Add Custom
          </button>
        </form>

        {/* Colors & Patterns Scrollable List */}
        <div className="p-4 overflow-y-auto space-y-5 flex-1 max-h-[50vh]">
          {categories.map((cat) => {
            const group = filteredColors.filter((c) => c.category === cat);
            if (group.length === 0) return null;

            return (
              <div key={cat} className="space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                  <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">
                    {cat}
                  </h3>
                  <span className="text-2xs font-mono text-gray-400">
                    {group.length} options
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {group.map((color) => {
                    const isChecked = selectedValues.includes(color.name);
                    return (
                      <label
                        key={color.name}
                        onClick={() => onToggleValue(color.name)}
                        className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                          isChecked
                            ? "bg-teal-50/70 border-[#0db69d] shadow-2xs"
                            : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Controlled by label onClick
                          className="w-4 h-4 text-[#0db69d] rounded border-gray-300 focus:ring-[#0db69d] cursor-pointer"
                        />
                        <ColorSwatchIcon colorName={color.name} hex={color.hex} size="md" />
                        <span className={`text-xs ${isChecked ? "font-extrabold text-gray-900" : "font-semibold text-gray-700"}`}>
                          {color.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Render any Custom Selected Values that are not in predefined list */}
          {selectedValues.some((val) => !PREDEFINED_COLORS.some((c) => c.name.toLowerCase() === val.toLowerCase())) && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <h3 className="text-xs font-extrabold text-teal-700 uppercase tracking-wider">
                Custom User Colors
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {selectedValues
                  .filter((val) => !PREDEFINED_COLORS.some((c) => c.name.toLowerCase() === val.toLowerCase()))
                  .map((customVal) => (
                    <label
                      key={customVal}
                      onClick={() => onToggleValue(customVal)}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-teal-300 bg-teal-50/80 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={true}
                          onChange={() => {}}
                          className="w-4 h-4 text-[#0db69d] rounded border-gray-300 cursor-pointer"
                        />
                        <ColorSwatchIcon colorName={customVal} size="md" />
                        <span className="text-xs font-extrabold text-gray-900">{customVal}</span>
                      </div>
                      <span className="text-2xs font-semibold text-teal-700 bg-white px-2 py-0.5 rounded-md border border-teal-200">
                        Custom
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          )}

          {filteredColors.length === 0 && (
            <div className="text-center py-8 text-xs text-gray-500">
              No matching colors found for &quot;{searchTerm}&quot;. Type custom color name above to add it.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-600">
            Selected: <strong className="text-[#0db69d]">{selectedValues.length}</strong> colors / patterns
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-extrabold text-white bg-[#0db69d] hover:bg-[#0a9984] rounded-xl transition-all shadow-2xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
