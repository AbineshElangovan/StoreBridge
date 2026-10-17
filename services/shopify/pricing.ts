import { prisma } from '@/lib/db/prisma';
import { getAdminClient } from '@/lib/shopify/admin';
import { setInventoryQuantity } from '@/lib/shopify/inventory';
import { createSyncLog } from '@/lib/shopify/sync-log';
import { linkConnectedProductMapping, findMappingByVariantId } from '@/services/product-mapping';
import { createNotification } from '@/services/notification-service';
import {
  PRODUCT_SET_MUTATION, PRODUCT_DELETE_MUTATION, PRODUCT_VARIANTS_DELETE_MUTATION,
  GET_VARIANT_BY_SKU_QUERY, GET_PRODUCT_BY_ID_QUERY, LOCATIONS_QUERY,
  GET_PRODUCT_COLLECTIONS_QUERY, GET_COLLECTIONS_BY_TITLE_QUERY, CREATE_COLLECTION_MUTATION,
  ADD_PRODUCT_TO_COLLECTION_MUTATION, GET_PUBLICATIONS_QUERY, PUBLISH_MUTATION
} from './graphql';
import { syncProductCollectionsByTags } from './collection-sync';
import { normalizeTagOrCollection, isCategoryMatch } from '@/lib/utils/categoryNormalization';
import { acquireSyncLock } from './locks';

