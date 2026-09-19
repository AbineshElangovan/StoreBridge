"use client";
import React from "react";
import { PreviewTableItem } from "@/services/sku/sku-preview-service";

interface SkuPreviewTableProps {
  optionNames: string[];
  items: PreviewTableItem[];
  totalCombinations: number;
  existingCount: number;
  newCount: number;
  duplicateSkuCount: number;
}

export function SkuPreviewTable({
  optionNames,
  items,
  totalCombinations,
  existingCount,
  newCount,
  duplicateSkuCount,
}: SkuPreviewTableProps) {
  if (items.length === 0) {
    return (
      <div className="p-8 text-center bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-500">
        No combinations generated yet. Click <strong>Generate Preview</strong> to generate SKU candidates.
      </div>
    );
  }

  const isGlobalFallback = optionNames.length === 0 || Object.keys(items[0]?.options || {}).length === 0;

  return (
    <div className="space-y-4">
      {/* Fallback Notice */}
      {isGlobalFallback && (
        <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl text-xs font-semibold text-[#0f766e] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#0db69d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.6 9h16.8M3.6 15h16.8" />
            </svg>
            <span>Global SKU Format Applied: No variant options configured. Generating standard global product SKU.</span>
          </div>
          <span className="px-2.5 py-0.5 text-2xs font-extrabold bg-[#0db69d] text-white rounded-md">
            Global Default
          </span>
        </div>
      )}

      {/* Metrics Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-center">
          <span className="block text-2xs font-bold text-[#0f766e] uppercase">Total Variants</span>
          <span className="text-lg sm:text-xl font-black text-[#115e59]">{totalCombinations}</span>
        </div>

        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
          <span className="block text-2xs font-bold text-blue-700 uppercase">Existing Variants</span>
          <span className="text-lg sm:text-xl font-black text-blue-900">{existingCount}</span>
        </div>

        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
          <span className="block text-2xs font-bold text-emerald-700 uppercase">New Variants</span>
          <span className="text-lg sm:text-xl font-black text-emerald-900">{newCount}</span>
        </div>

        <div className={`p-3 rounded-xl border text-center ${duplicateSkuCount > 0 ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
          <span className={`block text-2xs font-bold uppercase ${duplicateSkuCount > 0 ? "text-red-700" : "text-gray-500"}`}>SKU Conflicts</span>
          <span className={`text-lg sm:text-xl font-black ${duplicateSkuCount > 0 ? "text-red-700" : "text-gray-700"}`}>{duplicateSkuCount}</span>
        </div>
      </div>

      {/* Dynamic Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-2xs bg-white">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-700 font-bold uppercase tracking-wider">
              <th className="py-3 px-4 text-center">#</th>
              {isGlobalFallback ? (
                <th className="py-3 px-4 text-center">Variant Spec</th>
              ) : (
                optionNames.map((name, i) => (
                  <th key={i} className="py-3 px-4 text-center">{name}</th>
                ))
              )}
              <th className="py-3 px-4 text-center">Generated SKU</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-center">Validation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-medium">
            {items.map((item, idx) => {
              const isDuplicate = item.validationStatus !== "VALID";
              return (
                <tr key={item.id} className={`hover:bg-teal-50/20 transition-colors ${isDuplicate ? "bg-red-50/40" : ""}`}>
                  <td className="py-3 px-4 text-center text-gray-400 font-mono">{idx + 1}</td>
                  {isGlobalFallback ? (
                    <td className="py-3 px-4 text-center font-bold text-[#0f766e]">
                      Global Product SKU (Default)
                    </td>
                  ) : (
                    optionNames.map((name, i) => (
                      <td key={i} className="py-3 px-4 text-center font-semibold text-gray-900">
                        {item.options[name] || "—"}
                      </td>
                    ))
                  )}
                  <td className="py-3 px-4 text-center font-mono font-bold text-[#0db69d]">
                    {item.generatedSku}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-2xs font-bold ${item.status === "Existing" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {item.validationStatus === "VALID" ? (
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-2xs font-bold bg-green-100 text-green-800">
                        Ready
                      </span>
                    ) : (
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-2xs font-bold bg-red-100 text-red-800" title={item.validationMessage}>
                        {item.validationStatus === "DUPLICATE_SKU" ? "Duplicate Request" : "Exists in DB"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
