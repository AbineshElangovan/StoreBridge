import { prisma } from "@/lib/db/prisma";
import { WebhookStatus } from "@prisma/client";
import { createNotification } from "@/services/notification-service";

// Import your existing sync logic here
import {
  processProductUpdate,
  processProductCreate,
  processProductDelete,
  hasSyncLock,
  releaseSyncLock,
  updateLocalProductCache,
  withLock
} from "@/services/product-sync";
import { generateSkusForProductIfNeeded } from "@/services/sku";
import { createMasterProductMapping, findMappingByVariantId } from "@/services/product-mapping";

const BATCH_SIZE = 20;
const MAX_RETRIES = 3;

function isCatalogMetadataChanged(payload: any, cachedProducts: any[]): boolean {
  if (!cachedProducts || cachedProducts.length === 0) {
    return true; // No existing cache, treat as initial/meaningful update
  }

  const firstCache = cachedProducts[0];

  // 1. Check title
  if (payload.title && firstCache.title) {
    const cachedCleanTitle = firstCache.title.split(' - ')[0].trim();
    if (payload.title.trim() !== cachedCleanTitle) return true;
  }

  // 2. Check tags
  if (payload.tags !== undefined && (payload.tags || '') !== (firstCache.tags || '')) {
    return true;
  }

  // 3. Check variants for Price, SKU, or Option changes
  if (payload.variants && Array.isArray(payload.variants)) {
    for (const v of payload.variants) {
      const vSku = v.sku?.trim();
      const vPrice = v.price ? parseFloat(v.price) : null;
      const vId = String(v.id);

      const cachedVar = cachedProducts.find((cp: any) =>
        (cp.sku && vSku && cp.sku.trim() === vSku) ||
        cp.shopifyVariantId.endsWith(vId)
      );

      if (!cachedVar) {
        return true; // New variant added
      }

      if (vPrice !== null && cachedVar.price !== null && Math.abs(vPrice - cachedVar.price) > 0.001) {
        return true; // Price changed
      }

      if (vSku && cachedVar.sku && vSku.toLowerCase() !== cachedVar.sku.toLowerCase()) {
        return true; // SKU changed
      }
    }
  }

  return false; // Only inventory levels changed
}

