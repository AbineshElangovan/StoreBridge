import React from "react";
import { Icon } from "@shopify/polaris";
import { ViewIcon } from "@shopify/polaris-icons";
import { useTheme } from "@/components/providers/ThemeContext";

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
  const { currentTheme } = useTheme();
  const primaryColor = currentTheme?.primaryColor || '#047857';
  const accentColor = currentTheme?.accentColor || '#d1fae5';
  const darkColor = currentTheme?.darkColor || '#022c22';
  const borderColor = currentTheme?.navbarBorder || '#34d399';

  return (
    <div
      className="p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 shadow-2xs transition-colors"
      style={{
        backgroundColor: `${accentColor}30`,
        borderColor: `${borderColor}70`,
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-lg text-white flex items-center justify-center font-extrabold text-xs shadow-2xs"
          style={{ backgroundColor: primaryColor }}
        >
          <div style={{ width: 16, height: 16 }} className="text-white fill-white [&_svg]:fill-white">
            <Icon source={ViewIcon} tone="inherit" />
          </div>
        </div>
        <div>
          <h4 className="text-xs font-extrabold m-0" style={{ color: darkColor }}>
            Affected Products Preview
          </h4>
          <p className="text-2xs font-medium m-0" style={{ color: primaryColor }}>
            Representative sample before applying price adjustment
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="px-2.5 py-1 text-2xs font-extrabold bg-white border rounded-md shadow-2xs"
          style={{ color: darkColor, borderColor: `${borderColor}80` }}
        >
          Selected Collections: <strong style={{ color: primaryColor }}>{totalCollections}</strong>
        </span>
        <span
          className="px-2.5 py-1 text-2xs font-extrabold bg-white border rounded-md shadow-2xs"
          style={{ color: darkColor, borderColor: `${borderColor}80` }}
        >
          Total Products Affected: <strong style={{ color: primaryColor }}>{totalAffectedProducts}</strong>
        </span>
      </div>
    </div>
  );
}
