import { prisma } from "@/lib/db/prisma";

export interface PreviewAdjustmentInput {
  collectionId: string;
  enabled: boolean;
  adjustmentType?: "PERCENTAGE" | "FIXED";
  adjustmentValue?: string | number;
}

export interface PreviewTableRow {
  productId: string;
  shopifyProductId: string;
  imageUrl: string | null;
  productTitle: string;
  sku: string | null;
  collectionName: string;
  storeName?: string;
  currentPrice: number;
  isSaved?: boolean;
  adjustedPrice: number | null;
  adjustmentText: string;
}

export interface PriceAdjustmentPreviewResponse {
  success: boolean;
  totalSelectedCollections: number;
  totalAffectedProducts: number;
  previewLimit: number;
  tableRows: PreviewTableRow[];
}

/**
 * Shared price calculation helper.
 * Reuses exact calculation logic:
 * - PERCENTAGE: basePrice * (1 + value / 100)
 * - FIXED: basePrice + value
 * - Clamped to >= 0.
 */
export function calculatePreviewPrice(
  basePrice: number,
  adjustmentType: "PERCENTAGE" | "FIXED" = "PERCENTAGE",
  adjustmentValue: number = 0
): number {
  let adjusted = basePrice;
  if (adjustmentType === "PERCENTAGE") {
    adjusted = basePrice * (1 + adjustmentValue / 100);
  } else if (adjustmentType === "FIXED") {
    adjusted = basePrice + adjustmentValue;
  }
  if (adjusted < 0) adjusted = 0;
  return Math.round(adjusted * 100) / 100;
}

/**
 * Dynamic slot allocation algorithm for max 4 preview products.
 * Distributes preview slots across selected collections containing products:
 * - 1 collection: up to 4 products.
 * - 2 collections: 2 + 2 (redistributed if one collection has < 2 products).
 * - 3 collections: 2 + 1 + 1.
 * - 4 collections: 1 + 1 + 1 + 1.
 * - >4 collections: distributes 4 slots across collections containing products,
 *   preferring broader representation (1+1+1+1) and redistributing unused slots.
 */
export function allocatePreviewSlots(
  collectionProductCounts: { collectionId: string; availableCount: number }[],
  maxSlots: number = 4
): Map<string, number> {
  const allocation = new Map<string, number>();
  const activeCollections = collectionProductCounts.filter((c) => c.availableCount > 0);
  const totalCollections = activeCollections.length;

  if (totalCollections === 0) return allocation;

  // Determine initial target slots
  let targets: number[] = [];
  if (totalCollections === 1) {
    targets = [4];
  } else if (totalCollections === 2) {
    targets = [2, 2];
  } else if (totalCollections === 3) {
    targets = [2, 1, 1];
  } else {
    // 4 or more collections: 1 slot each for up to maxSlots collections
    targets = Array(Math.min(totalCollections, maxSlots)).fill(1);
  }

  // Initial assignment bounded by availableCount
  for (let i = 0; i < targets.length; i++) {
    const col = activeCollections[i];
    allocation.set(col.collectionId, Math.min(targets[i], col.availableCount));
  }

  // Count total assigned slots
  let assignedSlots = 0;
  allocation.forEach((count) => {
    assignedSlots += count;
  });

  let remainingSlots = maxSlots - assignedSlots;

  // Dynamically redistribute unused slots to active collections with remaining capacity
  while (remainingSlots > 0) {
    let slotAssigned = false;
    for (const col of activeCollections) {
      const currentAssigned = allocation.get(col.collectionId) || 0;
      if (currentAssigned < col.availableCount) {
        allocation.set(col.collectionId, currentAssigned + 1);
        remainingSlots--;
        slotAssigned = true;
        if (remainingSlots === 0) break;
      }
    }
    if (!slotAssigned) break; // No active collection has additional available products
  }

  return allocation;
}