export async function processWebhookQueue() {
  console.log(`[WebhookWorker] Starting queue processing...`);
  let processedCount = 0;

  try {
    // 1. Fetch pending webhooks
    const pendingJobs = await prisma.webhookQueue.findMany({
      where: { status: WebhookStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    if (pendingJobs.length === 0) {
      console.log(`[WebhookWorker] No pending webhooks found.`);
      return { processedCount: 0 };
    }

    console.log(`[WebhookWorker] Found ${pendingJobs.length} pending webhooks to process.`);

    for (const job of pendingJobs) {
      const startTime = Date.now();

      // Idempotency check for repeated webhook delivery replays
      const duplicateCompleted = await prisma.webhookQueue.findFirst({
        where: {
          webhookId: job.webhookId,
          status: WebhookStatus.COMPLETED,
          id: { not: job.id }
        }
      });

      if (duplicateCompleted) {
        console.log(`[WebhookWorker:Ignored] WebhookId: ${job.webhookId} | Reason: duplicate_webhook_id`);
        await prisma.webhookQueue.update({
          where: { id: job.id },
          data: { status: WebhookStatus.COMPLETED, error: 'Duplicate webhookId ignored' }
        });
        continue;
      }

      // 2. Lock the job
      try {
        const result = await prisma.webhookQueue.updateMany({
          where: {
            id: job.id,
            status: WebhookStatus.PENDING
          },
          data: {
            status: WebhookStatus.PROCESSING,
            attempts: { increment: 1 }
          }
        });

        if (result.count === 0) {
          console.log(`[WebhookWorker] Job ${job.id} already picked up by another worker. Skipping.`);
          continue;
        }
      } catch (lockError) {
        console.log(`[WebhookWorker] Could not lock job ${job.id}. Skipping.`);
        continue;
      }

      const eventIdStr = (job as any).eventId || job.webhookId;
      console.log(`[WebhookWorker] Processing job ${job.id} | Topic: ${job.topic} | Store: ${job.shopDomain} | WebhookId: ${job.webhookId} | EventId: ${eventIdStr}`);

      // 3. Process the job
      try {
        const payload = job.payload as any;

        switch (job.topic) {
          case 'products/create':
            await handleProductsCreate(job.shopDomain, payload, job.webhookId);
            break;
          case 'products/update':
            await handleProductsUpdate(job.shopDomain, payload, job.webhookId);
            break;
          case 'products/delete':
            await handleProductsDelete(job.shopDomain, payload, job.webhookId);
            break;
          case 'inventory_levels/update':
            await handleInventoryUpdate(job.shopDomain, payload, job.webhookId);
            break;
          default:
            console.log(`[WebhookWorker] Unhandled topic: ${job.topic}`);
        }

        // 4. Mark as COMPLETED
        const duration = Date.now() - startTime;
        await prisma.webhookQueue.update({
          where: { id: job.id },
          data: { status: WebhookStatus.COMPLETED, error: null }
        });

        console.log(`[WebhookWorker:Finished] Time: ${new Date().toISOString()} | WebhookId: ${job.webhookId} | EventId: ${eventIdStr} | Status: PROCESSED | Duration: ${duration}ms`);
        processedCount++;

      } catch (error: any) {
        const duration = Date.now() - startTime;
        const newAttempts = job.attempts + 1;
        const isFinalFailure = newAttempts >= MAX_RETRIES;
        const nextStatus = isFinalFailure ? WebhookStatus.FAILED : WebhookStatus.PENDING;

        await prisma.webhookQueue.update({
          where: { id: job.id },
          data: {
            status: nextStatus,
            error: `${error.message}\n${error.stack || ''}`
          }
        });

        console.error(`[WebhookWorker:Failed] WebhookId: ${job.webhookId} failed (Attempt ${newAttempts}/${MAX_RETRIES}) in ${duration}ms. Error: ${error.message}`);

        if (isFinalFailure) {
          console.error(`[WebhookWorker] Job ${job.id} reached maximum retries and is marked as FAILED.`);
        }
      }
    }

  } catch (globalError: any) {
    console.error(`[WebhookWorker] Fatal error during queue processing:`, globalError);
  }

  return { processedCount };
}

// --------------------------------------------------------------------------------
// Topic Handlers (Moved from route.ts)
// --------------------------------------------------------------------------------

async function handleProductsCreate(shop: string, payload: any, webhookId: string) {
  // Guard: Only allow synchronization from the Master Store
  const store = await prisma.store.findUnique({
    where: { shopDomain: shop },
  });

  if (!store) return;

  const isStandalone = !store.isMaster &&
    (await prisma.storeConnection.count({
      where: {
        OR: [
          { sourceStoreId: store.id },
          { targetStoreId: store.id }
        ]
      }
    })) === 0;

  if (!store.isMaster) {
    console.log(`[Worker:products/create] Processing ${isStandalone ? 'Standalone' : 'Sub'} Store product create: ${shop}`);
    await updateLocalProductCache(shop, payload);

    const sku = payload.variants?.[0]?.sku || null;
    const collectionStr = payload.collections?.map((c: any) => c.title).join(', ') || null;

    // Create ActivityLog for this store (with deduplication)
    const imgUrl = payload.image?.src || payload.images?.[0]?.src || null;
    const existingLog = await prisma.activityLog.findFirst({
      where: {
        storeId: store.id,
        productId: String(payload.id),
        eventType: "CREATE",
        createdAt: { gte: new Date(Date.now() - 60000) }
      }
    });
    if (!existingLog) {
      await prisma.activityLog.create({
        data: {
          storeId: store.id,
          productId: String(payload.id),
          productTitle: payload.title || "Unknown Product",
          sku: sku,
          imageUrl: imgUrl,
          eventType: "CREATE",
          description: `Product created with ${payload.variants?.length || 1} variants`,
          collection: collectionStr,
        },
      });
    }

    // Store receives its own Product Created notification
    await createNotification({
      recipientStoreId: store.id,
      type: 'PRODUCT_UPDATED',
      title: 'Product Created',
      message: `Product ${payload.title} was created successfully`,
      productId: String(payload.id),
      productTitle: payload.title,
      sourceStoreId: store.id,
      targetStoreId: store.id,
    });

    // Only connected Sub stores (not standalone) notify Master
    if (!isStandalone) {
      const masterStore = await prisma.store.findFirst({
        where: { isMaster: true, isActive: true }
      });
      if (masterStore && masterStore.id !== store.id) {
        await createNotification({
          recipientStoreId: masterStore.id,
          type: 'CONNECTED_STORE_UPDATE',
          title: 'Connected Store Product Created',
          message: `${store.label || store.shopDomain} created product ${payload.title}`,
          productId: String(payload.id),
          productTitle: payload.title,
          sourceStoreId: store.id,
          targetStoreId: masterStore.id,
        });
      }
    }
    return;
  }

  // Loop prevention: check if this is an internally triggered sync creation
  const productGid = `gid://shopify/Product/${payload.id}`;
  if (hasSyncLock(shop, productGid, payload.title)) {
    console.log(`[Worker:products/create] Ignored internally triggered creation to prevent infinite loop for ${shop} (Product: ${payload.title})`);
    releaseSyncLock(shop, productGid, payload.title);
    return;
  }

  const lockKey = `product_sync_${payload.id}`;
  await withLock(lockKey, async () => {
    // Fetch the absolute latest source of truth from Shopify FIRST
    const { fetchLatestShopifyProduct } = require('@/services/shopify/product-fetcher');
    let enrichedPayload = payload;

    const latestPayload = await fetchLatestShopifyProduct(shop, payload.id);
    if (latestPayload) {
      latestPayload.variants.forEach((latestVariant: any) => {
        const originalVariant = payload.variants?.find((v: any) => v.admin_graphql_api_id === latestVariant.admin_graphql_api_id || v.id == latestVariant.id);
        if (!latestVariant.sku && originalVariant?.sku) {
          latestVariant.sku = originalVariant.sku;
        }
      });
      enrichedPayload = latestPayload;
    }

    enrichedPayload = await generateSkusForProductIfNeeded(shop, enrichedPayload);

    // Generate Product Unique ID for all variants FIRST
    const storeRecord = await prisma.store.findUnique({ where: { shopDomain: shop } });
    if (storeRecord && enrichedPayload.variants) {
      for (const variant of enrichedPayload.variants) {
        const variantIdStr = variant.admin_graphql_api_id?.split('/').pop() || String(variant.id);
        const productIdStr = String(enrichedPayload.id);
        const inventoryItemIdStr = variant.inventory_item_id ? String(variant.inventory_item_id) : null;

        const existingMapping = await prisma.productMapping.findUnique({
          where: { storeId_shopifyVariantId: { storeId: storeRecord.id, shopifyVariantId: variantIdStr } }
        });

        if (!existingMapping) {
          const mapping = await createMasterProductMapping(
            storeRecord.id,
            productIdStr,
            variantIdStr,
            variant.sku || null,
            inventoryItemIdStr
          );
          if (!mapping) {
            throw new Error(`Failed to persist mapping for variant ${variantIdStr}`);
          }
        }
      }
    }

    await updateLocalProductCache(shop, enrichedPayload);
    await processProductCreate(shop, enrichedPayload, webhookId);

    // Create ActivityLog for CREATE
    if (storeRecord) {
      const sku = enrichedPayload.variants?.[0]?.sku || null;

      const productCache = await prisma.productCache.findFirst({
        where: { storeId: storeRecord.id, shopifyProductId: `gid://shopify/Product/${enrichedPayload.id}` },
        include: { collections: { include: { collection: true } } }
      });
      const collectionStr = productCache?.collections?.map((c: any) => c.collection.title).join(', ') || null;

      const imgUrl = enrichedPayload.image?.src || enrichedPayload.images?.[0]?.src || productCache?.imageUrl || null;
      const existingLog = await prisma.activityLog.findFirst({
        where: {
          storeId: storeRecord.id,
          productId: String(enrichedPayload.id),
          eventType: "CREATE",
          createdAt: { gte: new Date(Date.now() - 60000) }
        }
      });
      if (!existingLog) {
        await prisma.activityLog.create({
          data: {
            storeId: storeRecord.id,
            productId: String(enrichedPayload.id),
            productTitle: enrichedPayload.title || "Unknown Product",
            sku: sku,
            imageUrl: imgUrl,
            eventType: "CREATE",
            description: `Product created with ${enrichedPayload.variants?.length || 1} variants`,
            collection: collectionStr,
          }
        });
      }

      // Create notification for Product Created (for current store always, plus Master if connected)
      await createNotification({
        recipientStoreId: storeRecord.id,
        type: 'PRODUCT_UPDATED',
        title: 'Product Created',
        message: `Product ${enrichedPayload.title} was created successfully`,
        productId: String(enrichedPayload.id),
        productTitle: enrichedPayload.title,
        sourceStoreId: storeRecord.id,
        targetStoreId: storeRecord.id,
      });

      if (!storeRecord.isMaster) {
        const masterStore = await prisma.store.findFirst({
          where: { isMaster: true, isActive: true }
        });
        if (masterStore && masterStore.id !== storeRecord.id) {
          await createNotification({
            recipientStoreId: masterStore.id,
            type: 'CONNECTED_STORE_UPDATE',
            title: 'Connected Store Product Created',
            message: `${storeRecord.label || storeRecord.shopDomain} created product ${enrichedPayload.title}`,
            productId: String(enrichedPayload.id),
            productTitle: enrichedPayload.title,
            sourceStoreId: storeRecord.id,
            targetStoreId: masterStore.id,
          });
        }
      }
    }
  });
}

async function handleProductsUpdate(shop: string, payload: any, webhookId: string) {
  // Guard: Only allow synchronization from the Master Store
  const store = await prisma.store.findUnique({
    where: { shopDomain: shop },
  });

  if (!store) return;

  const isStandalone = !store.isMaster &&
    (await prisma.storeConnection.count({
      where: {
        OR: [
          { sourceStoreId: store.id },
          { targetStoreId: store.id }
        ]
      }
    })) === 0;

  // 1. Fetch previous cache
  const productCaches = await prisma.productCache.findMany({
    where: { storeId: store.id, shopifyProductId: `gid://shopify/Product/${payload.id}` },
  });

  // 2. Disambiguate: Is this purely an inventory-only change?
  const metadataChanged = isCatalogMetadataChanged(payload, productCaches);

  if (!metadataChanged) {
    console.log(`[WebhookWorker:Ignored] WebhookId: ${webhookId} | Reason: inventory_only for ${shop} (Product: ${payload.title})`);
    await updateLocalProductCache(shop, payload, 'products/update');
    return;
  }

  if (!store.isMaster) {
    console.log(`[Worker:products/update] Processing ${isStandalone ? 'Standalone' : 'Sub'} Store catalog update: ${shop}`);

    // Update local cache for Store
    await updateLocalProductCache(shop, payload, 'products/update');

    // Create ActivityLog ONLY when metadata actually changes
    const sku = payload.variants?.[0]?.sku || null;
    const imgUrl = payload.image?.src || payload.images?.[0]?.src || productCaches[0]?.imageUrl || null;
    const existingLog = await prisma.activityLog.findFirst({
      where: {
        storeId: store.id,
        productId: String(payload.id),
        eventType: "UPDATE",
        createdAt: { gte: new Date(Date.now() - 60000) }
      }
    });
    if (!existingLog) {
      await prisma.activityLog.create({
        data: {
          storeId: store.id,
          productId: String(payload.id),
          productTitle: payload.title || "Unknown Product",
          sku: sku,
          imageUrl: imgUrl,
          eventType: "UPDATE",
          description: `Product details updated in catalog`,
        },
      });
    }

    // Check price changed vs product details changed
    const oldPrice = productCaches[0]?.price;
    const newPrice = payload.variants?.[0]?.price ? parseFloat(payload.variants[0].price) : null;
    const isPriceChanged = oldPrice !== null && oldPrice !== undefined && newPrice !== null && oldPrice !== newPrice;

    if (isPriceChanged) {
      await createNotification({
        recipientStoreId: store.id,
        type: 'PRICE_UPDATE',
        title: 'Price Update',
        message: `${payload.title} price updated: ₹${oldPrice} → ₹${newPrice}`,
        productId: String(payload.id),
        productTitle: payload.title,
        sourceStoreId: store.id,
      });
    } else {
      await createNotification({
        recipientStoreId: store.id,
        type: 'PRODUCT_UPDATED',
        title: 'Product Updated',
        message: `${payload.title} was updated`,
        productId: String(payload.id),
        productTitle: payload.title,
        sourceStoreId: store.id,
      });
    }

    if (!isStandalone) {
      const masterStore = await prisma.store.findFirst({
        where: { isMaster: true, isActive: true }
      });
      if (masterStore && masterStore.id !== store.id) {
        await createNotification({
          recipientStoreId: masterStore.id,
          type: 'CONNECTED_STORE_UPDATE',
          title: 'Connected Store Update',
          message: `${store.label || store.shopDomain} updated product ${payload.title}`,
          productId: String(payload.id),
          productTitle: payload.title,
          sourceStoreId: store.id,
          targetStoreId: masterStore.id,
        });
      }
    }
    return;
  }

  // Loop prevention: check if this is an internally triggered sync update
  const productGid = `gid://shopify/Product/${payload.id}`;
  if (hasSyncLock(shop, productGid, payload.title)) {
    console.log(`[Worker:products/update] Ignored internally triggered update to prevent infinite loop for ${shop} (Product: ${payload.title})`);
    releaseSyncLock(shop, productGid, payload.title);
    return;
  }

  const lockKey = `product_sync_${payload.id}`;
  await withLock(lockKey, async () => {
    const { fetchLatestShopifyProduct } = require('@/services/shopify/product-fetcher');
    let currentPayload = payload;

    const latestPayload = await fetchLatestShopifyProduct(shop, payload.id);
    if (latestPayload) {
      latestPayload.variants.forEach((latestVariant: any) => {
        const originalVariant = payload.variants?.find((v: any) => v.admin_graphql_api_id === latestVariant.admin_graphql_api_id || v.id == latestVariant.id);
        if (!latestVariant.sku && originalVariant?.sku) {
          latestVariant.sku = originalVariant.sku;
        }
      });
      currentPayload = latestPayload;
    }

    currentPayload = await generateSkusForProductIfNeeded(shop, currentPayload);

    await updateLocalProductCache(shop, currentPayload, 'products/update');
    await processProductUpdate(shop, currentPayload, webhookId);

    const storeRecord = await prisma.store.findUnique({ where: { shopDomain: shop } });
    if (storeRecord && currentPayload.variants) {
      for (const variant of currentPayload.variants) {
        const variantIdStr = variant.admin_graphql_api_id?.split('/').pop() || String(variant.id);
        const mapping = await findMappingByVariantId(storeRecord.id, variantIdStr);
        if (!mapping) {
          if (storeRecord.isMaster) {
            const { createMasterProductMapping } = require('@/services/product-mapping');
            await createMasterProductMapping(
              storeRecord.id,
              String(currentPayload.id),
              variantIdStr,
              variant.sku || `AUTOGEN-${variantIdStr}`
            );
          }
        }
      }

      if (storeRecord) {
        const sku = currentPayload.variants?.[0]?.sku || null;

        const productCache = await prisma.productCache.findFirst({
          where: { storeId: storeRecord.id, shopifyProductId: `gid://shopify/Product/${currentPayload.id}` },
          include: { collections: { include: { collection: true } } }
        });
        const collectionStr = productCache?.collections?.map((c: any) => c.collection.title).join(', ') || null;

        const imgUrl = currentPayload.image?.src || currentPayload.images?.[0]?.src || productCache?.imageUrl || null;
        const existingLog = await prisma.activityLog.findFirst({
          where: {
            storeId: storeRecord.id,
            productId: String(currentPayload.id),
            eventType: "UPDATE",
            createdAt: { gte: new Date(Date.now() - 60000) }
          }
        });
        if (!existingLog) {
          await prisma.activityLog.create({
            data: {
              storeId: storeRecord.id,
              productId: String(currentPayload.id),
              productTitle: currentPayload.title || "Unknown Product",
              sku: sku,
              imageUrl: imgUrl,
              eventType: "UPDATE",
              description: `Product details updated in catalog`,
              collection: collectionStr,
            }
          });
        }

        const oldPrice = productCache?.price;
        const newPrice = currentPayload.variants?.[0]?.price ? parseFloat(currentPayload.variants[0].price) : null;
        const isPriceChanged = oldPrice !== null && oldPrice !== undefined && newPrice !== null && oldPrice !== newPrice;

        if (isPriceChanged) {
          await createNotification({
            recipientStoreId: storeRecord.id,
            type: 'PRICE_UPDATE',
            title: 'Price Update',
            message: `${currentPayload.title} price updated: ₹${oldPrice} → ₹${newPrice}`,
            productId: String(currentPayload.id),
            productTitle: currentPayload.title,
            sourceStoreId: storeRecord.id,
            targetStoreId: storeRecord.id,
          });
        } else {
          await createNotification({
            recipientStoreId: storeRecord.id,
            type: 'PRODUCT_UPDATED',
            title: 'Product Updated',
            message: `${currentPayload.title} was updated`,
            productId: String(currentPayload.id),
            productTitle: currentPayload.title,
            sourceStoreId: storeRecord.id,
            targetStoreId: storeRecord.id,
          });
        }

        if (!storeRecord.isMaster) {
          const masterStore = await prisma.store.findFirst({
            where: { isMaster: true, isActive: true }
          });
          if (masterStore) {
            await createNotification({
              recipientStoreId: masterStore.id,
              type: 'CONNECTED_STORE_UPDATE',
              title: 'Connected Store Update',
              message: `${storeRecord.label || storeRecord.shopDomain} updated product ${currentPayload.title}`,
              productId: String(currentPayload.id),
              productTitle: currentPayload.title,
              sourceStoreId: storeRecord.id,
              targetStoreId: masterStore.id,
            });
          }
        }
      }
    }
  });
}

async function handleProductsDelete(shop: string, payload: any, webhookId: string) {
  const store = await prisma.store.findUnique({
    where: { shopDomain: shop },
  });

  if (!store) return;

  const isStandalone = !store.isMaster &&
    (await prisma.storeConnection.count({
      where: {
        OR: [
          { sourceStoreId: store.id },
          { targetStoreId: store.id }
        ]
      }
    })) === 0;

  if (!store.isMaster) {
    console.log(`[Worker:products/delete] Processing ${isStandalone ? 'Standalone' : 'Sub'} Store product delete: ${shop}`);
    const deletedGid = `gid://shopify/Product/${payload.id}`;

    const cacheForLog = await prisma.productCache.findFirst({
      where: {
        OR: [
          { storeId: store.id, shopifyProductId: deletedGid },
          { storeId: store.id, shopifyProductId: String(payload.id) },
          { shopifyProductId: deletedGid },
          { shopifyProductId: String(payload.id) },
        ]
      },
      select: { title: true, sku: true, imageUrl: true }
    });

    let productTitle = cacheForLog?.title || payload.title;
    if (!productTitle || productTitle === 'Deleted Product' || productTitle === 'Unknown Product') {
      const pastLog = await prisma.activityLog.findFirst({
        where: {
          productId: { in: [String(payload.id), deletedGid] }
        },
        orderBy: { createdAt: 'desc' },
        select: { productTitle: true }
      });
      if (pastLog?.productTitle && pastLog.productTitle !== 'Deleted Product' && pastLog.productTitle !== 'Unknown Product') {
        productTitle = pastLog.productTitle;
      }
    }

    if (!productTitle || productTitle === 'Deleted Product' || productTitle === 'Unknown Product') {
      productTitle = payload.title || `Product #${payload.id}`;
    }

    const mappedVariantsCount = await prisma.variantMap.count({
      where: { storeId: store.id, shopifyProductId: deletedGid },
    });

    await prisma.variantMap.deleteMany({
      where: { storeId: store.id, shopifyProductId: deletedGid },
    });

    const caches = await prisma.productCache.findMany({
      where: { storeId: store.id, shopifyProductId: deletedGid },
      select: { id: true }
    });
    for (const c of caches) {
      await prisma.collectionProduct.deleteMany({ where: { productCacheId: c.id } });
    }

    await prisma.productCache.deleteMany({
      where: { storeId: store.id, shopifyProductId: deletedGid },
    });

    // Create ActivityLog for DELETE (with deduplication & imageUrl)
    const imgUrl = cacheForLog?.imageUrl || payload.image?.src || payload.images?.[0]?.src || null;
    const existingLog = await prisma.activityLog.findFirst({
      where: {
        storeId: store.id,
        productId: String(payload.id),
        eventType: "DELETE",
        createdAt: { gte: new Date(Date.now() - 60000) }
      }
    });
    if (!existingLog) {
      await prisma.activityLog.create({
        data: {
          storeId: store.id,
          productId: String(payload.id),
          productTitle: productTitle,
          sku: cacheForLog?.sku || null,
          imageUrl: imgUrl,
          eventType: "DELETE",
          description: `Product "${productTitle}" removed from catalog`,
        },
      });
    }

    // Store receives its own Product Deleted notification
    await createNotification({
      recipientStoreId: store.id,
      type: 'PRODUCT_UPDATED',
      title: 'Product Deleted',
      message: `Product "${productTitle}" was deleted from catalog`,
      productId: String(payload.id),
      productTitle: productTitle,
      sourceStoreId: store.id,
      targetStoreId: store.id,
    });

    // Only notify Master store if the product was actually synced/mapped across the network and not standalone
    if (mappedVariantsCount > 0 && !isStandalone) {
      const masterStore = await prisma.store.findFirst({
        where: { isMaster: true, isActive: true }
      });
      if (masterStore && masterStore.id !== store.id) {
        await createNotification({
          recipientStoreId: masterStore.id,
          type: 'CONNECTED_STORE_UPDATE',
          title: 'Connected Store Product Deleted',
          message: `${store.label || store.shopDomain} deleted product "${productTitle}"`,
          productId: String(payload.id),
          productTitle: productTitle,
          sourceStoreId: store.id,
          targetStoreId: masterStore.id,
        });
      }
    }
    return;
  }

  // Loop prevention: check if this is an internally triggered sync deletion
  const productGid = `gid://shopify/Product/${payload.id}`;
  if (hasSyncLock(shop, productGid, "DELETE")) {
    console.log(`[Worker:products/delete] Ignored internally triggered deletion to prevent loop for ${shop} (Product ID: ${payload.id})`);
    releaseSyncLock(shop, productGid, "DELETE");
    return;
  }

  // Fetch cache for logging BEFORE processProductDelete wipes it out
  const deletedGid = `gid://shopify/Product/${payload.id}`;
  const cacheForLog = await prisma.productCache.findFirst({
    where: {
      OR: [
        { storeId: store?.id, shopifyProductId: deletedGid },
        { storeId: store?.id, shopifyProductId: String(payload.id) },
        { shopifyProductId: deletedGid },
        { shopifyProductId: String(payload.id) },
      ]
    },
    include: { collections: { include: { collection: true } } }
  });

  let productTitle = cacheForLog?.title || payload.title;
  if (!productTitle || productTitle === 'Deleted Product' || productTitle === 'Unknown Product') {
    const pastLog = await prisma.activityLog.findFirst({
      where: {
        productId: { in: [String(payload.id), deletedGid] }
      },
      orderBy: { createdAt: 'desc' },
      select: { productTitle: true }
    });
    if (pastLog?.productTitle && pastLog.productTitle !== 'Deleted Product' && pastLog.productTitle !== 'Unknown Product') {
      productTitle = pastLog.productTitle;
    }
  }

  if (!productTitle || productTitle === 'Deleted Product' || productTitle === 'Unknown Product') {
    productTitle = payload.title || `Product #${payload.id}`;
  }

  const productSku = cacheForLog?.sku || null;
  const collectionStr = cacheForLog?.collections?.map((c: any) => c.collection.title).join(', ') || null;

  if (store) {
    const imgUrl = cacheForLog?.imageUrl || payload.image?.src || payload.images?.[0]?.src || null;
    const existingLog = await prisma.activityLog.findFirst({
      where: {
        storeId: store.id,
        productId: String(payload.id),
        eventType: "DELETE",
        createdAt: { gte: new Date(Date.now() - 60000) }
      }
    });
    if (!existingLog) {
      await prisma.activityLog.create({
        data: {
          storeId: store.id,
          productId: String(payload.id),
          productTitle: productTitle,
          sku: productSku,
          imageUrl: imgUrl,
          eventType: "DELETE",
          description: `Product "${productTitle}" removed from catalog`,
          collection: collectionStr,
        }
      });
    }

    // Create notification for Product Deleted
    if (!store.isMaster) {
      const masterStore = await prisma.store.findFirst({
        where: { isMaster: true, isActive: true }
      });
      if (masterStore) {
        await createNotification({
          recipientStoreId: masterStore.id,
          type: 'CONNECTED_STORE_UPDATE',
          title: 'Connected Store Product Deleted',
          message: `${store.label || store.shopDomain} deleted product "${productTitle}"`,
          productId: String(payload.id),
          productTitle: productTitle,
          sourceStoreId: store.id,
          targetStoreId: masterStore.id,
        });
      }
    } else {
      await createNotification({
        recipientStoreId: store.id,
        type: 'PRODUCT_UPDATED',
        title: 'Product Deleted',
        message: `Product "${productTitle}" was deleted from catalog`,
        productId: String(payload.id),
        productTitle: productTitle,
        sourceStoreId: store.id,
        targetStoreId: store.id,
      });
    }
  }

  // Replicate deletion to target stores
  const { processProductDelete } = require('@/services/shopify/product-sync');
  await processProductDelete(shop, payload, webhookId);

  // Delete the Mapping
  if (store) {
    const { deleteMappingsForProduct } = require('@/services/product-mapping');
    const deleted = await deleteMappingsForProduct(store.id, String(payload.id));
    if (!deleted) {
      console.warn(`[Worker:products/delete] Warning: Mapping not found to delete for product ${payload.id}`);
    }
  }

  console.log(`[Worker:products/delete] sync complete for ${shop}`);

  await prisma.variantMap.deleteMany({
    where: { storeId: store?.id, shopifyProductId: deletedGid },
  });

  const masterCaches = await prisma.productCache.findMany({
    where: { storeId: store?.id, shopifyProductId: deletedGid },
    select: { id: true }
  });
  for (const mc of masterCaches) {
    await prisma.collectionProduct.deleteMany({ where: { productCacheId: mc.id } });
  }

  await prisma.productCache.deleteMany({
    where: { storeId: store?.id, shopifyProductId: deletedGid },
  });
  console.log(`[Worker:products/delete] Cleaned up local cache for Master Store: ${shop}`);
}

async function handleInventoryUpdate(shop: string, payload: any, webhookId: string) {
  const { inventory_item_id, location_id, available } = payload;

  if (!inventory_item_id || !location_id || typeof available !== 'number') {
    throw new Error(`Invalid payload for ${shop}`);
  }

  const storeRecord = await prisma.store.findUnique({
    where: { shopDomain: shop },
  });

  if (!storeRecord) return;

  // 1. RICH SYNC LOCK CHECK (ECHO PREVENTION)
  const { hasRichSyncLock, releaseRichSyncLock } = require('@/services/shopify/locks');
  if (hasRichSyncLock(shop, String(inventory_item_id), available)) {
    console.log(`[WebhookWorker:Ignored] WebhookId: ${webhookId} | Reason: sync_echo for ${shop} (Item: ${inventory_item_id}, Stock: ${available})`);
    releaseRichSyncLock(shop, String(inventory_item_id), available);

    // Update local cache quietly
    const inventoryGid = `gid://shopify/InventoryItem/${inventory_item_id}`;
    const vMap = await prisma.variantMap.findFirst({
      where: { storeId: storeRecord.id, OR: [{ inventoryItemId: inventoryGid }, { inventoryItemId: String(inventory_item_id) }] }
    });
    if (vMap?.shopifyVariantId) {
      await prisma.productCache.updateMany({
        where: { storeId: storeRecord.id, shopifyVariantId: vMap.shopifyVariantId },
        data: { inventoryQuantity: available }
      });
    }
    return;
  }

  let previousQuantity: number | null = null;
  let variantMap: any = null;
  let cache: any = null;

  const inventoryGid = `gid://shopify/InventoryItem/${inventory_item_id}`;
  variantMap = await prisma.variantMap.findFirst({
    where: {
      storeId: storeRecord.id,
      OR: [
        { inventoryItemId: inventoryGid },
        { inventoryItemId: String(inventory_item_id) },
      ]
    },
  });

  if (variantMap && variantMap.shopifyVariantId) {
    cache = await prisma.productCache.findFirst({
      where: { storeId: storeRecord.id, shopifyVariantId: variantMap.shopifyVariantId }
    });
  }

  if (!cache) {
    const pMapping = await prisma.productMapping.findFirst({
      where: {
        storeId: storeRecord.id,
        OR: [
          { inventoryItemId: inventoryGid },
          { inventoryItemId: String(inventory_item_id) },
        ]
      }
    });
    if (pMapping) {
      cache = await prisma.productCache.findFirst({
        where: { storeId: storeRecord.id, shopifyVariantId: pMapping.shopifyVariantId }
      });
    }
  }

  if (cache) {
    previousQuantity = cache.inventoryQuantity;
  }

  const isStandalone = !storeRecord.isMaster &&
    (await prisma.storeConnection.count({
      where: {
        OR: [
          { sourceStoreId: storeRecord.id },
          { targetStoreId: storeRecord.id }
        ]
      }
    })) === 0;

  if (!isStandalone) {
    const { processInventoryUpdate } = require('@/services/shopify/inventory-sync');
    await processInventoryUpdate(
      shop,
      inventory_item_id.toString(),
      location_id.toString(),
      available,
      webhookId
    );
  } else if (cache) {
    await prisma.productCache.updateMany({
      where: { id: cache.id },
      data: { inventoryQuantity: available }
    });
  }

  if (storeRecord && cache) {
    const prevQty = previousQuantity !== null ? previousQuantity : available;
    const diff = available - prevQty;
    const prodId = cache.shopifyProductId?.split('/').pop() || '';
    const prodTitle = cache.title || 'Product';
    const prodSku = cache.sku || variantMap?.sku || null;

    if (diff !== 0) {
      const isSale = diff < 0;
      const eventType = isSale ? "SOLD" : "UPDATE";
      const description = isSale
        ? `${Math.abs(diff)} item(s) sold (New stock: ${available})`
        : `Inventory manually adjusted by +${diff} (New stock: ${available})`;

      // Create ActivityLog ONLY for originating store (with deduplication & imageUrl)
      const imgUrl = cache?.imageUrl || null;
      const existingLog = await prisma.activityLog.findFirst({
        where: {
          storeId: storeRecord.id,
          productId: prodId,
          eventType: eventType as any,
          createdAt: { gte: new Date(Date.now() - 30000) }
        }
      });
      if (!existingLog) {
        await prisma.activityLog.create({
          data: {
            storeId: storeRecord.id,
            productId: prodId,
            productTitle: prodTitle,
            sku: prodSku,
            imageUrl: imgUrl,
            eventType: eventType as any,
            description: description,
            quantity: Math.abs(diff)
          }
        });
      }

      // Create notification for Product Sold / Inventory Adjustment
      if (isSale) {
        await createNotification({
          recipientStoreId: storeRecord.id,
          type: 'INVENTORY_UPDATE',
          title: 'Product Sold',
          message: `${prodTitle} - ${Math.abs(diff)} item(s) sold (New stock: ${available})`,
          productId: prodId,
          productTitle: prodTitle,
          sourceStoreId: storeRecord.id,
          targetStoreId: storeRecord.id,
        });

        if (!storeRecord.isMaster && !isStandalone) {
          const masterStore = await prisma.store.findFirst({
            where: { isMaster: true, isActive: true }
          });
          if (masterStore && masterStore.id !== storeRecord.id) {
            await createNotification({
              recipientStoreId: masterStore.id,
              type: 'CONNECTED_STORE_UPDATE',
              title: 'Connected Store Product Sold',
              message: `${storeRecord.label || storeRecord.shopDomain}: ${prodTitle} - ${Math.abs(diff)} item(s) sold (New stock: ${available})`,
              productId: prodId,
              productTitle: prodTitle,
              sourceStoreId: storeRecord.id,
              targetStoreId: masterStore.id,
            });
          }
        }
      } else {
        await createNotification({
          recipientStoreId: storeRecord.id,
          type: 'INVENTORY_UPDATE',
          title: 'Inventory Adjusted',
          message: `${prodTitle} - Stock adjusted by +${diff} (New stock: ${available})`,
          productId: prodId,
          productTitle: prodTitle,
          sourceStoreId: storeRecord.id,
          targetStoreId: storeRecord.id,
        });
      }
    }

    // STATE TRANSITION ALERTS
    // OUT_OF_STOCK: Trigger whenever stock reaches 0 (anti-spam guarded by NotificationService)
    if (available === 0) {
      await createNotification({
        recipientStoreId: storeRecord.id,
        type: 'OUT_OF_STOCK',
        title: 'Out of Stock Alert',
        message: `${prodTitle} is completely out of stock (0 units remaining)`,
        productId: prodId,
        productTitle: prodTitle,
        sourceStoreId: storeRecord.id,
      });

      if (!storeRecord.isMaster && !isStandalone) {
        const masterStore = await prisma.store.findFirst({
          where: { isMaster: true, isActive: true }
        });
        if (masterStore && masterStore.id !== storeRecord.id) {
          await createNotification({
            recipientStoreId: masterStore.id,
            type: 'OUT_OF_STOCK',
            title: 'Out of Stock Alert',
            message: `${storeRecord.label || storeRecord.shopDomain}: ${prodTitle} is completely out of stock`,
            productId: prodId,
            productTitle: prodTitle,
            sourceStoreId: storeRecord.id,
            targetStoreId: masterStore.id,
          });
        }
      }
    }
    // LOW_STOCK: Trigger whenever stock is <= lowStockThreshold and > 0
    else if (available > 0 && available <= storeRecord.lowStockThreshold) {
      await createNotification({
        recipientStoreId: storeRecord.id,
        type: 'LOW_STOCK',
        title: 'Low Stock Alert',
        message: `${prodTitle} has ${available} unit${available === 1 ? '' : 's'} remaining (Threshold: ${storeRecord.lowStockThreshold})`,
        productId: prodId,
        productTitle: prodTitle,
        sourceStoreId: storeRecord.id,
      });

      if (!storeRecord.isMaster && !isStandalone) {
        const masterStore = await prisma.store.findFirst({
          where: { isMaster: true, isActive: true }
        });
        if (masterStore && masterStore.id !== storeRecord.id) {
          await createNotification({
            recipientStoreId: masterStore.id,
            type: 'LOW_STOCK',
            title: 'Low Stock Alert',
            message: `${storeRecord.label || storeRecord.shopDomain}: ${prodTitle} has ${available} unit${available === 1 ? '' : 's'} remaining (Threshold: ${storeRecord.lowStockThreshold})`,
            productId: prodId,
            productTitle: prodTitle,
            sourceStoreId: storeRecord.id,
            targetStoreId: masterStore.id,
          });
        }
      }
    }
  }
}
