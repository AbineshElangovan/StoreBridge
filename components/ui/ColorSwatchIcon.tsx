"use client";
import React from "react";
import { getColorMetadata } from "@/lib/constants/color-library";

interface ColorSwatchIconProps {
  colorName: string;
  hex?: string;
  customHex?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ColorSwatchIcon({
  colorName,
  hex,
  customHex,
  size = "md",
  className = "",
}: ColorSwatchIconProps) {
  const meta = getColorMetadata(colorName);
  const activeHex = customHex || hex || meta.hex;
  const isPattern = meta.isPattern;
  const patternType = meta.patternType;

  // Size mapping
  const dimensions =
    size === "sm"
      ? "w-4 h-4 rounded-md"
      : size === "lg"
      ? "w-7 h-7 rounded-xl"
      : "w-5 h-5 rounded-lg";

  const sizePx = size === "sm" ? 16 : size === "lg" ? 28 : 20;

  // If pattern, render pattern specific SVGs / gradients
  if (isPattern || patternType) {
    if (patternType === "clear") {
      return (
        <div
          className={`${dimensions} border border-gray-300 bg-white relative overflow-hidden shrink-0 shadow-2xs ${className}`}
          title={colorName}
        >
          <div className="absolute inset-0 bg-[linear-gradient(45deg,#ef4444_10%,transparent_10%,transparent_50%,#ef4444_50%,#ef4444_60%,transparent_60%)] opacity-30" />
        </div>
      );
    }

    if (patternType === "rainbow" || colorName.toLowerCase() === "rainbow") {
      return (
        <div
          className={`${dimensions} border border-gray-200 shrink-0 shadow-2xs bg-gradient-to-r from-red-500 via-yellow-400 via-green-500 via-blue-500 to-purple-500 ${className}`}
          title={colorName}
        />
      );
    }

    if (patternType === "multicolor" || colorName.toLowerCase() === "multicolor") {
      return (
        <div
          className={`${dimensions} border border-gray-200 shrink-0 shadow-2xs grid grid-cols-2 grid-rows-2 overflow-hidden ${className}`}
          title={colorName}
        >
          <span className="bg-red-500" />
          <span className="bg-blue-500" />
          <span className="bg-yellow-400" />
          <span className="bg-green-500" />
        </div>
      );
    }

    if (patternType === "checkered" || colorName.toLowerCase() === "checkered") {
      return (
        <div
          className={`${dimensions} border border-gray-300 shrink-0 shadow-2xs bg-[conic-gradient(#000_90deg,#fff_90deg_180deg,#000_180deg_270deg,#fff_270deg)] bg-[size:8px_8px] ${className}`}
          title={colorName}
        />
      );
    }

    if (patternType === "striped" || colorName.toLowerCase() === "striped") {
      return (
        <div
          className={`${dimensions} border border-gray-300 shrink-0 shadow-2xs bg-[repeating-linear-gradient(45deg,#000,#000_3px,#fff_3px,#fff_6px)] ${className}`}
          title={colorName}
        />
      );
    }

    if (patternType === "dots" || colorName.toLowerCase() === "dots") {
      return (
        <div
          className={`${dimensions} border border-gray-300 shrink-0 shadow-2xs bg-slate-100 bg-[radial-gradient(#000_1.5px,transparent_1.5px)] bg-[size:6px_6px] ${className}`}
          title={colorName}
        />
      );
    }

    // Default icon fallback for Animal, Camouflage, Floral, Plaid, Geometric patterns
    return (
      <div
        className={`${dimensions} border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0 shadow-2xs text-gray-500 ${className}`}
        title={colorName}
      >
        <svg
          className="w-3/5 h-3/5 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  // Solid Hex Colors
  const isWhiteOrLight =
    !activeHex ||
    activeHex.toUpperCase() === "#FFFFFF" ||
    activeHex.toUpperCase() === "#FFF" ||
    activeHex.toUpperCase() === "#F5F5DC" ||
    activeHex.toUpperCase() === "#E6E6FA";

  return (
    <div
      className={`${dimensions} shrink-0 shadow-2xs transition-transform ${
        isWhiteOrLight ? "border border-gray-300" : "border border-black/10"
      } ${className}`}
      style={{ backgroundColor: activeHex || "#94A3B8" }}
      title={`${colorName} ${activeHex ? `(${activeHex})` : ""}`}
    />
  );
}