export async function calculateAdjustedPrice(
  sourceBasePrice: number, 
  targetStore: any,
  productCollections: string[] = [],
  preloadedRules?: any[]
): Promise<string> {
  // 1. Calculate Base Price (Directly use source base price)
  let basePrice = sourceBasePrice;

  // 2. Apply Target Adjustment
  let adjusted = basePrice;
  
  const allEnabledRules = preloadedRules || await prisma.collectionPriceAdjustment.findMany({
    where: {
      storeId: targetStore?.id,
      enabled: true,
    },
    include: { collection: true }
  });

  const targetRules = allEnabledRules.filter(rule => {
    if (!rule.collection?.title) return false;
    return productCollections.some(cat => isCategoryMatch(cat, rule.collection.title));
  });

  if (targetRules.length > 0) {
    if (targetRules.length > 1) {
      // Sort by most recently updated rule so that newly saved adjustments (like 0%) take precedence over older rules
      targetRules.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    
    const rule = targetRules[0];
    console.log(`[Pricing] Applying Collection Rule for ${rule.collection?.title}: ${rule.adjustmentType} ${rule.adjustmentValue}`);
    if (rule.adjustmentType === 'PERCENTAGE') {
      adjusted = basePrice * (1 + rule.adjustmentValue / 100);
    } else if (rule.adjustmentType === 'FIXED') {
      adjusted = basePrice + rule.adjustmentValue;
    }
  } else {
    // Fallback to target store rule
    if (targetStore && targetStore.isPriceAdjustmentEnabled) {
      const value = targetStore.priceAdjustmentValue || 0;
      if (targetStore.priceAdjustmentType === 'PERCENTAGE') {
        adjusted = basePrice * (1 + value / 100);
      } else if (targetStore.priceAdjustmentType === 'FIXED') {
        adjusted = basePrice + value;
      }
    }
  }

  if (adjusted < 0) {
    adjusted = 0;
  }

  return adjusted.toFixed(2);
}

export async function applyPriceAdjustmentToStore(storeId: string) {
  console.log(`[PriceAdjustment] Starting bulk price adjustment for store ${storeId}`);

  const targetStore = await prisma.store.findUnique({
    where: { id: storeId }
  });

  if (!targetStore || !targetStore.isActive) {
    console.error(`[PriceAdjustment] Store ${storeId} not found or inactive.`);
    return;
  }

  let sourceStore: any = null;

  const isConnected = await (prisma as any).storeConnection.findFirst({
    where: {
      OR: [
        { sourceStoreId: targetStore.id },
        { targetStoreId: targetStore.id }
      ]
    }
  });

  const isStandalone = !targetStore.isMaster && !isConnected;

  if (isStandalone) {
    sourceStore = targetStore;
  } else {
    const connection = await (prisma as any).storeConnection.findFirst({
      where: { targetStoreId: targetStore.id }
    });
    
    if (connection) {
      sourceStore = await prisma.store.findUnique({ where: { id: connection.sourceStoreId } });
    } else {
      sourceStore = targetStore.isMaster ? targetStore : await prisma.store.findFirst({
        where: { isMaster: true, isActive: true }
      });
    }
  }

  if (!sourceStore) {
    console.error(`[PriceAdjustment] Source store not found for target ${targetStore.shopDomain}`);
    return;
  }

  console.log(`[PriceAdjustment] Target store: ${targetStore.shopDomain}, Source store: ${sourceStore.shopDomain}`);

  // Pre-fetch all enabled collection adjustment rules for targetStore
  const allEnabledRules = await prisma.collectionPriceAdjustment.findMany({
    where: {
      storeId: targetStore.id,
      enabled: true,
    },
    include: { collection: true }
  });

  // Fetch ALL cached products for this target store
  const targetCaches = await prisma.productCache.findMany({
    where: { storeId }
  });

  console.log(`[PriceAdjustment] Found ${targetCaches.length} products in local cache to process for store ${storeId}.`);

  // Group caches by shopifyProductId to perform batch updates per product in Shopify
  const cachesByProduct: { [productId: string]: typeof targetCaches } = {};
  targetCaches.forEach(cache => {
    if (cache.shopifyProductId) {
      if (!cachesByProduct[cache.shopifyProductId]) {
        cachesByProduct[cache.shopifyProductId] = [];
      }
      cachesByProduct[cache.shopifyProductId].push(cache);
    }
  });

  const productUpdatesToProcess: {
    productId: string;
    variantsUpdateInput: any[];
    cacheUpdates: { id: string; price: number; basePrice: number }[];
  }[] = [];

  let totalUpdatedCount = 0;

  const updatedCollectionStatsMap = new Map<string, { title: string; type: string; val: number; count: number }>();

  for (const [productId, caches] of Object.entries(cachesByProduct)) {
    const variantsUpdateInput: any[] = [];
    const cacheUpdates: { id: string; price: number; basePrice: number }[] = [];

    for (const cache of caches) {
      if (!cache.shopifyVariantId) continue;

      // Locate corresponding source cache if target is connected store
      let sourceCache: any = cache;
      if (sourceStore.id !== targetStore.id && cache.sku) {
        const found = await prisma.productCache.findFirst({
          where: {
            storeId: sourceStore.id,
            sku: cache.sku
          }
        });
        if (found) {
          sourceCache = found;
        }
      }

      // Get collections for this product using robust multi-source resolution matching Product Page API
      let rawCategories: string[] = [];

      // 1. Direct collection links
      const pcs = await prisma.collectionProduct.findMany({
        where: {
          OR: [
            { productCacheId: cache.id },
            { productCacheId: sourceCache.id },
          ]
        },
        include: { collection: true }
      });
      pcs.forEach(pc => {
        if (pc.collection?.title) rawCategories.push(pc.collection.title);
      });

      // 2. Cross-store SKU collection links
      const targetSku = cache.sku || sourceCache.sku;
      if (targetSku) {
        const crossStoreCols = await prisma.collectionProduct.findMany({
          where: {
            productCache: { sku: targetSku }
          },
          include: { collection: true }
        });
        crossStoreCols.forEach(c => {
          if (c.collection?.title) rawCategories.push(c.collection.title);
        });
      }

      // 3. Tags
      if (cache.tags) rawCategories.push(...cache.tags.split(','));
      if (sourceCache.tags) rawCategories.push(...sourceCache.tags.split(','));

      // 4. Apply dynamic category/tag normalization
      let collectionTitles: string[] = [];
      for (const rawCat of rawCategories) {
        if (!rawCat) continue;
        const finalCat = normalizeTagOrCollection(rawCat);
        if (finalCat && !collectionTitles.includes(finalCat)) {
          collectionTitles.push(finalCat);
        }
      }

      // Track matching collection rules for detailed notification/activity reporting
      const matchingRules = allEnabledRules.filter(rule => {
        if (!rule.collection?.title) return false;
        return collectionTitles.some(cat => isCategoryMatch(cat, rule.collection.title));
      });

      if (matchingRules.length > 0) {
        matchingRules.sort((a, b) => Math.abs(b.adjustmentValue) - Math.abs(a.adjustmentValue));
        const appliedRule = matchingRules[0];
        if (appliedRule && appliedRule.adjustmentValue !== 0) {
          const colTitle = appliedRule.collection?.title || collectionTitles[0] || 'General';

          if (!updatedCollectionStatsMap.has(colTitle)) {
            updatedCollectionStatsMap.set(colTitle, {
              title: colTitle,
              type: appliedRule.adjustmentType,
              val: appliedRule.adjustmentValue,
              count: 0
            });
          }
          updatedCollectionStatsMap.get(colTitle)!.count++;
        }
      }

      // IMPORTANT: Use basePrice to calculate the new price!
      const safeBasePrice = sourceCache.basePrice > 0 ? sourceCache.basePrice : sourceCache.price;
      const newPriceStr = await calculateAdjustedPrice(safeBasePrice, targetStore, collectionTitles, allEnabledRules);
      const newPrice = parseFloat(newPriceStr);

      const isAdjusted = newPrice !== safeBasePrice;
      const compareAtPriceStr = isAdjusted ? safeBasePrice.toFixed(2) : null;

      variantsUpdateInput.push({
        id: cache.shopifyVariantId,
        price: newPriceStr,
        compareAtPrice: compareAtPriceStr
      });

      cacheUpdates.push({
        id: cache.id,
        price: newPrice,
        basePrice: safeBasePrice
      });
    }

    if (cacheUpdates.length > 0) {
      productUpdatesToProcess.push({
        productId,
        variantsUpdateInput,
        cacheUpdates
      });
    }
  }

  // STEP 1: IMMEDIATELY UPDATE ALL LOCAL DATABASE RECORDS FOR ALL PRODUCTS IN A FAST PASS
  console.log(`[PriceAdjustment] Updating DB records for ${productUpdatesToProcess.length} products...`);
  const now = new Date();
  for (const item of productUpdatesToProcess) {
    for (const update of item.cacheUpdates) {
      await prisma.productCache.update({
        where: { id: update.id },
        data: {
          price: update.price,
          basePrice: update.basePrice,
          updatedAt: now
        }
      });
      totalUpdatedCount++;
    }
  }
  console.log(`[PriceAdjustment] Local DB successfully updated for ${totalUpdatedCount} product variants.`);

  // STEP 2: ASYNCHRONOUSLY PUSH PRICE UPDATES TO SHOPIFY API IN BACKGROUND
  (async () => {
    try {
      const client = await getAdminClient(targetStore.shopDomain);
      for (const item of productUpdatesToProcess) {
        acquireSyncLock(targetStore.shopDomain, item.productId, 'PRICE_ADJUSTMENT');
        try {
          const response: any = await client.request(`
            mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                productVariants {
                  id
                  price
                  compareAtPrice
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `, {
            variables: {
              productId: item.productId,
              variants: item.variantsUpdateInput
            }
          });

          const userErrors = response?.data?.productVariantsBulkUpdate?.userErrors || [];
          if (userErrors.length > 0) {
            console.error(`[PriceAdjustment] Shopify returned errors for product ${item.productId}:`, userErrors.map((e: any) => e.message).join(', '));
          }
        } catch (err: any) {
          console.error(`[PriceAdjustment] Failed to update variants for product ${item.productId} on Shopify:`, err.message);
        }
      }
      console.log(`[PriceAdjustment] Finished pushing price adjustments to Shopify for store ${storeId}`);
    } catch (err: any) {
      console.error(`[PriceAdjustment] Shopify bulk update task error:`, err.message);
    }
  })();

  // Send ActivityLog entry and Notification per price adjustment save operation
  const nonZeroRules = allEnabledRules.filter(r => r.adjustmentValue !== 0);
  if (totalUpdatedCount > 0 || nonZeroRules.length > 0) {
    const storeLabel = targetStore.label || targetStore.shopDomain;
    let activeEntries = Array.from(updatedCollectionStatsMap.values()).filter(e => e.count > 0 && e.val !== 0);

    // Fallback: If activeEntries is empty, calculate dynamic count per collection directly from database
    if (activeEntries.length === 0 && nonZeroRules.length > 0) {
      for (const rule of nonZeroRules) {
        if (!rule.collection?.title) continue;
        const colTitle = rule.collection.title;
        const normCol = normalizeTagOrCollection(colTitle);
        const count = await prisma.productCache.count({
          where: {
            storeId: targetStore.id,
            OR: [
              { collections: { some: { collection: { title: { equals: colTitle, mode: 'insensitive' } } } } },
              { tags: { contains: normCol, mode: 'insensitive' } },
            ]
          }
        });
        activeEntries.push({
          title: normCol || colTitle,
          type: rule.adjustmentType,
          val: rule.adjustmentValue,
          count: count
        });
      }
    }

    let summaryText = '';
    let collectionsField = '';

    if (activeEntries.length > 0) {
      const formattedItems = activeEntries.map(e => {
        const sign = e.val >= 0 ? '+' : '';
        const unit = e.type === 'PERCENTAGE' ? '%' : '';
        const pCount = e.count > 0 ? ` [${e.count} product${e.count > 1 ? 's' : ''}]` : '';
        return `${e.title} (${sign}${e.val}${unit})${pCount}`;
      });

      collectionsField = activeEntries.map(e => e.title).join(', ');

      if (activeEntries.length === 1) {
        summaryText = formattedItems[0];
      } else if (activeEntries.length <= 3) {
        summaryText = formattedItems.join(', ');
      } else {
        summaryText = `${formattedItems.slice(0, 3).join(', ')} and ${activeEntries.length - 3} other collection${activeEntries.length - 3 > 1 ? 's' : ''}`;
      }
    } else {
      summaryText = 'Collections';
      collectionsField = 'Price Adjustment';
    }

    const totalAffectedCount = activeEntries.reduce((sum, e) => sum + e.count, 0);
    const totalSuffix = activeEntries.length > 1 && totalAffectedCount > 0 
      ? ` (${totalAffectedCount} products updated total)` 
      : '';
      
    const logDescription = `Price adjustment applied for ${summaryText} in ${storeLabel}${totalSuffix}`;
    const sampleImageCache = targetCaches.find(c => c.imageUrl) || null;

    await prisma.activityLog.create({
      data: {
        storeId: targetStore.id,
        productTitle: `Price Adjustment (${collectionsField})`,
        eventType: 'UPDATE',
        description: logDescription,
        collection: collectionsField,
        imageUrl: sampleImageCache?.imageUrl || null,
      }
    });

    // Create exactly 1 notification for the target store
    await createNotification({
      recipientStoreId: targetStore.id,
      type: 'PRICE_UPDATE',
      title: 'Price Adjustment Updated',
      message: `Price adjustment applied for ${summaryText} in ${storeLabel}${totalSuffix}`,
      sourceStoreId: sourceStore?.id,
      targetStoreId: targetStore.id,
    });
  }

  console.log(`[PriceAdjustment] Bulk price adjustment completed for store ${storeId}`);
}


/**
 * Synchronizes custom collections for a specific product across stores.
 */
