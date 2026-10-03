"use client";
import React, { useState } from "react";
import { Icon } from "@shopify/polaris";
import { XIcon } from "@shopify/polaris-icons";
import { MASTER_ATTRIBUTE_FAMILIES, AttributeFamily } from "@/lib/constants/variant-library";

interface AttributeLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAttribute: (family: AttributeFamily) => void;
}

export function AttributeLibraryModal({ isOpen, onClose, onSelectAttribute }: AttributeLibraryModalProps) {
  const [searchTerm, setSearchTerm] = useState("");

  if (!isOpen) return null;

  const filteredFamilies = MASTER_ATTRIBUTE_FAMILIES.filter(
    (f) =>
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-teal-50/50">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#0db69d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>Master Variant Attribute Library</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Browse standard fashion attribute families for 0M to 18Y & Adult
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-md cursor-pointer flex items-center justify-center"
            title="Close"
          >
            <span className="w-4 h-4 flex items-center"><Icon source={XIcon} tone="subdued" /></span>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100 bg-white">
          <input
            type="text"
            placeholder="Search attributes e.g. Age, Size, Shoe Size, Color, Waist..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0db69d] focus:border-[#0db69d]"
          />
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {filteredFamilies.map((family) => (
            <div
              key={family.id}
              className="p-3.5 border border-gray-200 rounded-xl hover:border-[#0db69d] hover:bg-teal-50/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#0db69d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h10M7 12h10m-7 5h7" />
                  </svg>
                  <h4 className="text-sm font-bold text-gray-900">{family.name}</h4>
                </div>
                <p className="text-xs text-gray-500 mt-1">{family.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {family.suggestedValues.slice(0, 8).map((val) => (
                    <span
                      key={val}
                      className="px-2 py-0.5 text-2xs font-medium bg-gray-100 text-gray-700 rounded-md"
                    >
                      {val}
                    </span>
                  ))}
                  {family.suggestedValues.length > 8 && (
                    <span className="px-2 py-0.5 text-2xs text-gray-400 font-medium">
                      +{family.suggestedValues.length - 8} more
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onSelectAttribute(family);
                  onClose();
                }}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0db69d] text-white hover:bg-[#0a9984] transition-colors shrink-0 shadow-2xs cursor-pointer"
              >
                Use Attribute
              </button>
            </div>
          ))}

          {filteredFamilies.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-500">
              No matching attribute families found.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
