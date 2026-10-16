"use client";
import React, { useState, useRef, useEffect } from "react";
import { Icon } from "@shopify/polaris";
import { CheckIcon } from "@shopify/polaris-icons";
import { VariantOptionInput } from "@/services/sku/variant-combinations";
import { VariantOptionRow } from "./VariantOptionRow";
import { AttributeLibraryModal } from "./AttributeLibraryModal";
import { MASTER_ATTRIBUTE_FAMILIES, AttributeFamily } from "@/lib/constants/variant-library";

interface VariantOptionSelectorProps {
  options: VariantOptionInput[];
  setOptions: React.Dispatch<React.SetStateAction<VariantOptionInput[]>>;
  disabled?: boolean;
}

export function VariantOptionSelector({ options, setOptions, disabled }: VariantOptionSelectorProps) {
  const [activeAnchor, setActiveAnchor] = useState<"top" | "bottom" | null>(null);
  const [menuSearchTerm, setMenuSearchTerm] = useState("");
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const topMenuRef = useRef<HTMLDivElement>(null);
  const bottomMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const clickedTop = topMenuRef.current && topMenuRef.current.contains(target);
      const clickedBottom = bottomMenuRef.current && bottomMenuRef.current.contains(target);
      if (!clickedTop && !clickedBottom) {
        setActiveAnchor(null);
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

  const handleSelectAttribute = (family: AttributeFamily) => {
    const existingIndex = options.findIndex(
      (o) => o.name.toLowerCase() === family.name.toLowerCase()
    );

    if (existingIndex >= 0) {
      setActiveAnchor(null);
      setMenuSearchTerm("");
      return;
    }

    setOptions((prev) => [
      ...prev,
      {
        name: family.name,
        values: [],
      },
    ]);
    setActiveAnchor(null);
    setMenuSearchTerm("");
  };

  const handleAddCustomOption = (customName?: string) => {
    const name =
      typeof customName === "string" && customName.trim().length > 0
        ? customName.trim()
        : `Custom Option ${options.length + 1}`;
    setOptions((prev) => [...prev, { name, values: [] }]);
    setActiveAnchor(null);
    setMenuSearchTerm("");
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const term = menuSearchTerm.trim();
      if (!term) return;

      if (filteredFamilies.length > 0) {
        handleSelectAttribute(filteredFamilies[0]);
      } else {
        handleAddCustomOption(term);
      }
    } else if (e.key === "Escape") {
      setActiveAnchor(null);
    }
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

  const renderDropdownMenu = (isBottom: boolean) => (
    <div
      className={`absolute ${
        isBottom
          ? "bottom-full mb-2 left-0 right-0 sm:left-auto sm:right-0"
          : "top-full mt-2 right-0"
      } z-50 bg-white border border-gray-200 rounded-2xl shadow-2xl w-full sm:w-[420px] max-h-[480px] overflow-hidden flex flex-col divide-y divide-gray-100 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150`}
    >
      {/* Header */}
      <div className="p-3.5 bg-teal-50/80 border-b border-teal-100 flex items-center justify-between">
        <span className="text-xs font-extrabold text-[#0f766e] uppercase tracking-wider">
          Select Variant Option
        </span>
        <button
          type="button"
          onClick={() => {
            setActiveAnchor(null);
            setIsLibraryOpen(true);
          }}
          className="text-xs font-extrabold text-[#0db69d] hover:underline"
        >
          View All Library →
        </button>
      </div>

      {/* Search Input & Dynamic Action */}
      <div className="p-3 bg-white space-y-2">
        <div className="relative">
          <input
            autoFocus
            type="text"
            placeholder="Type e.g. Fit, Color, Size & press Enter"
            value={menuSearchTerm}
            onChange={(e) => setMenuSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-full px-3 py-2 text-xs sm:text-sm font-semibold border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0db69d] focus:border-[#0db69d]"
          />
          {menuSearchTerm && (
            <button
              type="button"
              onClick={() => setMenuSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Dynamic Add / Custom Option Button */}
        <button
          type="button"
          onClick={() => {
            if (filteredFamilies.length > 0 && menuSearchTerm.trim()) {
              handleSelectAttribute(filteredFamilies[0]);
            } else {
              handleAddCustomOption(menuSearchTerm.trim());
            }
          }}
          className="w-full py-2 px-3 text-xs font-extrabold text-white bg-[#0db69d] hover:bg-[#0a9984] rounded-xl flex items-center justify-center gap-2 shadow-2xs cursor-pointer transition-all"
        >
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>
            {menuSearchTerm.trim()
              ? filteredFamilies.length > 0
                ? `Add "${filteredFamilies[0].name}" (Press Enter)`
                : `Create Custom Option "${menuSearchTerm.trim()}" (Press Enter)`
              : "Create Custom Option"}
          </span>
        </button>
      </div>

      {/* Option Families List */}
      <div className="p-2 space-y-1 overflow-y-auto flex-1 max-h-64">
        {filteredFamilies.map((family) => {
          const isAdded = options.some(
            (o) => o.name.toLowerCase() === family.name.toLowerCase()
          );
          return (
            <button
              key={family.id}
              type="button"
              onClick={() => handleSelectAttribute(family)}
              className={`w-full text-left px-3.5 py-2.5 text-xs sm:text-sm rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                isAdded
                  ? "bg-teal-50 text-[#0db69d] font-bold"
                  : "hover:bg-teal-50/80 text-gray-900 font-semibold"
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
            No predefined option matches &quot;{menuSearchTerm}&quot;. Press <strong>Enter</strong> to create it as a custom option.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Main Options Card Container */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xs p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-gray-900 m-0">Variants</h3>
            <p className="text-xs text-gray-500 m-0">
              Select Color, Size, Fit, Material or Custom options to generate combinations.
            </p>
          </div>

          {/* TOP + ADD VARIANT BUTTON WITH DROPDOWN */}
          <div className="relative" ref={topMenuRef}>
            <button
              type="button"
              onClick={() => {
                setActiveAnchor(activeAnchor === "top" ? null : "top");
                setMenuSearchTerm("");
              }}
              disabled={disabled}
              className="px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white bg-[#0db69d] hover:bg-[#0a9984] rounded-xl transition-all shadow-2xs disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              <span className="text-lg font-bold">+</span>
              <span>Add Variant</span>
              <span className="text-xs">▾</span>
            </button>

            {activeAnchor === "top" && renderDropdownMenu(false)}
          </div>
        </div>

        {/* OPTION CARDS LIST */}
        {options.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 border border-dashed border-gray-300 rounded-xl space-y-3">
            <p className="text-xs sm:text-sm text-gray-600 font-bold">No variants configured for this product.</p>
            <p className="text-2xs text-gray-400">Click &quot;+ Add Variant&quot; above to add Color, Size, Fit, or custom options.</p>
            <button
              type="button"
              onClick={() => {
                setActiveAnchor("top");
                setMenuSearchTerm("");
              }}
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

        {/* BOTTOM ADD VARIANT BUTTON WITH ANCHORED DROPDOWN */}
        {options.length > 0 && (
          <div className="pt-2 relative" ref={bottomMenuRef}>
            <button
              type="button"
              onClick={() => {
                setActiveAnchor(activeAnchor === "bottom" ? null : "bottom");
                setMenuSearchTerm("");
              }}
              disabled={disabled}
              className="w-full py-3 px-4 text-xs sm:text-sm font-bold text-[#0db69d] bg-teal-50/60 hover:bg-teal-50 border border-dashed border-teal-300 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span className="text-base font-extrabold">+</span> Add Another Variant
            </button>

            {activeAnchor === "bottom" && renderDropdownMenu(true)}
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
