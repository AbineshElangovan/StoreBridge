import { NextRequest, NextResponse } from "next/server";
import { authenticate, handleApiError } from "@/lib/shopify/authenticate";
import { prisma } from "@/lib/db/prisma";
import { getAdminClient } from "@/lib/shopify/admin";
import { createNotification } from "@/services/notification-service";
import { calculateAdjustedPrice } from "@/services/shopify/pricing";

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { store } = await authenticate(req);
    const { id: rawIdParam } = await params;
    const rawId = Array.isArray(rawIdParam) ? (rawIdParam as string[]).join('/') : (rawIdParam as string || '');
    const decodedId = decodeURIComponent(rawId).trim();
    
    // Extract numeric ID if rawId is a GID like "gid://shopify/Product/10304904134947" or "Gid%3A..."
    const cleanNumericId = decodedId
      .replace(/^gid:\/\/shopify\/Product\//i, '')
      .replace(/^gid%3a%2f%2fshopify%2fproduct%2f/i, '')
      .split('/')
      .pop() || decodedId;

    const hyphenatedId = decodedId.replace(/\s+/g, '-');
    const spaceId = decodedId.replace(/-/g, ' ');
    const lowerHyphenated = hyphenatedId.toLowerCase();
    const lowerDecoded = decodedId.toLowerCase();

    const matchConditions = [
      { id: decodedId },
      { id: lowerDecoded },
      { id: cleanNumericId },
      { id: hyphenatedId },
      { id: lowerHyphenated },
      { id: spaceId },
      { shopifyProductId: decodedId },
      { shopifyProductId: cleanNumericId },
      { shopifyProductId: `gid://shopify/Product/${cleanNumericId}` },
      { shopifyProductId: { endsWith: cleanNumericId } },
      { sku: decodedId },
      { sku: cleanNumericId },
      { sku: hyphenatedId },
      { sku: spaceId }
    ];

    // 1. Find target product by id, shopifyProductId, or SKU in current store
    let targetProduct = await prisma.productCache.findFirst({
      where: {
        storeId: store.id,
        OR: matchConditions
      },
      include: {
        store: true,
        collections: {
          include: {
            collection: true
          }
        }
      }
    });

    // 2. Fallback: Check authorized connected stores
    if (!targetProduct) {
      const connections = await (prisma as any).storeConnection.findMany({
        where: { sourceStoreId: store.id }
      });
      const authorizedStoreIds = [store.id, ...connections.map((c: any) => c.targetStoreId)];

      targetProduct = await prisma.productCache.findFirst({
        where: {
          storeId: { in: authorizedStoreIds },
          OR: matchConditions
        },
        include: {
          store: true,
          collections: {
            include: {
              collection: true
            }
          }
        }
      });
    }

    // 3. Global Fallback: Search across all store products in DB
    if (!targetProduct) {
      targetProduct = await prisma.productCache.findFirst({
        where: {
          OR: matchConditions
        },
        include: {
          store: true,
          collections: {
            include: {
              collection: true
            }
          }
        }
      });
    }

    if (!targetProduct) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }

    const { shopifyProductId, sku: productSku } = targetProduct;

    // 2. Fetch all variants belonging to this shopifyProductId in the store
    const variantsInDb = await prisma.productCache.findMany({
      where: {
        storeId: targetProduct.storeId,
        shopifyProductId: shopifyProductId
      },
      orderBy: { createdAt: 'asc' }
    });

    // 3. Authorized store availability scoping
    // Master & Connected stores -> show Master + connected sub-stores in network
    // Standalone stores (e.g. Namakkal) -> show ONLY that standalone store
    let networkMasterId: string | null = null;

    if (store.isMaster) {
      networkMasterId = store.id;
    } else if (targetProduct.store && targetProduct.store.isMaster) {
      networkMasterId = targetProduct.storeId;
    } else {
      const conn = await (prisma as any).storeConnection.findFirst({
        where: {
          OR: [
            { targetStoreId: store.id },
            { targetStoreId: targetProduct.storeId },
            { sourceStoreId: store.id },
            { sourceStoreId: targetProduct.storeId }
          ]
        }
      });
      if (conn) {
        networkMasterId = conn.sourceStoreId;
      }
    }

    let connectedTargetIds: string[] = [];
    if (networkMasterId) {
      const connections = await (prisma as any).storeConnection.findMany({
        where: { sourceStoreId: networkMasterId }
      });
      connectedTargetIds = connections.map((c: any) => c.targetStoreId);
    }

    const isNetworkConnected = Boolean(networkMasterId && connectedTargetIds.length > 0);

    const authorizedStoreIds = isNetworkConnected && networkMasterId 
      ? Array.from(new Set([networkMasterId, ...connectedTargetIds]))
      : [targetProduct.storeId || store.id];

    const authorizedStores = await prisma.store.findMany({
      where: { id: { in: authorizedStoreIds } },
      orderBy: { label: 'asc' }
    });

    // Fetch stock level for this product/SKU across each authorized store
    const allStoreProducts = await prisma.productCache.findMany({
      where: {
        storeId: { in: authorizedStoreIds },
        OR: [
          { shopifyProductId: shopifyProductId },
          ...(productSku ? [{ sku: productSku }] : [])
        ]
      }
    });

    const storeAvailabilityMap = new Map<string, { totalQty: number; lowStockThreshold: number }>();
    authorizedStores.forEach(s => {
      storeAvailabilityMap.set(s.id, { totalQty: 0, lowStockThreshold: s.lowStockThreshold || 15 });
    });

    allStoreProducts.forEach(p => {
      const existing = storeAvailabilityMap.get(p.storeId);
      if (existing) {
        existing.totalQty += p.inventoryQuantity;
      }
    });

    const storeAvailability = authorizedStores.map(s => {
      const data = storeAvailabilityMap.get(s.id) || { totalQty: 0, lowStockThreshold: s.lowStockThreshold || 15 };
      let healthStatus: 'Healthy' | 'Low' | 'Critical' | 'Out of Stock' = 'Healthy';
      if (data.totalQty <= 0) {
        healthStatus = 'Out of Stock';
      } else if (data.totalQty <= Math.floor(data.lowStockThreshold / 2)) {
        healthStatus = 'Critical';
      } else if (data.totalQty <= data.lowStockThreshold) {
        healthStatus = 'Low';
      }

      // Store gets MASTER badge ONLY if it is the master store in a connected network
      const isMasterDisplay = Boolean(isNetworkConnected && networkMasterId && s.id === networkMasterId);

      return {
        storeId: s.id,
        storeName: s.label || s.shopDomain,
        quantity: data.totalQty,
        healthStatus,
        isMaster: isMasterDisplay
      };
    });

    // 4. Calculate Sales Performance metrics from ActivityLog & SyncLog
    const skuList = variantsInDb.map(v => v.sku).filter(Boolean) as string[];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activityLogs = await prisma.activityLog.findMany({
      where: {
        storeId: { in: authorizedStoreIds },
        createdAt: { gte: thirtyDaysAgo },
        OR: [
          { productTitle: targetProduct.title },
          ...(skuList.length > 0 ? [{ sku: { in: skuList } }] : [])
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    let unitsSold = 0;
    let revenue = 0;
    let lastSaleDate: any = null;

    activityLogs.forEach(log => {
      if (log.eventType === 'SOLD') {
        const qty = log.quantity || 1;
        const amt = log.amount || (targetProduct.price * qty);
        unitsSold += qty;
        revenue += amt;
        if (!lastSaleDate || log.createdAt > lastSaleDate) {
          lastSaleDate = log.createdAt;
        }
      }
    });

    // Fallback: Check SyncLogs if ActivityLogs sold count is zero
    if (unitsSold === 0) {
      const syncLogs = await prisma.syncLog.findMany({
        where: {
          sourceStoreId: { in: authorizedStoreIds },
          createdAt: { gte: thirtyDaysAgo },
          ...(skuList.length > 0 ? { sku: { in: skuList } } : {})
        },
        orderBy: { createdAt: 'desc' }
      });

      syncLogs.forEach(log => {
        if (log.status === 'SUCCESS' && log.previousQuantity > log.updatedQuantity) {
          const qty = log.previousQuantity - log.updatedQuantity;
          unitsSold += qty;
          revenue += (targetProduct.price * qty);
          if (!lastSaleDate || log.createdAt > lastSaleDate) {
            lastSaleDate = log.createdAt;
          }
        }
      });
    }

    const avgDailySales = Number((unitsSold / 30).toFixed(1));

    // Determine overall product stock level health
    const totalCurrentStock = variantsInDb.reduce((sum, v) => sum + v.inventoryQuantity, 0);
    let overallHealth: 'Healthy' | 'Low' | 'Critical' | 'Out of Stock' = 'Healthy';
    const storeThreshold = targetProduct.store.lowStockThreshold || 15;
    if (totalCurrentStock <= 0) {
      overallHealth = 'Out of Stock';
    } else if (totalCurrentStock <= Math.floor(storeThreshold / 2)) {
      overallHealth = 'Critical';
    } else if (totalCurrentStock <= storeThreshold) {
      overallHealth = 'Low';
    }

    // Extract collection title
    const collectionNames = targetProduct.collections.map(cp => cp.collection.title);
    const collectionName = collectionNames.length > 0 ? collectionNames.join(', ') : (targetProduct.tags ? targetProduct.tags.split(',')[0] : 'General');

    return NextResponse.json({
      success: true,
      product: {
        id: targetProduct.id,
        shopifyProductId: targetProduct.shopifyProductId,
        title: targetProduct.title,
        sku: targetProduct.sku || 'N/A',
        collection: collectionName,
        vendor: 'StoreBridge', // Default vendor
        basePrice: targetProduct.basePrice || targetProduct.price || 0,
        imageUrl: targetProduct.imageUrl || null,
        status: totalCurrentStock > 0 ? 'Active' : 'Draft',
        currentStock: totalCurrentStock,
        healthStatus: overallHealth,
        variants: variantsInDb.map(v => ({
          id: v.id,
          shopifyVariantId: v.shopifyVariantId,
          variantName: v.title === targetProduct.title ? (v.sku || 'Default Variant') : v.title,
          sku: v.sku || 'N/A',
          price: v.price || 0,
          quantity: v.inventoryQuantity || 0,
          status: v.inventoryQuantity > 0 ? 'Active' : 'Out of Stock'
        })),
        performance: {
          unitsSold,
          revenue,
          avgDailySales,
          lastSale: lastSaleDate ? new Date(lastSaleDate).toISOString() : null
        },
        storeAvailability
      }
    });

  } catch (err: any) {
    console.error("[Product Details API] GET Error:", err);
    return handleApiError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { store } = await authenticate(req);
    const body = await req.json();
    const { variantId, price, quantity } = body;

    if (!variantId) {
      return NextResponse.json({ success: false, error: "variantId is required" }, { status: 400 });
    }

    const variantRecord = await prisma.productCache.findFirst({
      where: {
        id: variantId,
        storeId: store.id
      }
    });

    if (!variantRecord) {
      return NextResponse.json({ success: false, error: "Variant not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (typeof price === 'number' && price >= 0) {
      updateData.price = price;
    }
    if (typeof quantity === 'number' && quantity >= 0) {
      updateData.inventoryQuantity = quantity;
    }

    // 1. Update in DB
    const updatedVariant = await prisma.productCache.update({
      where: { id: variantRecord.id },
      data: updateData
    });

    // 2. Push update to Shopify Admin via GraphQL client
    try {
      const client = await getAdminClient(store.shopDomain);
      
      // Update Price if updated
      if (typeof price === 'number') {
        const numericVariantId = variantRecord.shopifyVariantId.replace('gid://shopify/ProductVariant/', '');
        const gid = `gid://shopify/ProductVariant/${numericVariantId}`;

        await client.request(`
          mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) {
              userErrors { field message }
            }
          }
        `, {
          variables: {
            productId: variantRecord.shopifyProductId.startsWith('gid://') ? variantRecord.shopifyProductId : `gid://shopify/Product/${variantRecord.shopifyProductId}`,
            variants: [{ id: gid, price: price.toString() }]
          }
        });
      }

      // Update Inventory Quantity in Shopify if updated
      if (typeof quantity === 'number') {
        const initResponse = await client.request(`
          query {
            locations(first: 1) {
              edges { node { id } }
            }
          }
        `);
        const initData = initResponse.data || initResponse;
        const locationId = initData.locations?.edges[0]?.node?.id;

        if (locationId) {
          const numericVariantId = variantRecord.shopifyVariantId.replace('gid://shopify/ProductVariant/', '');
          const variantRes = await client.request(`
            query getVariantInventoryItem($id: ID!) {
              productVariant(id: $id) {
                inventoryItem { id }
              }
            }
          `, { variables: { id: `gid://shopify/ProductVariant/${numericVariantId}` } });

          const variantData = variantRes.data || variantRes;
          const inventoryItemId = variantData.productVariant?.inventoryItem?.id;

          if (inventoryItemId) {
            await client.request(`
              mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
                inventorySetQuantities(input: $input) {
                  userErrors { field message }
                }
              }
            `, {
              variables: {
                input: {
                  reason: "correction",
                  name: "available",
                  referenceDocumentUri: "logistics:stockbridge:manual-update",
                  quantities: [{
                    inventoryItemId,
                    locationId,
                    quantity: Math.max(0, quantity)
                  }]
                }
              }
            });
          }
        }
      }
    } catch (shopifyErr: any) {
      console.error("[Product Details API] Shopify Push Warning:", shopifyErr.message);
    }

    // 3. Activity Logging & Notification for current store
    const storeLabel = store.label || store.shopDomain;
    const isPriceChanged = typeof price === 'number' && Number(price) !== Number(variantRecord.price);
    const isQuantityChanged = typeof quantity === 'number' && Number(quantity) !== Number(variantRecord.inventoryQuantity);

    if (isPriceChanged || isQuantityChanged) {
      try {
        await prisma.activityLog.create({
          data: {
            storeId: store.id,
            productTitle: updatedVariant.title || 'Product Variant',
            sku: updatedVariant.sku || 'N/A',
            eventType: 'UPDATE',
            quantity: isQuantityChanged ? quantity! : (updatedVariant.inventoryQuantity || 0),
            amount: isPriceChanged ? price! : (updatedVariant.price || 0),
            description: isPriceChanged ? `Price updated to ₹${price}` : `Stock updated to ${quantity}`
          }
        });

        if (isPriceChanged) {
          await createNotification({
            recipientStoreId: store.id,
            type: 'PRICE_UPDATE',
            title: 'Price Updated',
            message: `Price for "${updatedVariant.title || updatedVariant.sku}" updated to ₹${price} in ${storeLabel}`,
            sourceStoreId: store.id
          });
        }

        if (isQuantityChanged) {
          await createNotification({
            recipientStoreId: store.id,
            type: 'SYNC_UPDATE',
            title: 'Inventory Adjusted',
            message: `Stock for "${updatedVariant.title || updatedVariant.sku}" updated to ${quantity} in ${storeLabel}`,
            sourceStoreId: store.id
          });
        }
      } catch (logErr: any) {
        console.error("[Product Details API] ActivityLog/Notification Warning:", logErr.message);
      }
    }

    // 4. Auto-propagate Price Adjustments & Inventory to Connected Target Stores if Master Store
    if (store.isMaster && updatedVariant.sku) {
      try {
        const connections = await (prisma as any).storeConnection.findMany({
          where: { sourceStoreId: store.id }
        });
        const targetStoreIds = connections.map((c: any) => c.targetStoreId);

        if (targetStoreIds.length > 0) {
          const targetStores = await prisma.store.findMany({
            where: { id: { in: targetStoreIds }, isActive: true }
          });

          // Fetch product collection titles for collection-level price adjustment rules
          const productCollections = await prisma.collectionProduct.findMany({
            where: { productCacheId: variantRecord.id },
            include: { collection: true }
          });
          const collectionTitles = productCollections.map(pc => pc.collection.title);

          for (const targetStore of targetStores) {
            try {
              const targetVariant = await prisma.productCache.findFirst({
                where: {
                  storeId: targetStore.id,
                  sku: updatedVariant.sku
                }
              });

              if (!targetVariant) continue;

              const targetClient = await getAdminClient(targetStore.shopDomain);
              const targetUpdateData: any = {};

              // Handle Price Adjustment for target store
              if (isPriceChanged && price! >= 0) {
                const adjustedPriceStr = await calculateAdjustedPrice(price!, targetStore, collectionTitles);
                const adjustedPriceNum = parseFloat(adjustedPriceStr);
                targetUpdateData.price = adjustedPriceNum;
                targetUpdateData.basePrice = price;

                // Push price update to Shopify target store
                if (targetVariant.shopifyVariantId) {
                  const numericId = targetVariant.shopifyVariantId.replace('gid://shopify/ProductVariant/', '');
                  const gid = `gid://shopify/ProductVariant/${numericId}`;
                  const prodGid = targetVariant.shopifyProductId.startsWith('gid://') ? targetVariant.shopifyProductId : `gid://shopify/Product/${targetVariant.shopifyProductId}`;

                  await targetClient.request(`
                    mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                        userErrors { field message }
                      }
                    }
                  `, {
                    variables: {
                      productId: prodGid,
                      variants: [{ id: gid, price: adjustedPriceStr }]
                    }
                  });
                }

                await createNotification({
                  recipientStoreId: targetStore.id,
                  type: 'PRICE_UPDATE',
                  title: 'Price Adjustment Applied',
                  message: `Price for "${targetVariant.title || updatedVariant.title || targetVariant.sku}" adjusted to ₹${adjustedPriceStr} in ${targetStore.label || targetStore.shopDomain}`,
                  productTitle: targetVariant.title || updatedVariant.title || 'Product Variant',
                  productId: targetVariant.shopifyProductId,
                  sourceStoreId: store.id,
                  targetStoreId: targetStore.id
                });
              }

              // Handle Inventory Adjustment for target store
              if (isQuantityChanged && quantity! >= 0) {
                targetUpdateData.inventoryQuantity = quantity;

                if (targetVariant.shopifyVariantId) {
                  const locRes = await targetClient.request(`
                    query { locations(first: 1) { edges { node { id } } } }
                  `);
                  const locData = locRes.data || locRes;
                  const locationId = locData.locations?.edges[0]?.node?.id;

                  if (locationId) {
                    const numericId = targetVariant.shopifyVariantId.replace('gid://shopify/ProductVariant/', '');
                    const vRes = await targetClient.request(`
                      query getVariantInventoryItem($id: ID!) { productVariant(id: $id) { inventoryItem { id } } }
                    `, { variables: { id: `gid://shopify/ProductVariant/${numericId}` } });

                    const vData = vRes.data || vRes;
                    const inventoryItemId = vData.productVariant?.inventoryItem?.id;

                    if (inventoryItemId) {
                      await targetClient.request(`
                        mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
                          inventorySetQuantities(input: $input) { userErrors { field message } }
                        }
                      `, {
                        variables: {
                          input: {
                            reason: "correction",
                            name: "available",
                            referenceDocumentUri: "logistics:storebridge:manual-update",
                            quantities: [{ inventoryItemId, locationId, quantity: Math.max(0, quantity!) }]
                          }
                        }
                      });
                    }
                  }
                }

                await createNotification({
                  recipientStoreId: targetStore.id,
                  type: 'SYNC_UPDATE',
                  title: 'Inventory Synchronized',
                  message: `Stock for "${targetVariant.title || updatedVariant.title || targetVariant.sku}" updated to ${quantity} in ${targetStore.label || targetStore.shopDomain}`,
                  productTitle: targetVariant.title || updatedVariant.title || 'Product Variant',
                  productId: targetVariant.shopifyProductId,
                  sourceStoreId: store.id,
                  targetStoreId: targetStore.id
                });
              }

              // Save updated target variant in DB
              if (Object.keys(targetUpdateData).length > 0) {
                await prisma.productCache.update({
                  where: { id: targetVariant.id },
                  data: targetUpdateData
                });
              }
            } catch (targetErr: any) {
              console.error(`[Product Details API] Error updating target store ${targetStore.shopDomain}:`, targetErr.message);
            }
          }
        }
      } catch (masterSyncErr: any) {
        console.error("[Product Details API] Master sync propagation error:", masterSyncErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      variant: updatedVariant
    });

  } catch (err: any) {
    console.error("[Product Details API] PATCH Error:", err);
    return handleApiError(err);
  }
}