export async function generatePriceAdjustmentPreview(
  storeId: string,
  adjustments: PreviewAdjustmentInput[]
): Promise<PriceAdjustmentPreviewResponse> {
  const enabledAdjustments = adjustments.filter((a) => a.enabled);

  if (!enabledAdjustments || enabledAdjustments.length === 0) {
    return {
      success: true,
      totalSelectedCollections: 0,
      totalAffectedProducts: 0,
      previewLimit: 4,
      tableRows: [],
    };
  }

  const selectedCollectionIds = enabledAdjustments.map((a) => a.collectionId);

  // Validate store authorization & resolve source store for prices if connected
  let targetStoreIds: string[] = [storeId];
  if (storeId === 'ALL') {
    const masterStore = await prisma.store.findFirst({ where: { isMaster: true, isActive: true } });
    if (masterStore) {
      const connections = await (prisma as any).storeConnection.findMany({
        where: { sourceStoreId: masterStore.id }
      });
      targetStoreIds = [masterStore.id, ...connections.map((c: any) => c.targetStoreId)];
    } else {
      const allStores = await prisma.store.findMany({ where: { isActive: true }, select: { id: true } });
      targetStoreIds = allStores.map(s => s.id);
    }
  } else {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      throw new Error("Store not found.");
    }
  }

  const selectedCollectionRecords = await prisma.collection.findMany({
    where: {
      id: { in: selectedCollectionIds },
    },
    orderBy: { title: "asc" },
  });

  const adjustmentMap = new Map<string, PreviewAdjustmentInput>();
  enabledAdjustments.forEach((a) => adjustmentMap.set(a.collectionId, a));

  // Gather candidate products per selected collection for the given storeId
  const collectionData: {
    collectionId: string;
    collectionTitle: string;
    totalProducts: number;
    candidates: any[];
  }[] = [];

  const allResolvedStoreColIds: string[] = [];

  for (const colRecord of selectedCollectionRecords) {
    const colTitle = colRecord.title;

    // Find matching collection in target storeId
    const storeCols = await prisma.collection.findMany({
      where: {
        storeId,
        title: { equals: colTitle, mode: "insensitive" },
      },
    });

    let targetColIds = storeCols.map((c) => c.id);
    if (targetColIds.length === 0) targetColIds = [colRecord.id];
    allResolvedStoreColIds.push(...targetColIds);

    let candidates = await prisma.productCache.findMany({
      where: {
        storeId,
        OR: [
          { collections: { some: { collection: { title: { equals: colTitle, mode: "insensitive" } } } } },
          { collections: { some: { collectionId: { in: targetColIds } } } },
          { tags: { contains: colTitle, mode: "insensitive" } },
        ],
      },
      take: 4,
    });

    if (candidates.length === 0 && targetColIds.length > 0) {
      const colProducts = await prisma.collectionProduct.findMany({
        where: { collectionId: { in: targetColIds } },
        take: 8,
        include: { productCache: true },
      });
      const skus = colProducts.map(cp => cp.productCache?.sku).filter(Boolean) as string[];
      if (skus.length > 0) {
        candidates = await prisma.productCache.findMany({
          where: {
            storeId,
            sku: { in: skus },
          },
          take: 4,
        });
      }
    }

    const totalProducts = await prisma.collectionProduct.count({
      where: { collectionId: { in: targetColIds } },
    });

    collectionData.push({
      collectionId: colRecord.id,
      collectionTitle: colTitle,
      totalProducts: Math.max(totalProducts, candidates.length),
      candidates,
    });
  }

  // Deduplicated Total Product Count: count distinct productCacheIds across resolved collections for target store
  const totalAffectedProductsResult = await prisma.collectionProduct.findMany({
    where: {
      collectionId: { in: allResolvedStoreColIds },
    },
    select: {
      productCacheId: true,
    },
    distinct: ["productCacheId"],
  });
  const totalAffectedProducts = totalAffectedProductsResult.length || collectionData.reduce((sum, c) => sum + c.candidates.length, 0);

  // Calculate dynamic slot allocation
  const slotCounts = collectionData.map((c) => ({
    collectionId: c.collectionId,
    availableCount: c.candidates.length,
  }));

  const slotAllocationMap = allocatePreviewSlots(slotCounts, 4);


  // Maintain seen product IDs to enforce deduplication in preview rows
  const seenProductIds = new Set<string>();
  const tableRows: PreviewTableRow[] = [];

  for (const colData of collectionData) {
    const targetSlot = slotAllocationMap.get(colData.collectionId) || 0;
    const adjConfig = adjustmentMap.get(colData.collectionId);
    const adjType = adjConfig?.adjustmentType || "PERCENTAGE";
    const adjVal = typeof adjConfig?.adjustmentValue === "number"
      ? adjConfig.adjustmentValue
      : parseFloat(String(adjConfig?.adjustmentValue || "0")) || 0;

    let addedForCollection = 0;

    for (const p of colData.candidates) {
      if (addedForCollection >= targetSlot) break;

      const productKey = p.shopifyProductId || p.id;
      if (seenProductIds.has(productKey)) continue;

      seenProductIds.add(productKey);

      const savedVal = (adjConfig as any)?.savedValue !== undefined ? String((adjConfig as any).savedValue) : null;
      const isSaved = savedVal !== null && savedVal === String(adjVal);

      const productPagePrice = typeof p.price === "number" ? p.price : parseFloat(String(p.price || 0));
      const basePrice = typeof p.basePrice === "number" && p.basePrice > 0 
        ? p.basePrice 
        : productPagePrice;

      // Single Source of Truth: Fetch actual product price from ProductCache DB if saved, or draft calculation if unsaved
      const adjustedPrice: number | null = isSaved 
        ? productPagePrice 
        : calculatePreviewPrice(basePrice, adjType, adjVal);
      const adjustmentText = `${adjVal >= 0 ? "+" : ""}${adjVal}%`;

      // Clean base title (strip variant suffix if present)
      const cleanTitle = p.title ? p.title.split(" - ")[0].trim() : "Untitled Product";

      tableRows.push({
        productId: p.id,
        shopifyProductId: p.shopifyProductId,
        imageUrl: p.imageUrl || null,
        productTitle: cleanTitle,
        sku: p.sku || null,
        collectionName: colData.collectionTitle,
        currentPrice: basePrice,
        isSaved,
        adjustedPrice,
        adjustmentText,
      });

      addedForCollection++;
    }
  }

  return {
    success: true,
    totalSelectedCollections: enabledAdjustments.length,
    totalAffectedProducts,
    previewLimit: 4,
    tableRows,
  };
}
