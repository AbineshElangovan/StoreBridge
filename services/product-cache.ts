import { prisma } from '@/lib/db/prisma';
import { getAdminClient } from '@/lib/shopify/admin';
import { GET_PRODUCT_COLLECTIONS_QUERY } from '@/services/shopify/graphql';
import { syncProductCollectionsByTags } from '@/services/shopify/collection-sync';
import { findTargetProductBySku } from '@/services/shopify/api-helpers';

export async function updateLocalProductCache(shopDomain: string, payload: any, topic?: string) {
  try {
    const store = await prisma.store.findUnique({
      where: { shopDomain },
    });

    if (!store) return;

    const shopifyProductId = `gid://shopify/Product/${payload.id}`;

    if (!store.isActive) {
      console.log(`[ProductSync:Cache] Store ${shopDomain} not found or inactive. Skipping cache update.`);
      return;
    }

    const variants = payload.variants || [];
    console.log(`[ProductSync:Cache] Processing ${variants.length} variants for ${shopDomain}`);
    const syncedVariantIds: string[] = [];

    for (const variant of variants) {
      console.log(`[ProductSync:Cache] Variant ID: ${variant.id}, SKU: ${variant.sku}`);
      
      const fullTitle = variant.title && variant.title !== 'Default Title' 
        ? `${payload.title} - ${variant.title}` 
        : payload.title;
        
      const sku = variant.sku?.trim() || null;
      const shopifyVariantId = `gid://shopify/ProductVariant/${variant.id}`;
      const inventoryItemId = `gid://shopify/InventoryItem/${variant.inventory_item_id}`;

      syncedVariantIds.push(shopifyVariantId);

      const existingMap = await prisma.variantMap.findUnique({
        where: {
          storeId_shopifyVariantId: {
            storeId: store.id,
            shopifyVariantId,
          },
        },
      });

      const newImageUrl = payload.image?.src 
        || payload.images?.[0]?.src 
        || payload.image?.url 
        || payload.featuredImage?.url 
        || payload.images?.edges?.[0]?.node?.url 
        || payload.images?.nodes?.[0]?.url 
        || null;

      const existingCache = await prisma.productCache.findUnique({
        where: {
          storeId_shopifyVariantId: {
            storeId: store.id,
            shopifyVariantId,
          },
        },
      });

      let resolvedImageUrl = newImageUrl || existingCache?.imageUrl || null;
      if (!resolvedImageUrl) {
        const sibling = await prisma.productCache.findFirst({
          where: { storeId: store.id, shopifyProductId, imageUrl: { not: null } },
          select: { imageUrl: true }
        });
        if (sibling?.imageUrl) {
          resolvedImageUrl = sibling.imageUrl;
        }
      }

      const parsedPrice = parseFloat(variant.price || "0");
      
      // Price Matching Validation for Permanent Base Price
      let parsedBasePrice = parsedPrice; // Default to new price (manual update or new product)
      if (existingCache) {
        if (existingCache.price === parsedPrice) {
          // MATCH! StoreBridge expected this price update. Retain the existing permanent base price.
          parsedBasePrice = existingCache.basePrice;
        } else {
          // MISMATCH! Merchant manually changed the price in Shopify. Treat as new permanent base price.
          parsedBasePrice = parsedPrice;
        }
      }
      const trueInventory = variant.inventory_quantity ?? 0;

      let finalSku = sku;
      // Prevent stale webhooks/GraphQL from wiping out a successfully generated SKU
      if (!finalSku && existingCache && existingCache.sku && existingCache.sku !== 'N/A') {
        finalSku = existingCache.sku;
      }

      const productTags = payload.tags || null;

      if (!existingCache) {
        await prisma.productCache.create({
          data: {
            storeId: store.id,
            shopifyProductId,
            shopifyVariantId,
            sku: finalSku,
            title: fullTitle,
            tags: productTags,
            imageUrl: resolvedImageUrl,
            inventoryQuantity: trueInventory,
            price: parsedPrice,
            basePrice: parsedBasePrice,
          }
        });
      } else {
        const prevQty = existingCache.inventoryQuantity ?? 0;
        const needsUpdate = existingCache.sku !== finalSku ||
          existingCache.title !== fullTitle ||
          existingCache.price !== parsedPrice ||
          existingCache.basePrice !== parsedBasePrice ||
          existingCache.tags !== productTags ||
          existingCache.inventoryQuantity !== trueInventory ||
          (resolvedImageUrl !== null && existingCache.imageUrl !== resolvedImageUrl);

        if (needsUpdate) {
          await prisma.productCache.update({
            where: { id: existingCache.id },
            data: {
              sku: finalSku,
              title: fullTitle,
              tags: productTags,
              ...(resolvedImageUrl !== null ? { imageUrl: resolvedImageUrl } : {}),
              shopifyProductId,
              inventoryQuantity: trueInventory,
              price: parsedPrice,
              basePrice: parsedBasePrice,
            },
          });
        }

        // TRIGGER BACK IN STOCK: When variant transitions to positive stock
        if (trueInventory > 0) {
          try {
            const { BackInStockService } = require('@/services/back-in-stock/back-in-stock-service');
            await BackInStockService.processBackInStock({
              storeId: store.id,
              shopifyProductId,
              shopifyVariantId,
              available: trueInventory,
              productTitle: fullTitle,
              imageUrl: resolvedImageUrl,
            });
          } catch (bisErr: any) {
            console.error('[ProductCache:BackInStock] Restock trigger error:', bisErr.message);
          }
        }
      }

      await prisma.variantMap.upsert({
        where: {
          storeId_shopifyVariantId: {
            storeId: store.id,
            shopifyVariantId,
          },
        },
        update: {
          sku: sku || '',
          shopifyProductId,
          inventoryItemId,
          locationId: existingMap?.locationId || null,
        },
        create: {
          storeId: store.id,
          sku: sku || '',
          shopifyProductId,
          shopifyVariantId,
          inventoryItemId,
          locationId: null,
        },
      });
    }

    if (variants.length > 0) {
      const staleCaches = await prisma.productCache.findMany({
        where: {
          storeId: store.id,
          shopifyProductId,
          shopifyVariantId: { notIn: syncedVariantIds },
        },
        select: { id: true }
      });
      for (const sc of staleCaches) {
        await prisma.collectionProduct.deleteMany({ where: { productCacheId: sc.id } });
      }

      await prisma.productCache.deleteMany({
        where: {
          storeId: store.id,
          shopifyProductId,
          shopifyVariantId: { notIn: syncedVariantIds },
        },
      });

      await prisma.variantMap.deleteMany({
        where: {
          storeId: store.id,
          shopifyProductId,
          shopifyVariantId: { notIn: syncedVariantIds },
        },
      });
    }

    try {
      // First ensure tags are properly mapped to collections in Shopify
      if (payload.tags) {
        await syncProductCollectionsByTags(shopDomain, shopifyProductId, payload.tags);
      }

      const client = await getAdminClient(shopDomain);
      const productResponse: any = await client.request(GET_PRODUCT_COLLECTIONS_QUERY, {
        variables: { id: shopifyProductId }
      });
      const existingEdges = productResponse?.data?.product?.collections?.edges || [];
      const productCollectionDbIds: string[] = [];

      for (const edge of existingEdges) {
        if (edge.node) {
          const col = edge.node;
          const dbCol = await prisma.collection.upsert({
            where: {
              storeId_shopifyCollectionId: {
                storeId: store.id,
                shopifyCollectionId: col.id,
              },
            },
            update: { title: col.title, handle: col.handle },
            create: { storeId: store.id, shopifyCollectionId: col.id, title: col.title, handle: col.handle },
          });
          productCollectionDbIds.push(dbCol.id);
        }
      }

      const allCaches = await prisma.productCache.findMany({
        where: { storeId: store.id, shopifyProductId },
      });

      for (const cache of allCaches) {
        for (const collectionDbId of productCollectionDbIds) {
          await prisma.collectionProduct.upsert({
            where: {
              collectionId_productCacheId: {
                collectionId: collectionDbId,
                productCacheId: cache.id,
              },
            },
            update: {},
            create: { collectionId: collectionDbId, productCacheId: cache.id },
          });
        }
        await prisma.collectionProduct.deleteMany({
          where: {
            productCacheId: cache.id,
            collectionId: { notIn: productCollectionDbIds },
          },
        });
      }
    } catch (colErr: any) {
      console.error(`[ProductSync:Cache] Failed to sync collections to DB for ${shopDomain}:`, colErr.message);
    }

    console.log(`[ProductSync:Cache] Successfully updated local cache for product ${payload.title} in ${shopDomain}`);
  } catch (error: any) {
    console.error(`[ProductSync:Cache] Failed to update local cache for ${shopDomain}:`, error.message);
  }
}