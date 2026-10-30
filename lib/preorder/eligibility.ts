/**
 * Common Pre-order eligibility utility
 *
 * Rules:
 * 1. Pre-order must be enabled in the configuration (enabled === true).
 * 2. Product must be targeted (by selectionMode: ALL_PRODUCTS, SPECIFIC_PRODUCTS, or COLLECTIONS).
 * 3. A variant qualifies ONLY when its inventory is zero or out of stock (<= threshold, default 0).
 * 4. A product qualifies at the product level if at least one variant is eligible for Pre-order.
 * 5. In-stock variants and products with no out-of-stock variants never qualify for Pre-order.
 */

export interface PreorderConfigLike {
  enabled?: boolean | null;
  selectionMode?: string | null;
  selectedProductIds?: string[] | null;
  selectedCollectionIds?: string[] | null;
  inventoryThreshold?: number | null;
}

/**
 * Determine whether a product is targeted by the store pre-order configuration.
 */
export function isProductTargetedByPreorder(
  config: PreorderConfigLike | null | undefined,
  shopifyProductId: string | null | undefined,
  collectionIds: string[] = []
): boolean {
  if (!config || !config.enabled) return false;
  const mode = config.selectionMode || 'ALL_PRODUCTS';
  if (mode === 'ALL_PRODUCTS') {
    return true;
  }
  if (mode === 'SPECIFIC_PRODUCTS') {
    if (!shopifyProductId) return false;
    const cleanPid = shopifyProductId.replace(/^gid:\/\/shopify\/Product\//i, '').trim();
    const selected = (config.selectedProductIds || []).map((id) =>
      id.replace(/^gid:\/\/shopify\/Product\//i, '').trim()
    );
    return selected.includes(cleanPid);
  }
  if (mode === 'COLLECTIONS') {
    if (!collectionIds || collectionIds.length === 0) return false;
    const selectedColls = (config.selectedCollectionIds || []).map((id) =>
      id.replace(/^gid:\/\/shopify\/Collection\//i, '').trim().toLowerCase()
    );
    return collectionIds.some((cid) => {
      const cleanCid = cid.replace(/^gid:\/\/shopify\/Collection\//i, '').trim().toLowerCase();
      return selectedColls.includes(cleanCid);
    });
  }
  return true;
}

/**
 * Check if a single variant is eligible for Pre-order.
 * A variant qualifies only if targeted, enabled, and inventory <= threshold (default 0).
 */
export function isVariantPreorderEligible(
  config: PreorderConfigLike | null | undefined,
  inventoryQuantity: number | null | undefined,
  shopifyProductId?: string | null,
  collectionIds?: string[]
): boolean {
  if (!config || !config.enabled) return false;
  const isTargeted = isProductTargetedByPreorder(config, shopifyProductId, collectionIds);
  if (!isTargeted) return false;
  const threshold = config.inventoryThreshold ?? 0;
  return (inventoryQuantity ?? 0) <= threshold;
}

/**
 * Check if a product is eligible for Pre-order at the product level.
 * Qualifies if targeted, enabled, and at least ONE variant has inventory <= threshold.
 */
export function isProductPreorderEligible(
  config: PreorderConfigLike | null | undefined,
  variants: Array<{ inventoryQuantity?: number | null }>,
  shopifyProductId?: string | null,
  collectionIds?: string[]
): boolean {
  if (!config || !config.enabled) return false;
  const isTargeted = isProductTargetedByPreorder(config, shopifyProductId, collectionIds);
  if (!isTargeted) return false;
  const threshold = config.inventoryThreshold ?? 0;
  return variants.some((v) => (v.inventoryQuantity ?? 0) <= threshold);
}

