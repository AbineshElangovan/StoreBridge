import React from "react";

interface PriceChangeDisplayProps {
  currentPrice: number;
  adjustedPrice: number;
  adjustmentText?: string;
  compact?: boolean;
}

export function PriceChangeDisplay({
  currentPrice,
  adjustedPrice,
  adjustmentText,
  compact = false,
}: PriceChangeDisplayProps) {
  const formatPrice = (val: number) =>
    `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const isIncreased = adjustedPrice > currentPrice;
  const isDecreased = adjustedPrice < currentPrice;

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${compact ? "text-xs" : "text-xs sm:text-sm"}`}>
      <span className="font-semibold text-gray-500 line-through">
        {formatPrice(currentPrice)}
      </span>
      <span className="text-gray-400 font-bold">→</span>
      <span className="font-extrabold text-gray-900">
        {formatPrice(adjustedPrice)}
      </span>
      {adjustmentText && (
        <span
          className={`px-1.5 py-0.5 text-2xs font-extrabold rounded-md ${
            isIncreased
              ? "bg-green-100 text-green-800 border border-green-200"
              : isDecreased
              ? "bg-red-100 text-red-800 border border-red-200"
              : "bg-gray-100 text-gray-700 border border-gray-200"
          }`}
        >
          {adjustmentText}
        </span>
      )}
    </div>
  );
}
