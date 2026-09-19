import React from "react";
import { Icon } from "@shopify/polaris";
import { ViewIcon } from "@shopify/polaris-icons";

interface AffectedProductSummaryProps {
  totalCollections: number;
  totalAffectedProducts: number;
  shownProductsCount: number;
}

export function AffectedProductSummary({
  totalCollections,
  totalAffectedProducts,
  shownProductsCount,
}: AffectedProductSummaryProps) {
  return (
    <div className="p-3 bg-gradient-to-r from-teal-50 to-indigo-50 border border-teal-100 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-2xs">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-extrabold text-xs shadow-2xs">
          <div style={{ width: 16, height: 16 }}>
            <Icon source={ViewIcon} />
          </div>
        </div>
        <div>
          <h4 className="text-xs font-extrabold text-teal-950 m-0">
            Affected Products Preview
          </h4>
          <p className="text-2xs font-medium text-teal-800 m-0">
            Representative sample before applying price adjustment
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2.5 py-1 text-2xs font-extrabold bg-white text-teal-900 border border-teal-200 rounded-md shadow-2xs">
          Selected Collections: <strong>{totalCollections}</strong>
        </span>
        <span className="px-2.5 py-1 text-2xs font-extrabold bg-white text-indigo-900 border border-indigo-200 rounded-md shadow-2xs">
          Total Products Affected: <strong>{totalAffectedProducts}</strong>
        </span>
      </div>
    </div>
  );
}
