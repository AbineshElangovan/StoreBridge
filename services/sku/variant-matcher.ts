import { GeneratedCombination } from "./variant-combinations";

export interface ExistingVariantRecord {
  id: string;
  shopifyVariantId: string;
  sku: string | null;
  title: string;
  price: number;
  inventoryQuantity: number;
  optionsJson?: any;
}

export interface MatchedCombination extends GeneratedCombination {
  status: "Existing" | "New";
  existingVariantId?: string;
  existingSku?: string;
  price?: number;
  inventoryQuantity?: number;
}

/**
 * Normalizes a variant title (e.g., "Red / S / 10Y" or "Red / S") into a standardized matching key.
 */
export function normalizeTitleToKey(title: string): string {
  if (!title) return "";
  return title
    .split("/")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join("/");
}

export function extractVariantSize(options: Record<string, string>, title: string): string | null {
  for (const [k, v] of Object.entries(options || {})) {
    if (k.toLowerCase().includes("size")) {
      return String(v).trim().toLowerCase();
    }
  }
  const parts = title.split(/[\/\-\s]+/).map((p) => p.trim().toLowerCase());
  for (const p of parts) {
    if (/^(xs|s|m|l|xl|xxl|2xl|3xl|4xl|[0-9]{1,3}[a-z]?)$/i.test(p)) {
      return p;
    }
  }
  return null;
}

/**
 * Compares generated Cartesian combinations against existing database product variants.
 * Intelligently preserves existing stock count when renaming attributes (e.g. Color Blue -> Black),
 * while cleanly defaulting truly new variants (e.g. adding Size M to existing L, XL) to 0.
 */
export function matchCombinationsWithExisting(
  combinations: GeneratedCombination[],
  existingVariants: ExistingVariantRecord[]
): MatchedCombination[] {
  const usedExistingIds = new Set<string>();
  const results: (MatchedCombination | null)[] = new Array(combinations.length).fill(null);

  // Exact maps for titles and SKUs
  const existingByTitle = new Map<string, ExistingVariantRecord>();
  const existingBySku = new Map<string, ExistingVariantRecord>();

  for (const v of existingVariants) {
    const keyTitle = normalizeTitleToKey(v.title);
    if (keyTitle) existingByTitle.set(keyTitle, v);
    if (v.sku) existingBySku.set(v.sku.trim().toLowerCase(), v);
  }

  // Pass 1: Exact Title matches
  combinations.forEach((combo, idx) => {
    const titleKey = normalizeTitleToKey(combo.title);
    const matched = existingByTitle.get(titleKey);
    if (matched && !usedExistingIds.has(matched.id)) {
      usedExistingIds.add(matched.id);
      results[idx] = {
        ...combo,
        status: "Existing",
        existingVariantId: matched.id,
        existingSku: matched.sku || undefined,
        price: matched.price,
        inventoryQuantity: matched.inventoryQuantity,
      };
    }
  });

  const remainingExisting = existingVariants.filter((v) => !usedExistingIds.has(v.id));
  const remainingIndices = combinations.map((_, i) => i).filter((i) => results[i] === null);

  // Pass 2: 1-to-1 Single Variant Replacement
  // (e.g. Single variant renamed from 'Navy' to 'Blue' or 'Default Title' to 'Blue')
  if (remainingExisting.length === 1 && remainingIndices.length === 1) {
    const existing = remainingExisting[0];
    const idx = remainingIndices[0];
    usedExistingIds.add(existing.id);
    results[idx] = {
      ...combinations[idx],
      status: "New",
      existingVariantId: existing.id,
      price: existing.price,
      inventoryQuantity: existing.inventoryQuantity,
    };
  } else if (remainingExisting.length > 0 && remainingIndices.length > 0) {
    // Pass 3: Partial Attribute Matching
    // If Size/Fit matches and Color was changed (e.g. 'L / Navy' -> 'L / Blue'),
    // preserve the stock quantity of that size, but DO NOT reuse the old 'NAVY' SKU!
    for (const idx of remainingIndices) {
      if (results[idx] !== null) continue;
      const combo = combinations[idx];
      const comboOptions = combo.options || {};
      const comboTokens = Object.values(comboOptions).map((v) => String(v).trim().toLowerCase());

      let bestMatch: ExistingVariantRecord | null = null;
      let highestOverlap = 0;
      const comboSize = extractVariantSize(comboOptions, combo.title);

      for (const ex of remainingExisting) {
        if (usedExistingIds.has(ex.id)) continue;

        // If both specify a size and they differ (e.g. combo is 'S' while ex is 'L'), they CANNOT match!
        const exSize = extractVariantSize(ex.optionsJson || {}, ex.title);
        if (comboSize && exSize && comboSize !== exSize) {
          continue;
        }

        let overlap = 0;

        // Check optionsJson if available
        if (ex.optionsJson && typeof ex.optionsJson === "object") {
          for (const [optKey, optVal] of Object.entries(comboOptions)) {
            const exVal = ex.optionsJson[optKey];
            if (exVal && String(exVal).trim().toLowerCase() === String(optVal).trim().toLowerCase()) {
              overlap += 2;
            }
          }
        }

        // Check tokens in title (e.g. "L" in "L / Navy")
        const exTitleParts = ex.title.split(/[\/\-\s]+/).map((p) => p.trim().toLowerCase());
        for (const token of comboTokens) {
          if (exTitleParts.includes(token)) {
            overlap += 1;
          }
        }

        if (overlap > highestOverlap) {
          highestOverlap = overlap;
          bestMatch = ex;
        }
      }

      if (bestMatch && highestOverlap > 0) {
        usedExistingIds.add(bestMatch.id);
        results[idx] = {
          ...combo,
          status: "New",
          existingVariantId: bestMatch.id,
          price: bestMatch.price,
          inventoryQuantity: bestMatch.inventoryQuantity,
        };
      }
    }
  }

  // Pass 4: Truly new variants (e.g. newly added size 'M' when only 'L' and 'XL' existed)
  return combinations.map((combo, idx) => {
    if (results[idx]) return results[idx]!;
    return {
      ...combo,
      status: "New",
      inventoryQuantity: 0,
    };
  });
}
