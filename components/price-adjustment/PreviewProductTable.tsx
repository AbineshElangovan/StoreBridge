import React from "react";
import { Table, ColumnConfig } from "@/components/common/Table";
import { PreviewTableRow } from "@/services/price-adjustment/price-adjustment-preview-service";

/** Convert "MENS ACCESSORIES" → "Mens Accessories" */
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

interface PreviewProductTableProps {
  rows: PreviewTableRow[];
  isSaving?: boolean;
}

export function PreviewProductTable({ rows, isSaving }: PreviewProductTableProps) {
  if (!rows || rows.length === 0) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-xl text-center text-xs text-gray-500 font-medium">
        No products available in selected collections to preview.
      </div>
    );
  }

  const columns: ColumnConfig[] = [
    { title: "IMAGE", key: "imageUrl", type: "image", width: "65px", align: "center" },
    { title: "PRODUCT NAME", key: "productTitle", type: "bold", width: "240px", align: "left" },
    { title: "SKU", key: "sku_node", type: "react_node", width: "160px", align: "center" },
    { title: "COLLECTION NAME", key: "collection_node", type: "react_node", width: "170px", align: "center" },
    { title: "OLD PRICE", key: "old_price_node", type: "react_node", align: "right", width: "110px" },
    { title: "PERCENT CHANGE", key: "percent_node", type: "react_node", align: "center", width: "135px" },
    { title: "NEW PRICE", key: "new_price_node", type: "react_node", align: "right", width: "120px" },
  ];

  const formatPrice = (val: number) =>
    `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const items = rows.map((row) => {
    const isIncreased = typeof row.adjustedPrice === 'number' && row.adjustedPrice > row.currentPrice;
    const isDecreased = typeof row.adjustedPrice === 'number' && row.adjustedPrice < row.currentPrice;

    return {
      ...row,
      imageUrl: row.imageUrl || "",
      sku_node: row.sku ? (
        <span className="px-2.5 py-1 font-mono text-xs font-bold bg-gray-100 text-gray-800 border border-gray-200 rounded-md whitespace-nowrap inline-block tracking-wide shadow-2xs">
          {row.sku}
        </span>
      ) : (
        <span className="text-gray-400 italic text-2xs">N/A</span>
      ),
      collection_node: (
        <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md whitespace-nowrap">
          {toTitleCase(row.collectionName)}
        </span>
      ),
      old_price_node: (
        <span className="font-bold text-gray-600 text-xs whitespace-nowrap">
          {formatPrice(row.currentPrice)}
        </span>
      ),
      percent_node: (
        <span
          className={`px-2.5 py-1 text-2xs font-extrabold rounded-md inline-block whitespace-nowrap ${
            isIncreased
              ? "bg-green-100 text-green-800 border border-green-200"
              : isDecreased
              ? "bg-red-100 text-red-800 border border-red-200"
              : "bg-gray-100 text-gray-700 border border-gray-200"
          }`}
        >
          {row.adjustmentText || "0%"}
        </span>
      ),
      new_price_node: isSaving ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-md whitespace-nowrap">
          <div className="w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin shrink-0" />
          Updating...
        </span>
      ) : typeof row.adjustedPrice === 'number' ? (
        <div className="flex flex-col items-end gap-0.5 whitespace-nowrap">
          <span className="font-extrabold text-xs sm:text-sm text-teal-900">
            {formatPrice(row.adjustedPrice)}
          </span>
          {!row.isSaved && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded">
              Draft
            </span>
          )}
        </div>
      ) : (
        <span className="inline-flex items-center px-2.5 py-1 text-2xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-md whitespace-nowrap">
          Pending Save
        </span>
      ),
    };
  });

  return (
    <div className="w-full overflow-x-auto border border-gray-200 rounded-xl bg-white shadow-2xs">
      <Table
        headerColor="#0db69d"
        columns={columns}
        items={items}
        searchable={false}
        filterable={false}
        paginate={false}
      />
    </div>
  );
}
