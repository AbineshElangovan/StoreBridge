import { NextRequest, NextResponse } from "next/server";
import { authenticate, handleApiError } from "@/lib/shopify/authenticate";
import { prisma } from "@/lib/db/prisma";
import { getAdminClient } from "@/lib/shopify/admin";
import { setInventoryQuantity } from "@/lib/shopify/inventory";
import { fetchDefaultLocation } from "@/services/shopify/api-helpers";
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

    const matchConditions: any[] = [
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
      { sku: spaceId },
      { sku: { equals: decodedId, mode: 'insensitive' } },
      { sku: { equals: cleanNumericId, mode: 'insensitive' } },
      { sku: { equals: hyphenatedId, mode: 'insensitive' } },
      { sku: { equals: spaceId, mode: 'insensitive' } }
    ];

    // 1. Find target product in current store
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

    // Fetch all variants belonging to this shopifyProductId in the store
    const variantsInDb = await prisma.productCache.findMany({
      where: {
        storeId: targetProduct.storeId,
        shopifyProductId: shopifyProductId
      },
      orderBy: { createdAt: 'asc' }
    });

    // Authorized store availability scoping
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

      const isMasterDisplay = Boolean(isNetworkConnected && networkMasterId && s.id === networkMasterId);

      return {
        storeId: s.id,
        storeName: s.label || s.shopDomain,
        quantity: data.totalQty,
        healthStatus,
        isMaster: isMasterDisplay
      };
    });

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

    let mainProductTitle = targetProduct.title || 'Product';
    if (mainProductTitle.includes(' - ')) {
      mainProductTitle = mainProductTitle.split(' - ')[0].trim();
    }

    const collectionNames = targetProduct.collections.map(cp => cp.collection.title);
    const collectionName = collectionNames.length > 0 ? collectionNames.join(', ') : (targetProduct.tags ? targetProduct.tags.split(',')[0] : 'General');

    return NextResponse.json({
      success: true,
      product: {
        id: targetProduct.id,
        shopifyProductId: targetProduct.shopifyProductId,
        title: mainProductTitle,
        sku: targetProduct.sku || 'N/A',
        collection: collectionName,
        vendor: 'StoreBridge',
        basePrice: targetProduct.basePrice || targetProduct.price || 0,
        imageUrl: targetProduct.imageUrl || null,
        status: totalCurrentStock > 0 ? 'Active' : 'Draft',
        currentStock: totalCurrentStock,
        healthStatus: overallHealth,
        variants: variantsInDb.map(v => {
          const rawTitle = v.title || '';
          let variantName = rawTitle;
          if (rawTitle.includes(' - ')) {
            variantName = rawTitle;
          } else if (rawTitle && rawTitle !== mainProductTitle && rawTitle !== 'Default Title') {
            variantName = `${mainProductTitle} - ${rawTitle}`;
          } else {
            variantName = mainProductTitle;
          }

          return {
            id: v.id,
            shopifyVariantId: v.shopifyVariantId,
            variantName,
            sku: v.sku || 'N/A',
            price: Math.max(0, v.price || 0),
            quantity: Math.max(0, v.inventoryQuantity || 0),
            status: (v.inventoryQuantity || 0) > 0 ? 'Active' : 'Out of Stock'
          };
        }),
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
    const { store: authStore } = await authenticate(req);
    const body = await req.json();
    const { variantId, price, quantity, syncToConnected } = body;

    if (!variantId) {
      return NextResponse.json({ success: false, error: "variantId is required" }, { status: 400 });
    }

    // 1. Locate local variant record & include its owning Store record
    let variantRecord = await prisma.productCache.findFirst({
      where: {
        id: variantId,
        storeId: authStore.id
      },
      include: { store: true }
    });

    // Fallback: If not found in authStore, search globally across DB to get the true owning store
    if (!variantRecord) {
      variantRecord = await prisma.productCache.findFirst({
        where: { id: variantId },
        include: { store: true }
      });
    }

    if (!variantRecord) {
      return NextResponse.json({ success: false, error: "Variant not found" }, { status: 404 });
    }

    // The authoritative store owning this product variant
    const productStore = variantRecord.store;


    const isPriceChanged = typeof price === 'number' && Number(price) !== Number(variantRecord.price);
    const isQuantityChanged = typeof quantity === 'number' && Number(quantity) !== Number(variantRecord.inventoryQuantity);

    if (!isPriceChanged && !isQuantityChanged) {
      return NextResponse.json({ success: true, variant: variantRecord });
    }

    // Prepare Shopify GIDs
    const formattedProdGid = variantRecord.shopifyProductId.startsWith('gid://')
      ? variantRecord.shopifyProductId
      : `gid://shopify/Product/${variantRecord.shopifyProductId}`;
      
    const numericVarId = variantRecord.shopifyVariantId
      .replace(/^gid:\/\/shopify\/ProductVariant\//i, '')
      .replace(/\D/g, '');
    const formattedVarGid = `gid://shopify/ProductVariant/${numericVarId || variantRecord.shopifyVariantId}`;

    // IMPORTANT: Get GraphQL Admin Client for the SPECIFIC productStore (Master, Connected, or Standalone)
    const client = await getAdminClient(productStore.shopDomain);

    // 2. SHOPIFY MUTATION FIRST FOR THE PRODUCT'S STORE
    // A. Price Update
    if (isPriceChanged && price >= 0) {
      const priceRes: any = await client.request(`
        mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants { id price }
            userErrors { field message }
          }
        }
      `, {
        variables: {
          productId: formattedProdGid,
          variants: [{ id: formattedVarGid, price: price.toString() }]
        }
      });

      const userErrors = priceRes?.data?.productVariantsBulkUpdate?.userErrors || priceRes?.productVariantsBulkUpdate?.userErrors || [];
      if (userErrors.length > 0) {
        const errorMsg = userErrors.map((e: any) => `${e.field || 'price'}: ${e.message}`).join(', ');
        console.error(`[Product Details API] Shopify price update rejected for ${productStore.shopDomain}: ${errorMsg}`);
        return NextResponse.json({
          success: false,
          error: `Shopify price update rejected on ${productStore.label || productStore.shopDomain}: ${errorMsg}`
        }, { status: 400 });
      }
    }

    // B. Inventory Update
    if (isQuantityChanged && quantity >= 0) {
      let inventoryItemId: string | null = null;
      const variantMap = await prisma.variantMap.findFirst({
        where: { storeId: productStore.id, shopifyVariantId: variantRecord.shopifyVariantId }
      });

      if (variantMap?.inventoryItemId) {
        inventoryItemId = variantMap.inventoryItemId;
      } else {
        const vRes: any = await client.request(`
          query getVariantInventoryItem($id: ID!) {
            productVariant(id: $id) {
              inventoryItem { id }
            }
          }
        `, { variables: { id: formattedVarGid } });
        inventoryItemId = vRes?.data?.productVariant?.inventoryItem?.id || vRes?.productVariant?.inventoryItem?.id || null;
      }

      if (!inventoryItemId) {
        return NextResponse.json({
          success: false,
          error: `Inventory Item ID not found on Shopify for variant ${variantRecord.sku || formattedVarGid}`
        }, { status: 400 });
      }

      const locationId = await fetchDefaultLocation(productStore.shopDomain);
      if (!locationId) {
        return NextResponse.json({
          success: false,
          error: `Could not resolve Shopify location for store ${productStore.shopDomain}`
        }, { status: 400 });
      }

      try {
        await setInventoryQuantity(productStore.shopDomain, inventoryItemId, locationId, quantity);
      } catch (invErr: any) {
        console.error(`[Product Details API] Shopify inventory update rejected for ${productStore.shopDomain}:`, invErr.message);
        return NextResponse.json({
          success: false,
          error: `Shopify inventory update rejected on ${productStore.label || productStore.shopDomain}: ${invErr.message}`
        }, { status: 400 });
      }
    }

    // 3. UPDATE LOCAL DB FOR PRODUCT STORE ONLY AFTER SHOPIFY CONFIRMS SUCCESS
    const updateData: any = {};
    if (isPriceChanged && price >= 0) {
      updateData.price = price;
      updateData.basePrice = price;
    }
    if (isQuantityChanged && quantity >= 0) {
      updateData.inventoryQuantity = quantity;
    }

    const updatedVariant = await prisma.productCache.update({
      where: { id: variantRecord.id },
      data: updateData
    });

    // 4. ACTIVITY & NOTIFICATION FOR PRODUCT STORE
    const storeLabel = productStore.label || productStore.shopDomain;
    try {
      await prisma.activityLog.create({
        data: {
          storeId: productStore.id,
          productId: variantRecord.shopifyProductId,
          productTitle: updatedVariant.title || 'Product Variant',
          sku: updatedVariant.sku || 'N/A',
          eventType: 'UPDATE',
          quantity: isQuantityChanged ? quantity : (updatedVariant.inventoryQuantity || 0),
          amount: isPriceChanged ? price : (updatedVariant.price || 0),
          description: isPriceChanged ? `Price updated to ₹${price}` : `Stock updated to ${quantity}`
        }
      });

      if (isPriceChanged) {
        await createNotification({
          recipientStoreId: productStore.id,
          type: 'PRICE_UPDATE',
          title: 'Price Updated',
          message: `Price for "${updatedVariant.title || updatedVariant.sku}" updated to ₹${price} in ${storeLabel}`,
          sourceStoreId: productStore.id
        });
      }

      if (isQuantityChanged) {
        await createNotification({
          recipientStoreId: productStore.id,
          type: 'SYNC_UPDATE',
          title: 'Inventory Adjusted',
          message: `Stock for "${updatedVariant.title || updatedVariant.sku}" updated to ${quantity} in ${storeLabel}`,
          sourceStoreId: productStore.id
        });
      }

      // INFORMATIONAL NOTIFICATION TO MASTER STORE IF CONNECTED STORE WAS UPDATED
      if (!productStore.isMaster) {
        const masterStore = await prisma.store.findFirst({
          where: { isMaster: true, isActive: true }
        });
        if (masterStore && masterStore.id !== productStore.id) {
          const detailMsg = isPriceChanged
            ? `${storeLabel} updated ${updatedVariant.title || updatedVariant.sku} price to ₹${price}`
            : `${storeLabel} updated ${updatedVariant.title || updatedVariant.sku} stock to ${quantity}`;

          await createNotification({
            recipientStoreId: masterStore.id,
            type: 'CONNECTED_STORE_UPDATE',
            title: 'Connected Store Update',
            message: detailMsg,
            productId: variantRecord.shopifyProductId,
            productTitle: updatedVariant.title || 'Product Variant',
            sourceStoreId: productStore.id,
            targetStoreId: masterStore.id
          });
        }
      }
    } catch (logErr: any) {
      console.error("[Product Details API] ActivityLog/Notification warning:", logErr.message);
    }

    // 5. STORE ROLE REPLICATION & SYNC REQUEST NOTIFICATIONS
    // Whenever Master Store updates a product/variant, send a Sync Request Notification to all connected stores
    const targetStoreResults: Array<{ storeId: string; shopDomain: string; success: boolean; error?: string }> = [];

    if (productStore.isMaster) {
      const connections = await (prisma as any).storeConnection.findMany({
        where: { sourceStoreId: productStore.id }
      });
      const targetStoreIds = connections.map((c: any) => c.targetStoreId);

      if (targetStoreIds.length > 0) {
        const targetStores = await prisma.store.findMany({
          where: { id: { in: targetStoreIds }, isActive: true }
        });

        const productCollections = await prisma.collectionProduct.findMany({
          where: { productCacheId: variantRecord.id },
          include: { collection: true }
        });
        const collectionTitles = productCollections.map(pc => pc.collection.title);

        for (const targetStore of targetStores) {
          try {
            // Create Sync Request Notification for Connected Store Inbox
            await createNotification({
              recipientStoreId: targetStore.id,
              type: 'SYNC_UPDATE',
              title: 'Sync Request: Product Update',
              message: `Master store updated "${updatedVariant.title || updatedVariant.sku}" (Price: ₹${isPriceChanged ? price : updatedVariant.price}, Stock: ${isQuantityChanged ? quantity : updatedVariant.inventoryQuantity}). Sync this update to your store?`,
              sourceStoreId: productStore.id,
              targetStoreId: targetStore.id,
              productId: variantRecord.shopifyProductId,
              productTitle: updatedVariant.title || 'Product Variant',
              metadata: {
                syncPending: true,
                syncStatus: 'PENDING',
                syncAction: 'UPDATE',
                payload: {
                  productId: variantRecord.shopifyProductId,
                  variantId: variantRecord.shopifyVariantId || variantRecord.id,
                  sku: updatedVariant.sku,
                  price: isPriceChanged ? price : updatedVariant.price,
                  quantity: isQuantityChanged ? quantity : updatedVariant.inventoryQuantity,
                  title: updatedVariant.title
                }
              }
            });

            // If syncToConnected === true, also apply direct replication immediately
            if (syncToConnected === true && updatedVariant.sku) {
              const targetVariant = await prisma.productCache.findFirst({
                where: {
                  storeId: targetStore.id,
                  sku: updatedVariant.sku
                }
              });

              if (!targetVariant) {
                targetStoreResults.push({
                  storeId: targetStore.id,
                  shopDomain: targetStore.shopDomain,
                  success: false,
                  error: `Variant SKU ${updatedVariant.sku} not found in connected store`
                });
                continue;
              }

              const targetClient = await getAdminClient(targetStore.shopDomain);
              const targetUpdateData: any = {};

              // Replicate Price to Target Store Shopify FIRST (Exact Master price, no adjustment calculations)
              if (isPriceChanged && price >= 0) {
                const exactPriceStr = price.toFixed(2);
                targetUpdateData.price = price;
                targetUpdateData.basePrice = price;

                if (targetVariant.shopifyVariantId) {
                  const targetNumericId = targetVariant.shopifyVariantId.replace(/^gid:\/\/shopify\/ProductVariant\//i, '').replace(/\D/g, '');
                  const targetVarGid = `gid://shopify/ProductVariant/${targetNumericId || targetVariant.shopifyVariantId}`;
                  const targetProdGid = targetVariant.shopifyProductId.startsWith('gid://')
                    ? targetVariant.shopifyProductId
                    : `gid://shopify/Product/${targetVariant.shopifyProductId}`;

                  const targetPriceRes: any = await targetClient.request(`
                    mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                        userErrors { field message }
                      }
                    }
                  `, {
                    variables: {
                      productId: targetProdGid,
                      variants: [{ id: targetVarGid, price: exactPriceStr }]
                    }
                  });

                  const targetPriceErrors = targetPriceRes?.data?.productVariantsBulkUpdate?.userErrors || targetPriceRes?.productVariantsBulkUpdate?.userErrors || [];
                  if (targetPriceErrors.length > 0) {
                    throw new Error(`Shopify price update error: ${targetPriceErrors.map((e: any) => e.message).join(', ')}`);
                  }
                }
              }

              // Replicate Inventory to Target Store Shopify FIRST
              if (isQuantityChanged && quantity >= 0) {
                targetUpdateData.inventoryQuantity = quantity;

                if (targetVariant.shopifyVariantId) {
                  let targetInventoryItemId: string | null = null;
                  const targetMap = await prisma.variantMap.findFirst({
                    where: { storeId: targetStore.id, shopifyVariantId: targetVariant.shopifyVariantId }
                  });

                  if (targetMap?.inventoryItemId) {
                    targetInventoryItemId = targetMap.inventoryItemId;
                  } else {
                    const targetNumericId = targetVariant.shopifyVariantId.replace(/^gid:\/\/shopify\/ProductVariant\//i, '').replace(/\D/g, '');
                    const vRes: any = await targetClient.request(`
                      query getVariantInventoryItem($id: ID!) { productVariant(id: $id) { inventoryItem { id } } }
                    `, { variables: { id: `gid://shopify/ProductVariant/${targetNumericId || targetVariant.shopifyVariantId}` } });

                    targetInventoryItemId = vRes?.data?.productVariant?.inventoryItem?.id || vRes?.productVariant?.inventoryItem?.id || null;
                  }

                  if (targetInventoryItemId) {
                    const targetLocationId = await fetchDefaultLocation(targetStore.shopDomain);
                    if (targetLocationId) {
                      await setInventoryQuantity(targetStore.shopDomain, targetInventoryItemId, targetLocationId, quantity);
                    }
                  }
                }
              }

              // ONLY AFTER TARGET SHOPIFY SUCCEEDS -> UPDATE TARGET DB
              if (Object.keys(targetUpdateData).length > 0) {
                await prisma.productCache.update({
                  where: { id: targetVariant.id },
                  data: targetUpdateData
                });
              }

              targetStoreResults.push({
                storeId: targetStore.id,
                shopDomain: targetStore.shopDomain,
                success: true
              });
            }

          } catch (targetErr: any) {
            console.error(`[Product Details API] Error replicating to target store ${targetStore.shopDomain}:`, targetErr.message);
            targetStoreResults.push({
              storeId: targetStore.id,
              shopDomain: targetStore.shopDomain,
              success: false,
              error: targetErr.message
            });
          }
        }
      }
    }

    const failedTargets = targetStoreResults.filter(r => !r.success);
    if (failedTargets.length > 0) {
      return NextResponse.json({
        success: false,
        master: { success: true },
        connectedStores: targetStoreResults,
        error: `Master updated successfully, but ${failedTargets.length} connected store(s) failed: ${failedTargets.map(f => `${f.shopDomain} (${f.error})`).join('; ')}`
      }, { status: 207 });
    }

    return NextResponse.json({
      success: true,
      variant: updatedVariant,
      connectedStores: targetStoreResults
    });

  } catch (err: any) {
    console.error("[Product Details API] PATCH Error:", err);
    return handleApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { store: authStore } = await authenticate(req);
    const { id: rawIdParam } = await params;
    const searchParams = req.nextUrl.searchParams;
    const variantIdParam = searchParams.get('variantId');
    const syncToConnectedParam = searchParams.get('syncToConnected');
    const syncToConnected = syncToConnectedParam !== null ? syncToConnectedParam === 'true' : undefined;

    const rawId = Array.isArray(rawIdParam) ? (rawIdParam as string[]).join('/') : (rawIdParam as string || '');
    const decodedId = decodeURIComponent(rawId).trim();
    const cleanNumericId = decodedId
      .replace(/^gid:\/\/shopify\/Product\//i, '')
      .replace(/^gid%3a%2f%2fshopify%2fproduct%2f/i, '')
      .split('/')
      .pop() || decodedId;

    // ------------------------------------------------------------------------
    // VARIANT-LEVEL DELETION
    // ------------------------------------------------------------------------
    if (variantIdParam) {
      let variantRecord = await prisma.productCache.findFirst({
        where: {
          id: variantIdParam,
          storeId: authStore.id
        },
        include: { store: true }
      });

      if (!variantRecord) {
        variantRecord = await prisma.productCache.findFirst({
          where: { id: variantIdParam },
          include: { store: true }
        });
      }

      if (!variantRecord) {
        return NextResponse.json({ success: false, error: "Variant not found" }, { status: 404 });
      }

      const productStore = variantRecord.store;

      const { shopifyProductId, shopifyVariantId, sku: variantSku, title: rawVariantTitle, imageUrl } = variantRecord;
      const cleanVariantTitle = rawVariantTitle || 'Variant';

      const formattedProdGid = shopifyProductId.startsWith('gid://')
        ? shopifyProductId
        : `gid://shopify/Product/${shopifyProductId}`;

      const numericVarId = shopifyVariantId.replace(/^gid:\/\/shopify\/ProductVariant\//i, '').replace(/\D/g, '');
      const formattedVarGid = `gid://shopify/ProductVariant/${numericVarId || shopifyVariantId}`;

      // 1. SHOPIFY VARIANT DELETE FIRST ON PRODUCT'S STORE
      const client = await getAdminClient(productStore.shopDomain);
      const deleteVariantMutation = `
        mutation productVariantsBulkDelete($productId: ID!, $variantsIds: [ID!]!) {
          productVariantsBulkDelete(productId: $productId, variantsIds: $variantsIds) {
            userErrors { field message }
          }
        }
      `;

      const delRes: any = await client.request(deleteVariantMutation, {
        variables: {
          productId: formattedProdGid,
          variantsIds: [formattedVarGid]
        }
      });

      const delErrors = delRes?.data?.productVariantsBulkDelete?.userErrors || delRes?.productVariantsBulkDelete?.userErrors || [];
      if (delErrors.length > 0) {
        const errorMsg = delErrors.map((e: any) => `${e.field || 'variant'}: ${e.message}`).join(', ');
        console.error(`[Product Details API] Shopify variant delete rejected for ${productStore.shopDomain}: ${errorMsg}`);
        return NextResponse.json({
          success: false,
          error: `Shopify variant delete rejected on ${productStore.label || productStore.shopDomain}: ${errorMsg}`
        }, { status: 400 });
      }

      // 2. DELETE LOCAL DB RECORDS ONLY AFTER SHOPIFY CONFIRMS SUCCESS
      await prisma.collectionProduct.deleteMany({
        where: { productCacheId: variantRecord.id }
      });

      await prisma.productCache.delete({
        where: { id: variantRecord.id }
      });

      await prisma.variantMap.deleteMany({
        where: {
          storeId: productStore.id,
          shopifyVariantId: shopifyVariantId
        }
      });

      // 3. STORE ROLE REPLICATION FOR VARIANT DELETE
      if (productStore.isMaster && syncToConnected === true && variantSku) {
        const connections = await (prisma as any).storeConnection.findMany({
          where: { sourceStoreId: productStore.id }
        });
        const targetStoreIds = connections.map((c: any) => c.targetStoreId);

        if (targetStoreIds.length > 0) {
          const targetStores = await prisma.store.findMany({
            where: { id: { in: targetStoreIds }, isActive: true }
          });

          for (const targetStore of targetStores) {
            try {
              const targetVariant = await prisma.productCache.findFirst({
                where: {
                  storeId: targetStore.id,
                  sku: variantSku
                }
              });

              if (!targetVariant) continue;

              const targetClient = await getAdminClient(targetStore.shopDomain);
              const targetProdGid = targetVariant.shopifyProductId.startsWith('gid://')
                ? targetVariant.shopifyProductId
                : `gid://shopify/Product/${targetVariant.shopifyProductId}`;
              const targetNumericVarId = targetVariant.shopifyVariantId.replace(/^gid:\/\/shopify\/ProductVariant\//i, '').replace(/\D/g, '');
              const targetVarGid = `gid://shopify/ProductVariant/${targetNumericVarId || targetVariant.shopifyVariantId}`;

              const tDelRes: any = await targetClient.request(deleteVariantMutation, {
                variables: {
                  productId: targetProdGid,
                  variantsIds: [targetVarGid]
                }
              });

              const tDelErrors = tDelRes?.data?.productVariantsBulkDelete?.userErrors || tDelRes?.productVariantsBulkDelete?.userErrors || [];
              if (tDelErrors.length === 0) {
                await prisma.collectionProduct.deleteMany({
                  where: { productCacheId: targetVariant.id }
                });
                await prisma.productCache.delete({
                  where: { id: targetVariant.id }
                });
                await prisma.variantMap.deleteMany({
                  where: {
                    storeId: targetStore.id,
                    shopifyVariantId: targetVariant.shopifyVariantId
                  }
                });
              }
            } catch (tErr: any) {
              console.error(`[Product Details API] Error replicating variant delete to ${targetStore.shopDomain}:`, tErr.message);
            }
          }
        }
      }

      // 4. LOG ACTIVITY & SEND NOTIFICATION
      const storeLabel = productStore.label || productStore.shopDomain;
      try {
        await prisma.activityLog.create({
          data: {
            storeId: productStore.id,
            productId: shopifyProductId,
            productTitle: cleanVariantTitle,
            sku: variantSku || null,
            imageUrl: imageUrl || null,
            eventType: "DELETE",
            quantity: 1,
            description: `Deleted variant "${cleanVariantTitle}" from ${storeLabel}`
          }
        });

        await createNotification({
          recipientStoreId: productStore.id,
          type: "PRODUCT_UPDATED",
          title: "Variant Deleted",
          message: `Variant "${cleanVariantTitle}" was deleted from ${storeLabel}`,
          productId: shopifyProductId,
          productTitle: cleanVariantTitle,
          sourceStoreId: productStore.id
        });

        if (!productStore.isMaster) {
          const masterStore = await prisma.store.findFirst({
            where: { isMaster: true, isActive: true }
          });
          if (masterStore && masterStore.id !== productStore.id) {
            await createNotification({
              recipientStoreId: masterStore.id,
              type: "CONNECTED_STORE_UPDATE",
              title: "Connected Store Variant Deleted",
              message: `${storeLabel} deleted variant "${cleanVariantTitle}"`,
              productId: shopifyProductId,
              productTitle: cleanVariantTitle,
              sourceStoreId: productStore.id,
              targetStoreId: masterStore.id
            });
          }
        }
      } catch (logErr: any) {
        console.error("[Product Details API] ActivityLog/Notification delete variant error:", logErr.message);
      }

      return NextResponse.json({
        success: true,
        message: `Variant "${cleanVariantTitle}" was successfully deleted.`
      });
    }

    // ------------------------------------------------------------------------
    // PRODUCT-LEVEL DELETION
    // ------------------------------------------------------------------------
    const lowerDecoded = decodedId.toLowerCase();
    
    let targetProduct = await prisma.productCache.findFirst({
      where: {
        storeId: authStore.id,
        OR: [
          { id: decodedId },
          { id: lowerDecoded },
          { id: cleanNumericId },
          { shopifyProductId: decodedId },
          { shopifyProductId: cleanNumericId },
          { shopifyProductId: `gid://shopify/Product/${cleanNumericId}` },
          { shopifyProductId: { endsWith: cleanNumericId } }
        ]
      },
      include: { store: true }
    });

    if (!targetProduct) {
      targetProduct = await prisma.productCache.findFirst({
        where: {
          OR: [
            { id: decodedId },
            { id: lowerDecoded },
            { id: cleanNumericId },
            { shopifyProductId: decodedId },
            { shopifyProductId: cleanNumericId },
            { shopifyProductId: `gid://shopify/Product/${cleanNumericId}` },
            { shopifyProductId: { endsWith: cleanNumericId } }
          ]
        },
        include: { store: true }
      });
    }

    if (!targetProduct) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }

    const productStore = targetProduct.store;

    const { shopifyProductId, title: rawProductTitle, sku: productSku, imageUrl } = targetProduct;
    const cleanTitle = rawProductTitle.split(' - ')[0].trim();

    // 1. SHOPIFY PRODUCT DELETE FIRST ON PRODUCT'S STORE
    const client = await getAdminClient(productStore.shopDomain);
    const formattedGid = shopifyProductId.startsWith('gid://')
      ? shopifyProductId
      : `gid://shopify/Product/${shopifyProductId}`;

    const deleteMutation = `
      mutation productDelete($input: ProductDeleteInput!) {
        productDelete(input: $input) {
          deletedProductId
          userErrors { field message }
        }
      }
    `;

    const delRes: any = await client.request(deleteMutation, {
      variables: { input: { id: formattedGid } }
    });

    const delErrors = delRes?.data?.productDelete?.userErrors || delRes?.productDelete?.userErrors || [];
    if (delErrors.length > 0) {
      const errorMsg = delErrors.map((e: any) => `${e.field || 'product'}: ${e.message}`).join(', ');
      console.error(`[Product Details API] Shopify product delete rejected for ${productStore.shopDomain}: ${errorMsg}`);
      return NextResponse.json({
        success: false,
        error: `Shopify product delete rejected on ${productStore.label || productStore.shopDomain}: ${errorMsg}`
      }, { status: 400 });
    }

    // 2. DELETE LOCAL DB RECORDS ONLY AFTER SHOPIFY CONFIRMS SUCCESS
    const matchingCaches = await prisma.productCache.findMany({
      where: {
        storeId: productStore.id,
        shopifyProductId: shopifyProductId
      },
      select: { id: true }
    });

    const cacheIds = matchingCaches.map(c => c.id);

    if (cacheIds.length > 0) {
      await prisma.collectionProduct.deleteMany({
        where: { productCacheId: { in: cacheIds } }
      });

      await prisma.productCache.deleteMany({
        where: { id: { in: cacheIds } }
      });

      await prisma.variantMap.deleteMany({
        where: {
          storeId: productStore.id,
          shopifyProductId: shopifyProductId
        }
      });
    }

    // 3. STORE ROLE REPLICATION & SYNC REQUEST NOTIFICATIONS FOR PRODUCT DELETE
    const targetStoreResults: Array<{ storeId: string; shopDomain: string; success: boolean; error?: string }> = [];

    if (productStore.isMaster) {
      const connections = await (prisma as any).storeConnection.findMany({
        where: { sourceStoreId: productStore.id }
      });
      const targetStoreIds = connections.map((c: any) => c.targetStoreId);

      if (targetStoreIds.length > 0) {
        const targetStores = await prisma.store.findMany({
          where: { id: { in: targetStoreIds }, isActive: true }
        });

        for (const targetStore of targetStores) {
          try {
            await createNotification({
              recipientStoreId: targetStore.id,
              type: 'SYNC_UPDATE',
              title: 'Sync Request: Product Deleted',
              message: `Master store deleted product "${cleanTitle}". Delete this product from your store as well?`,
              sourceStoreId: productStore.id,
              targetStoreId: targetStore.id,
              productId: shopifyProductId,
              productTitle: cleanTitle,
              metadata: {
                syncPending: true,
                syncStatus: 'PENDING',
                syncAction: 'DELETE',
                payload: {
                  productId: shopifyProductId,
                  sku: productSku,
                  productTitle: cleanTitle
                }
              }
            });

            if (syncToConnected === true && productSku) {
              const targetProd = await prisma.productCache.findFirst({
                where: {
                  storeId: targetStore.id,
                  OR: [
                    { shopifyProductId: shopifyProductId },
                    { sku: productSku }
                  ]
                }
              });

              if (!targetProd) continue;

              const targetClient = await getAdminClient(targetStore.shopDomain);
              const targetProdGid = targetProd.shopifyProductId.startsWith('gid://')
                ? targetProd.shopifyProductId
                : `gid://shopify/Product/${targetProd.shopifyProductId}`;

              const tDelRes: any = await targetClient.request(deleteMutation, {
                variables: { input: { id: targetProdGid } }
              });

              const tDelErrors = tDelRes?.data?.productDelete?.userErrors || tDelRes?.productDelete?.userErrors || [];
              if (tDelErrors.length === 0) {
                const tCaches = await prisma.productCache.findMany({
                  where: { storeId: targetStore.id, shopifyProductId: targetProd.shopifyProductId },
                  select: { id: true }
                });
                const tCacheIds = tCaches.map(c => c.id);
                if (tCacheIds.length > 0) {
                  await prisma.collectionProduct.deleteMany({
                    where: { productCacheId: { in: tCacheIds } }
                  });
                  await prisma.productCache.deleteMany({
                    where: { id: { in: tCacheIds } }
                  });
                  await prisma.variantMap.deleteMany({
                    where: { storeId: targetStore.id, shopifyProductId: targetProd.shopifyProductId }
                  });
                }
                targetStoreResults.push({ storeId: targetStore.id, shopDomain: targetStore.shopDomain, success: true });
              } else {
                targetStoreResults.push({ storeId: targetStore.id, shopDomain: targetStore.shopDomain, success: false, error: tDelErrors.map((e: any) => e.message).join(', ') });
              }
            }
          } catch (tErr: any) {
            console.error(`[Product Details API] Error replicating product delete to ${targetStore.shopDomain}:`, tErr.message);
            targetStoreResults.push({ storeId: targetStore.id, shopDomain: targetStore.shopDomain, success: false, error: tErr.message });
          }
        }
      }
    }

    // 4. LOG ACTIVITY & SEND NOTIFICATION
    const storeLabel = productStore.label || productStore.shopDomain;
    try {
      await prisma.activityLog.create({
        data: {
          storeId: productStore.id,
          productId: shopifyProductId,
          productTitle: cleanTitle,
          sku: productSku || null,
          imageUrl: imageUrl || null,
          eventType: "DELETE",
          quantity: matchingCaches.length,
          description: `Deleted product "${cleanTitle}" from ${storeLabel}`
        }
      });

      await createNotification({
        recipientStoreId: productStore.id,
        type: "PRODUCT_UPDATED",
        title: "Product Deleted",
        message: `Product "${cleanTitle}" was deleted from ${storeLabel}`,
        productId: shopifyProductId,
        productTitle: cleanTitle,
        sourceStoreId: productStore.id
      });

      if (!productStore.isMaster) {
        const masterStore = await prisma.store.findFirst({
          where: { isMaster: true, isActive: true }
        });
        if (masterStore && masterStore.id !== productStore.id) {
          await createNotification({
            recipientStoreId: masterStore.id,
            type: "CONNECTED_STORE_UPDATE",
            title: "Connected Store Product Deleted",
            message: `${storeLabel} deleted product "${cleanTitle}"`,
            productId: shopifyProductId,
            productTitle: cleanTitle,
            sourceStoreId: productStore.id,
            targetStoreId: masterStore.id
          });
        }
      }
    } catch (logErr: any) {
      console.error("[Product Details API] ActivityLog/Notification delete error:", logErr.message);
    }

    const failedTargets = targetStoreResults.filter(r => !r.success);
    if (failedTargets.length > 0) {
      return NextResponse.json({
        success: false,
        master: { success: true },
        connectedStores: targetStoreResults,
        error: `Master deleted successfully, but ${failedTargets.length} connected store(s) failed: ${failedTargets.map(f => `${f.shopDomain} (${f.error})`).join('; ')}`
      }, { status: 207 });
    }

    return NextResponse.json({
      success: true,
      message: `Product "${cleanTitle}" was successfully deleted.`
    });

  } catch (err: any) {
    console.error("[Product Details API] DELETE Error:", err);
    return handleApiError(err);
  }
}
