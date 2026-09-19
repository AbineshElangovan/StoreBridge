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

/**
 * Compares generated Cartesian combinations against existing database product variants.
 */
export function matchCombinationsWithExisting(
  combinations: GeneratedCombination[],
  existingVariants: ExistingVariantRecord[]
): MatchedCombination[] {
  // Build a lookup map of existing variants by title key and by optionsJson if present
  const existingMap = new Map<string, ExistingVariantRecord>();

  for (const variant of existingVariants) {
    const keyByTitle = normalizeTitleToKey(variant.title);
    if (keyByTitle) {
      existingMap.set(keyByTitle, variant);
    }

    if (variant.sku) {
      existingMap.set(`sku:${variant.sku.trim().toLowerCase()}`, variant);
    }
  }

  return combinations.map((combo) => {
    const comboTitleKey = normalizeTitleToKey(combo.title);
    const existing = existingMap.get(comboTitleKey);

    if (existing) {
      return {
        ...combo,
        status: "Existing",
        existingVariantId: existing.id,
        existingSku: existing.sku || undefined,
        price: existing.price,
        inventoryQuantity: existing.inventoryQuantity,
      };
    }

    return {
      ...combo,
      status: "New",
    };
  });
}
