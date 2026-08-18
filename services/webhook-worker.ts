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

      // 2. Lock the job (Transaction to prevent double processing)
      // We update it to PROCESSING. If another worker already took it, this will fail or return 0 records.
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

      console.log(`[WebhookWorker] Processing job ${job.id} | Topic: ${job.topic} | Store: ${job.shopDomain}`);

      // 3. Process the job
      try {
        const payload = job.payload as any;

        // Route the job to the correct handler based on topic
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

        console.log(`[WebhookWorker] Successfully completed job ${job.id} in ${duration}ms.`);
        processedCount++;

      } catch (error: any) {
        // 5. Handle Failure and Retries
        const duration = Date.now() - startTime;
        const newAttempts = job.attempts + 1; // We already incremented once during lock
        const isFinalFailure = newAttempts >= MAX_RETRIES;
        const nextStatus = isFinalFailure ? WebhookStatus.FAILED : WebhookStatus.PENDING;

        await prisma.webhookQueue.update({
          where: { id: job.id },
          data: {
            status: nextStatus,
            error: `${error.message}\n${error.stack || ''}`
          }
        });

        console.error(`[WebhookWorker] Job ${job.id} failed (Attempt ${newAttempts}/${MAX_RETRIES}) in ${duration}ms. Error: ${error.message}`);

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

    // Create ActivityLog for this store
    await prisma.activityLog.create({
      data: {
        storeId: store.id,
        productId: String(payload.id),
        productTitle: payload.title || "Unknown Product",
        sku: sku,
        eventType: "CREATE",
        description: `Product created with ${payload.variants?.length || 1} variants`,
        collection: collectionStr,
      },
    });

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

      const connections = await prisma.storeConnection.findMany({
        where: { sourceStoreId: storeRecord.id }
      });
      const allStoreIds = [storeRecord.id, ...connections.map(c => c.targetStoreId)];

      const activities = await Promise.all(
        allStoreIds.map(id =>
          prisma.activityLog.create({
            data: {
              storeId: id,
              productId: String(enrichedPayload.id),
              productTitle: enrichedPayload.title || "Unknown Product",
              sku: sku,
              eventType: "CREATE",
              description: `Product created with ${enrichedPayload.variants?.length || 1} variants`,
              collection: collectionStr,
            },
            include: {
              store: { select: { id: true, label: true, shopDomain: true, isMaster: true } }
            }
          })
        )
      );

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

  if (!store.isMaster) {
    console.log(`[Worker:products/update] Processing ${isStandalone ? 'Standalone' : 'Sub'} Store product update: ${shop}`);
    
    // 1. Fetch previous cache
    const productCache = await prisma.productCache.findFirst({
      where: { storeId: store.id, shopifyProductId: `gid://shopify/Product/${payload.id}` },
    });

    // 2. Update local cache for Store
    await updateLocalProductCache(shop, payload, 'products/update');

    // 3. Create ActivityLog
    const sku = payload.variants?.[0]?.sku || null;
    await prisma.activityLog.create({
      data: {
        storeId: store.id,
        productId: String(payload.id),
        productTitle: payload.title || "Unknown Product",
        sku: sku,
        eventType: "UPDATE",
        description: `Product updated in catalog`,
      },
    });

    // 4. Check price changed vs product details changed
    const oldPrice = productCache?.price;
    const newPrice = payload.variants?.[0]?.price ? parseFloat(payload.variants[0].price) : null;
    const isPriceChanged = oldPrice !== null && newPrice !== null && oldPrice !== newPrice;

    if (isPriceChanged) {
      // Store receives Price Update
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
      // Store receives Product Update
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

    // 5. Master Store receives CONNECTED_STORE_UPDATE only if connected
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

    // 6. Check out of stock vs low stock for Store
    if (payload.variants && Array.isArray(payload.variants)) {
      for (const variant of payload.variants) {
        const qty = variant.inventory_quantity;
        if (typeof qty === 'number') {
          if (qty === 0) {
            await createNotification({
              recipientStoreId: store.id,
              type: 'OUT_OF_STOCK',
              title: 'Out of Stock Alert',
              message: `${payload.title} is completely out of stock (0 units remaining)`,
              productId: String(payload.id),
              productTitle: payload.title,
              sourceStoreId: store.id,
            });
            if (!isStandalone) {
              const masterStore = await prisma.store.findFirst({
                where: { isMaster: true, isActive: true }
              });
              if (masterStore && masterStore.id !== store.id) {
                await createNotification({
                  recipientStoreId: masterStore.id,
                  type: 'OUT_OF_STOCK',
                  title: 'Out of Stock Alert',
                  message: `${store.label || store.shopDomain}: ${payload.title} is completely out of stock`,
                  productId: String(payload.id),
                  productTitle: payload.title,
                  sourceStoreId: store.id,
                  targetStoreId: masterStore.id,
                });
              }
            }
          } else if (qty > 0 && qty <= store.lowStockThreshold) {
            await createNotification({
              recipientStoreId: store.id,
              type: 'LOW_STOCK',
              title: 'Low Stock Alert',
              message: `${payload.title} has ${qty} unit${qty === 1 ? '' : 's'} remaining (Threshold: ${store.lowStockThreshold})`,
              productId: String(payload.id),
              productTitle: payload.title,
              sourceStoreId: store.id,
            });
            if (!isStandalone) {
              const masterStore = await prisma.store.findFirst({
                where: { isMaster: true, isActive: true }
              });
              if (masterStore && masterStore.id !== store.id) {
                await createNotification({
                  recipientStoreId: masterStore.id,
                  type: 'LOW_STOCK',
                  title: 'Low Stock Alert',
                  message: `${store.label || store.shopDomain}: ${payload.title} has ${qty} unit${qty === 1 ? '' : 's'} remaining (Threshold: ${store.lowStockThreshold})`,
                  productId: String(payload.id),
                  productTitle: payload.title,
                  sourceStoreId: store.id,
                  targetStoreId: masterStore.id,
                });
              }
            }
          }
        }
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

    await updateLocalProductCache(shop, currentPayload, 'products/update'); // Pass topic if required
    await processProductUpdate(shop, currentPayload, webhookId);

    // Verify Product Mapping exists for all variants
    const storeRecord = await prisma.store.findUnique({ where: { shopDomain: shop } });
    if (storeRecord && currentPayload.variants) {
      for (const variant of currentPayload.variants) {
        const variantIdStr = variant.admin_graphql_api_id?.split('/').pop() || String(variant.id);
        const mapping = await findMappingByVariantId(storeRecord.id, variantIdStr);
        if (!mapping) {
          throw new Error(`Data Inconsistency: Mapping missing for variant ${variantIdStr}`);
        }
      }

      // Create ActivityLog for UPDATE
      if (storeRecord) {
        const sku = currentPayload.variants?.[0]?.sku || null;

        const productCache = await prisma.productCache.findFirst({
          where: { storeId: storeRecord.id, shopifyProductId: `gid://shopify/Product/${currentPayload.id}` },
          include: { collections: { include: { collection: true } } }
        });
        const collectionStr = productCache?.collections?.map((c: any) => c.collection.title).join(', ') || null;

        const connections = await prisma.storeConnection.findMany({
          where: { sourceStoreId: storeRecord.id }
        });
        const allStoreIds = [storeRecord.id, ...connections.map(c => c.targetStoreId)];

        const activities = await Promise.all(
          allStoreIds.map(id =>
            prisma.activityLog.create({
              data: {
                storeId: id,
                productId: String(currentPayload.id),
                productTitle: currentPayload.title || "Unknown Product",
                sku: sku,
                eventType: "UPDATE",
                description: `Product details or inventory updated`,
                collection: collectionStr,
              },
              include: {
                store: { select: { id: true, label: true, shopDomain: true, isMaster: true } }
              }
            })
          )
        );

        // 1. Check if price changed vs product details changed
        const oldPrice = productCache?.price;
        const newPrice = currentPayload.variants?.[0]?.price ? parseFloat(currentPayload.variants[0].price) : null;
        const isPriceChanged = oldPrice !== null && newPrice !== null && oldPrice !== newPrice;

        if (isPriceChanged) {
          // Rule: If price changes -> ONLY create Price Update notification (never duplicate with Product Update)
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
          // Title / description / SKU / variant changed -> Product Update
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

        // 2. If update occurred on a Connected Store, notify the Master Store
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

        // 3. Check for Out of Stock vs Low Stock on variants
        if (currentPayload.variants && Array.isArray(currentPayload.variants)) {
          for (const variant of currentPayload.variants) {
            const qty = variant.inventory_quantity;
            if (typeof qty === 'number') {
              if (qty === 0) {
                // Out of Stock (quantity === 0)
                await createNotification({
                  recipientStoreId: storeRecord.id,
                  type: 'OUT_OF_STOCK',
                  title: 'Out of Stock Alert',
                  message: `${currentPayload.title} is completely out of stock (0 units remaining)`,
                  productId: String(currentPayload.id),
                  productTitle: currentPayload.title,
                  sourceStoreId: storeRecord.id,
                });

                if (!storeRecord.isMaster) {
                  const masterStore = await prisma.store.findFirst({
                    where: { isMaster: true, isActive: true }
                  });
                  if (masterStore) {
                    await createNotification({
                      recipientStoreId: masterStore.id,
                      type: 'OUT_OF_STOCK',
                      title: 'Out of Stock Alert',
                      message: `${storeRecord.label || storeRecord.shopDomain}: ${currentPayload.title} is completely out of stock`,
                      productId: String(currentPayload.id),
                      productTitle: currentPayload.title,
                      sourceStoreId: storeRecord.id,
                      targetStoreId: masterStore.id,
                    });
                  }
                }
              } else if (qty > 0 && qty <= storeRecord.lowStockThreshold) {
                // Low Stock (quantity > 0 && quantity <= threshold)
                await createNotification({
                  recipientStoreId: storeRecord.id,
                  type: 'LOW_STOCK',
                  title: 'Low Stock Alert',
                  message: `${currentPayload.title} has ${qty} unit${qty === 1 ? '' : 's'} remaining (Threshold: ${storeRecord.lowStockThreshold})`,
                  productId: String(currentPayload.id),
                  productTitle: currentPayload.title,
                  sourceStoreId: storeRecord.id,
                });

                if (!storeRecord.isMaster) {
                  const masterStore = await prisma.store.findFirst({
                    where: { isMaster: true, isActive: true }
                  });
                  if (masterStore) {
                    await createNotification({
                      recipientStoreId: masterStore.id,
                      type: 'LOW_STOCK',
                      title: 'Low Stock Alert',
                      message: `${storeRecord.label || storeRecord.shopDomain}: ${currentPayload.title} has ${qty} unit${qty === 1 ? '' : 's'} remaining (Threshold: ${storeRecord.lowStockThreshold})`,
                      productId: String(currentPayload.id),
                      productTitle: currentPayload.title,
                      sourceStoreId: storeRecord.id,
                      targetStoreId: masterStore.id,
                    });
                  }
                }
              }
            }
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
      where: { storeId: store.id, shopifyProductId: deletedGid },
      select: { title: true }
    });
    const productTitle = cacheForLog?.title || payload.title || "Deleted Product";

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

    // Create ActivityLog for DELETE
    await prisma.activityLog.create({
      data: {
        storeId: store.id,
        productId: String(payload.id),
        productTitle: productTitle,
        eventType: "DELETE",
        description: `Product removed from catalog`,
      },
    });

    // Store receives its own Product Deleted notification
    await createNotification({
      recipientStoreId: store.id,
      type: 'PRODUCT_UPDATED',
      title: 'Product Deleted',
      message: `Product ${productTitle} was deleted from catalog`,
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
          message: `${store.label || store.shopDomain} deleted product ${productTitle}`,
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
    where: { storeId: store?.id, shopifyProductId: deletedGid },
    include: { collections: { include: { collection: true } } }
  });

  const productTitle = cacheForLog?.title || `Product ${payload.id}`;
  const productSku = cacheForLog?.sku || null;
  const collectionStr = cacheForLog?.collections?.map((c: any) => c.collection.title).join(', ') || null;

  if (store) {
    const connections = await prisma.storeConnection.findMany({
      where: { sourceStoreId: store.id }
    });
    const allStoreIds = [store.id, ...connections.map(c => c.targetStoreId)];

    const activities = await Promise.all(
      allStoreIds.map(id =>
        prisma.activityLog.create({
          data: {
            storeId: id,
            productId: String(payload.id),
            productTitle: productTitle,
            sku: productSku,
            eventType: "DELETE",
            description: `Product removed from catalog`,
            collection: collectionStr,
          },
          include: {
            store: { select: { id: true, label: true, shopDomain: true, isMaster: true } }
          }
        })
      )
    );

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
          message: `${store.label || store.shopDomain} deleted product ${productTitle}`,
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
        message: `Product ${productTitle} was deleted from catalog`,
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

  let previousQuantity: number | null = null;
  let variantMap: any = null;
  let cache: any = null;

  if (storeRecord) {
    // Attempt to find product info from variant map or product mapping
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
  }

  const isStandalone = storeRecord && !storeRecord.isMaster &&
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
    // Update local cache for standalone store
    await prisma.productCache.updateMany({
      where: { id: cache.id },
      data: { inventoryQuantity: available }
    });
  }

  if (storeRecord && cache) {
    const diff = previousQuantity !== null ? available - previousQuantity : 0;
    const prodId = cache.shopifyProductId?.split('/').pop() || '';
    const prodTitle = cache.title || 'Product';
    const prodSku = cache.sku || variantMap?.sku || null;

    if (diff !== 0) {
      let allStoreIds = [storeRecord.id];
      if (!isStandalone) {
        if (storeRecord.isMaster) {
          const connections = await prisma.storeConnection.findMany({
            where: { sourceStoreId: storeRecord.id }
          });
          allStoreIds = [storeRecord.id, ...connections.map(c => c.targetStoreId)];
        } else {
          const masterConn = await prisma.storeConnection.findFirst({
            where: { targetStoreId: storeRecord.id }
          });
          if (masterConn) {
            const siblingConns = await prisma.storeConnection.findMany({
              where: { sourceStoreId: masterConn.sourceStoreId }
            });
            allStoreIds = Array.from(new Set([
              storeRecord.id,
              masterConn.sourceStoreId,
              ...siblingConns.map(c => c.targetStoreId)
            ]));
          }
        }
      }

      const isSale = diff < 0;
      const eventType = isSale ? "SOLD" : "UPDATE";
      const description = isSale
        ? `${Math.abs(diff)} item(s) sold (New stock: ${available})`
        : `Inventory manually adjusted by +${diff} (New stock: ${available})`;

      await Promise.all(
        allStoreIds.map(id =>
          prisma.activityLog.create({
            data: {
              storeId: id,
              productId: prodId,
              productTitle: prodTitle,
              sku: prodSku,
              eventType: eventType as any,
              description: description,
              quantity: Math.abs(diff)
            },
            include: {
              store: { select: { id: true, label: true, shopDomain: true, isMaster: true } }
            }
          })
        )
      );

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

    // Check OUT_OF_STOCK vs LOW_STOCK
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
    } else if (available > 0 && available <= storeRecord.lowStockThreshold) {
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
