import { prisma } from "@/lib/db/prisma";
import { getAdminClient } from "@/lib/shopify/admin";
import { GET_PRODUCTS_QUERY } from "./graphql";
import { fetchLatestShopifyProduct } from "./product-fetcher";
import { processProductCreate } from "./product-sync";
import { cleanupOrphanedProducts } from "./sync/cleanup";

import { createNotification } from "@/services/notification-service";

export async function pushProductsToDestinations(sourceStoreId: string, targetStoreIds: string[]) {
  console.log(`[PushSync] Starting push sync from source: ${sourceStoreId} to targets:`, targetStoreIds);
  
  const sourceStore = await prisma.store.findUnique({ where: { id: sourceStoreId } });
  if (!sourceStore || !sourceStore.isActive) throw new Error("Source store is invalid or inactive");

  const targetStores = await prisma.store.findMany({
    where: { id: { in: targetStoreIds }, isActive: true }
  });

  if (targetStores.length === 0) throw new Error("No active target stores found");

  const sourceClient = await getAdminClient(sourceStore.shopDomain);
  
  // 0. Garbage Collection: Self-Healing Cleanup for all involved stores
  console.log(`[PushSync] Running pre-sync Garbage Collection for source store...`);
  await cleanupOrphanedProducts(sourceStore.id);
  
  for (const targetStore of targetStores) {
    console.log(`[PushSync] Running pre-sync Garbage Collection for target store ${targetStore.shopDomain}...`);
    await cleanupOrphanedProducts(targetStore.id);
  }

  // Check if target stores are ALREADY 100% in sync to avoid redundant API loops
  const sourceCaches = await prisma.productCache.findMany({
    where: { storeId: sourceStore.id },
    select: { sku: true, inventoryQuantity: true }
  });

  let isAlreadySynced = false;
  if (sourceCaches.length > 0) {
    let allTargetsMatched = true;
    for (const targetStore of targetStores) {
      const targetCaches = await prisma.productCache.findMany({
        where: { storeId: targetStore.id },
        select: { sku: true, inventoryQuantity: true }
      });

      const targetMapBySku = new Map(targetCaches.filter(c => c.sku).map(c => [c.sku, c.inventoryQuantity]));
      const sourceSkus = sourceCaches.map(c => c.sku).filter(Boolean);

      if (sourceSkus.length === 0 || targetCaches.length < sourceCaches.length) {
        allTargetsMatched = false;
        break;
      }

      const hasAllSkusAndQuantities = sourceSkus.every(sku => {
        const targetQty = targetMapBySku.get(sku as string);
        const sourceItem = sourceCaches.find(c => c.sku === sku);
        return targetQty !== undefined && targetQty === sourceItem?.inventoryQuantity;
      });

      if (!hasAllSkusAndQuantities) {
        allTargetsMatched = false;
        break;
      }
    }
    isAlreadySynced = allTargetsMatched;
  }

  if (isAlreadySynced) {
    console.log(`[PushSync] All target stores are ALREADY in sync with ${sourceStore.shopDomain}. Skipping redundant API calls.`);
    return {
      success: true,
      isAlreadySynced: true,
      syncedProducts: sourceCaches.length,
      message: "Selected stores are already fully in sync! No changes were required."
    };
  }

  // 1. Fetch Source Products
  let hasNextPage = true;
  let cursor: string | null = null;
  const allSourceProducts = [];

  while (hasNextPage) {
    const variables: any = { first: 50 };
    if (cursor) variables.after = cursor;
    const response = await sourceClient.request(GET_PRODUCTS_QUERY, { variables });
    
    const productEdges = response?.data?.products?.edges ?? [];
    allSourceProducts.push(...productEdges.map((e: any) => e.node));
    
    hasNextPage = response?.data?.products?.pageInfo?.hasNextPage ?? false;
    cursor = response?.data?.products?.pageInfo?.endCursor ?? null;
  }

  console.log(`[PushSync] Fetched ${allSourceProducts.length} products from Source Store.`);

  const targetStoreDomains = targetStores.map(s => s.shopDomain);
  let failedCount = 0;

  // 2. Iterate Source Products and trigger processProductCreate
  for (const sourceProduct of allSourceProducts) {
    try {
      console.log(`[PushSync] Syncing product ${sourceProduct.id}`);
      let payload = await fetchLatestShopifyProduct(sourceStore.shopDomain, sourceProduct.id);
      if (!payload) continue;

      const webhookId = `manual-sync-${Date.now()}-${payload.id}`;
      // This will handle Create, Update, Collection mappings, Price adjustments, and Images!
      await processProductCreate(sourceStore.shopDomain, payload, webhookId, targetStoreDomains);
    } catch (err: any) {
       failedCount++;
       console.error(`[PushSync] Error syncing product ${sourceProduct.id}:`, err);
    }
  }

  // 3. Log Success & Dispatch Notifications
  for (const targetStore of targetStores) {
    const isSuccess = failedCount === 0;
    await prisma.syncLog.create({
      data: {
        sku: "FULL_SYNC",
        sourceStoreId: sourceStore.id,
        destinationStoreId: targetStore.id,
        previousQuantity: 0,
        updatedQuantity: 0,
        status: isSuccess ? "SUCCESS" : "FAILED",
        triggerType: "MANUAL",
      }
    });

    if (isSuccess) {
      // Sync Success Notification for Source (Master)
      await createNotification({
        recipientStoreId: sourceStore.id,
        type: 'SYNC_UPDATE',
        title: 'Sync Success',
        message: `${allSourceProducts.length} products synced successfully to ${targetStore.label || targetStore.shopDomain}`,
        sourceStoreId: sourceStore.id,
        targetStoreId: targetStore.id,
      });

      // Sync Success Notification for Target (Sub-store)
      await createNotification({
        recipientStoreId: targetStore.id,
        type: 'SYNC_UPDATE',
        title: 'Sync Success',
        message: `${allSourceProducts.length} products synchronized from ${sourceStore.label || sourceStore.shopDomain}`,
        sourceStoreId: sourceStore.id,
        targetStoreId: targetStore.id,
      });
    } else {
      // Sync Failure Notification
      await createNotification({
        recipientStoreId: sourceStore.id,
        type: 'SYNC_FAILURE',
        title: 'Sync Failure',
        message: `Sync partially failed to ${targetStore.label || targetStore.shopDomain} (${failedCount} products failed)`,
        sourceStoreId: sourceStore.id,
        targetStoreId: targetStore.id,
      });
    }
  }

  return {
    success: failedCount === 0,
    isAlreadySynced: false,
    syncedProducts: allSourceProducts.length,
    message: failedCount === 0 ? "Synchronization completed successfully!" : "Sync finished with errors."
  };
}
