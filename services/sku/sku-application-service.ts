import { prisma } from "@/lib/db/prisma";
import { getAdminClient } from "@/lib/shopify/admin";
import { createNotification } from "@/services/notification-service";
import { calculateAdjustedPrice } from "@/services/shopify/pricing";
import { publishProductToAllChannels, fetchDefaultLocation } from "@/services/shopify/api-helpers";
import { setInventoryQuantity } from "@/lib/shopify/inventory";
import { generateSkuPreview } from "./sku-preview-service";
import { VariantOptionInput } from "./variant-combinations";

export interface ApplySkuResult {
  success: boolean;
  summary: {
    totalCombinations: number;
    createdCount: number;
    updatedCount: number;
    existingCount: number;
    skippedCount: number;
    connectedStoresSyncedCount: number;
    shopifySyncStatus: "SUCCESS" | "PARTIAL_FAILED" | "FAILED" | "NOT_REQUIRED";
    shopifyMessage?: string;
  };
  errors?: string[];
}

export async function applySkuGeneration(
  storeId: string,
  shopifyProductId: string,
  options: VariantOptionInput[],
  customPrice?: number,
  customQuantity?: number
): Promise<ApplySkuResult> {
  // 1. Re-run safe preview validation
  const preview = await generateSkuPreview(storeId, shopifyProductId, options);

  if (!preview.canApply) {
    return {
      success: false,
      summary: {
        totalCombinations: preview.totalCombinations,
        createdCount: 0,
        updatedCount: 0,
        existingCount: preview.existingCount,
        skippedCount: preview.items.length,
        connectedStoresSyncedCount: 0,
        shopifySyncStatus: "NOT_REQUIRED",
      },
      errors: preview.validationErrors.map((e) => e.message),
    };
  }

  const store = await prisma.store.findFirst({
    where: {
      OR: [
        { id: storeId },
        { uniqueStoreId: storeId },
        { shopDomain: storeId },
      ],
    },
  });

  if (!store) {
    throw new Error("Store not found.");
  }

  const cleanNumericId = shopifyProductId
    .replace(/^gid:\/\/shopify\/Product\//i, "")
    .replace(/^gid%3a%2f%2fshopify%2fproduct%2f/i, "")
    .split("/")
    .pop() || shopifyProductId;

  const matchConditions = [
    { id: shopifyProductId },
    { shopifyProductId: shopifyProductId },
    { shopifyProductId: cleanNumericId },
    { shopifyProductId: `gid://shopify/Product/${cleanNumericId}` },
    { shopifyProductId: { endsWith: cleanNumericId } },
  ];

  const product = await prisma.productCache.findFirst({
    where: {
      storeId: store.id,
      OR: matchConditions,
    },
  });

  if (!product) {
    throw new Error("Target product not found in database.");
  }

  // Resolve genuine base product title so it is never lost or overwritten
  let baseProductTitle = "";
  if (product.title && product.title.includes(" - ")) {
    baseProductTitle = product.title.split(" - ")[0].trim();
  } else if (product.title && !product.title.includes(" / ")) {
    baseProductTitle = product.title.trim();
  } else {
    // Sibling lookup if title was previously corrupted to bare variant like "US 10 / Gray"
    const sibling = await prisma.productCache.findFirst({
      where: {
        shopifyProductId: product.shopifyProductId,
        title: { contains: " - " },
      },
      select: { title: true },
    });
    if (sibling?.title) {
      baseProductTitle = sibling.title.split(" - ")[0].trim();
    } else {
      baseProductTitle = (product.title || "Product").trim();
    }
  }

  const newItems = preview.items.filter((item) => item.status === "New");
  const existingItemsToUpdate = preview.items.filter(
    (item) => item.status === "Existing" && (!item.existingSku || item.existingSku === "N/A")
  );

  if (newItems.length === 0 && existingItemsToUpdate.length === 0) {
    return {
      success: true,
      summary: {
        totalCombinations: preview.totalCombinations,
        createdCount: 0,
        updatedCount: 0,
        existingCount: preview.existingCount,
        skippedCount: 0,
        connectedStoresSyncedCount: 0,
        shopifySyncStatus: "NOT_REQUIRED",
        shopifyMessage: "No new variants or missing SKUs to update.",
      },
    };
  }

  let createdCount = 0;
  let updatedCount = 0;
  let connectedStoresSyncedCount = 0;
  let shopifySyncStatus: "SUCCESS" | "PARTIAL_FAILED" | "FAILED" | "NOT_REQUIRED" = "SUCCESS";
  let shopifyMessage = "";

  // 2. Query existing collections for this product in current store to preserve category/collections
  const existingCollectionProducts = await prisma.collectionProduct.findMany({
    where: {
      productCache: {
        storeId: store.id,
        shopifyProductId: product.shopifyProductId,
      },
    },
    select: { collectionId: true },
    distinct: ["collectionId"],
  });
  const collectionIdsToPreserve = existingCollectionProducts.map((cp) => cp.collectionId);

  // 3. Sync newly generated/updated variants to Shopify Admin API first
  // productSet atomically replaces all variants on Shopify with the provided variantInputs
  const optionInputs = options.map((opt) => ({
    name: opt.name,
    values: opt.values.map((v) => ({ name: v })),
  }));

  const variantInputs = preview.items.map((item) => ({
    optionValues: Object.entries(item.options).map(([name, value]) => ({
      optionName: name,
      name: value,
    })),
    sku: item.generatedSku,
    price: (customPrice !== undefined ? customPrice : item.price || product.price || 0).toString(),
  }));

  const shopifyVariantMap = new Map<string, string>(); // sku/title -> shopifyVariantGid

  try {
    const client = await getAdminClient(store.shopDomain);
    const prodGid = product.shopifyProductId.startsWith("gid://")
      ? product.shopifyProductId
      : `gid://shopify/Product/${product.shopifyProductId}`;

    const response: any = await client.request(
      `
      mutation productSet($input: ProductSetInput!) {
        productSet(input: $input) {
          product {
            id
            title
            variants(first: 100) {
              edges {
                node {
                  id
                  sku
                  title
                  inventoryItem {
                    id
                  }
                }
              }
            }
          }
          userErrors { field message }
        }
      }
    `,
      {
        variables: {
          input: {
            id: prodGid,
            productOptions: optionInputs,
            variants: variantInputs,
          },
        },
      }
    );

    const returnedTitle = response?.data?.productSet?.product?.title || response?.productSet?.product?.title;
    if (returnedTitle && typeof returnedTitle === "string" && returnedTitle.trim()) {
      baseProductTitle = returnedTitle.trim();
    }

    const errors = response?.data?.productSet?.userErrors || response?.productSet?.userErrors || [];
    if (errors.length > 0) {
      shopifySyncStatus = "PARTIAL_FAILED";
      shopifyMessage = `Shopify Notice: ${errors.map((e: any) => e.message).join("; ")}`;
    } else {
      shopifyMessage = `Successfully updated and synchronized variants with Shopify.`;
      const edges = response?.data?.productSet?.product?.variants?.edges || [];
      const defaultLoc = await fetchDefaultLocation(store.shopDomain).catch(() => null);

      for (const edge of edges) {
        const node = edge.node;
        if (node?.sku) {
          shopifyVariantMap.set(node.sku.toLowerCase(), node.id);
        }
        if (node?.title) {
          shopifyVariantMap.set(node.title.toLowerCase(), node.id);
        }

        // Set live inventory on Shopify if preserved stock or custom stock > 0
        if (defaultLoc && node?.inventoryItem?.id) {
          const itemMatch = preview.items.find(
            (it) =>
              (it.generatedSku && node.sku && it.generatedSku.toLowerCase() === node.sku.toLowerCase()) ||
              (it.title && node.title && it.title.toLowerCase() === node.title.toLowerCase())
          );
          const targetQty = customQuantity !== undefined ? customQuantity : itemMatch?.inventoryQuantity || 0;
          if (targetQty > 0) {
            await setInventoryQuantity(store.shopDomain, node.inventoryItem.id, defaultLoc, targetQty).catch((e) =>
              console.warn(`[SKU Application Service] Inventory set notice for variant ${node.sku || node.id}:`, e.message)
            );
          }
        }
      }

      // Automatically publish to Online Store and all channels
      await publishProductToAllChannels(store.shopDomain, prodGid);
    }
  } catch (shopifyErr: any) {
    console.error("[SKU Application Service] Shopify API Warning:", shopifyErr.message);
    shopifySyncStatus = "PARTIAL_FAILED";
    shopifyMessage = `Local DB updated. Shopify sync notice: ${shopifyErr.message}`;
  }

  // 4. In Prisma Transaction: REPLACE old variants with new variants & preserve collections
  try {
    await prisma.$transaction(async (tx) => {
      // Find all old variant cache entries for this product in current store
      const oldVariants = await tx.productCache.findMany({
        where: {
          storeId: store.id,
          shopifyProductId: product.shopifyProductId,
        },
        select: { id: true, shopifyVariantId: true, sku: true },
      });

      const oldVariantIds = oldVariants.map((v) => v.id);

      // Clean up collectionProduct associations for old variants
      if (oldVariantIds.length > 0) {
        await tx.collectionProduct.deleteMany({
          where: { productCacheId: { in: oldVariantIds } },
        });

        // Clean up variantMaps for old variants
        await tx.variantMap.deleteMany({
          where: {
            storeId: store.id,
            shopifyProductId: product.shopifyProductId,
          },
        });

        // Remove all old variant cache records
        await tx.productCache.deleteMany({
          where: { id: { in: oldVariantIds } },
        });
      }

      // Create all replacement variants with new SKUs, options, and preserve collections
      for (const item of preview.items) {
        const shopifyGid =
          (item.generatedSku && shopifyVariantMap.get(item.generatedSku.toLowerCase())) ||
          shopifyVariantMap.get(item.title.toLowerCase()) ||
          `gid://shopify/ProductVariant/generated-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

        const price = customPrice !== undefined ? customPrice : item.price || product.price || 0;
        const qty =
          customQuantity !== undefined
            ? customQuantity
            : typeof item.inventoryQuantity === "number"
            ? item.inventoryQuantity
            : (product.inventoryQuantity || 0);

        // Preserve product title and append variant options at the backside:
        // Format: "<Product Title> - <Option1> / <Option2>" (e.g. "Premium Running Shoes - US 10 / Gray")
        const variantSuffix = item.title && item.title !== "Default Title" ? item.title.trim() : "";
        let fullVariantTitle = baseProductTitle;
        if (variantSuffix) {
          if (variantSuffix.toLowerCase().startsWith(baseProductTitle.toLowerCase() + " - ")) {
            fullVariantTitle = variantSuffix;
          } else {
            fullVariantTitle = `${baseProductTitle} - ${variantSuffix}`;
          }
        }

        const newRecord = await tx.productCache.create({
          data: {
            storeId: store.id,
            shopifyProductId: product.shopifyProductId,
            shopifyVariantId: shopifyGid,
            sku: item.generatedSku,
            title: fullVariantTitle,
            tags: product.tags,
            imageUrl: product.imageUrl,
            price,
            basePrice: price,
            inventoryQuantity: qty,
            optionsJson: item.options as any,
          },
        });

        // Attach each replacement variant to original collection(s) (e.g. Shoes)
        // so it NEVER becomes "Uncategorized"
        for (const collId of collectionIdsToPreserve) {
          await tx.collectionProduct.create({
            data: {
              collectionId: collId,
              productCacheId: newRecord.id,
            },
          });
        }

        // Add variantMap mapping for inventory sync
        if (item.generatedSku) {
          await tx.variantMap.create({
            data: {
              sku: item.generatedSku,
              storeId: store.id,
              shopifyProductId: product.shopifyProductId,
              shopifyVariantId: shopifyGid,
            },
          });
        }

        createdCount++;
      }

      // Update store SKU sequence counter
      if (createdCount > 0) {
        await tx.storeSetting.updateMany({
          where: { storeId: store.id },
          data: { skuSequence: { increment: createdCount } },
        });
      }
    });
  } catch (dbErr: any) {
    console.error("[SKU Application Service] DB Transaction Error:", dbErr.message);
    throw new Error(`Failed to save replacement variants to database: ${dbErr.message}`);
  }

  // 5. Record Activity Log & Notification for the active store
  const storeLabel = store.label || store.shopDomain;
  try {
    await prisma.activityLog.create({
      data: {
        storeId: store.id,
        productId: product.id,
        productTitle: product.title,
        sku: preview.items[0]?.generatedSku || null,
        imageUrl: product.imageUrl,
        eventType: "UPDATE",
        quantity: createdCount,
        description: `Replaced and updated ${createdCount} variant SKUs for "${product.title}" in ${storeLabel}`,
      },
    });

    await createNotification({
      recipientStoreId: store.id,
      type: "PRODUCT_UPDATED",
      title: "SKUs Applied Successfully",
      message: `Replaced and updated ${createdCount} variant SKUs for "${baseProductTitle}" in ${storeLabel}`,
      productId: product.shopifyProductId,
      productTitle: baseProductTitle,
      sourceStoreId: store.id,
    });
  } catch (logErr: any) {
    console.error("[SKU Application Service] Log Warning:", logErr.message);
  }

  // 6. MASTER STORE SCOPING: Auto-propagate replaced variants & SKUs to Connected Target Stores
  // If store is Master, replace variants in all connected target stores!
  // If store is Standalone, affects ONLY local store (no propagation).
  if (store.isMaster) {
    try {
      const connections = await (prisma as any).storeConnection.findMany({
        where: { sourceStoreId: store.id },
      });
      const targetStoreIds = connections.map((c: any) => c.targetStoreId);

      if (targetStoreIds.length > 0) {
        const targetStores = await prisma.store.findMany({
          where: { id: { in: targetStoreIds }, isActive: true },
        });

        // Get product collection titles for price adjustment rules
        const productCollections = await prisma.collectionProduct.findMany({
          where: { productCacheId: product.id },
          include: { collection: true },
        });
        const collectionTitles = productCollections.map((pc) => pc.collection.title);

        for (const targetStore of targetStores) {
          try {
            const targetStoreLabel = targetStore.label || targetStore.shopDomain;

            // Find matching product in target store with flexible matching
            let targetProduct = await prisma.productCache.findFirst({
              where: {
                storeId: targetStore.id,
                OR: [
                  ...matchConditions,
                  { title: product.title },
                ],
              },
            });

            if (!targetProduct) continue;

            // Query target store collections for this product to preserve category
            const targetColls = await prisma.collectionProduct.findMany({
              where: {
                productCache: {
                  storeId: targetStore.id,
                  shopifyProductId: targetProduct.shopifyProductId,
                },
              },
              select: { collectionId: true },
              distinct: ["collectionId"],
            });
            const targetCollIds = targetColls.map((c) => c.collectionId);

            // Sync to target store's Shopify API if active
            const targetShopifyVariantMap = new Map<string, string>();
            let targetShopifyTitle: string | null = null;
            try {
              const targetClient = await getAdminClient(targetStore.shopDomain);
              const targetProdGid = targetProduct.shopifyProductId.startsWith("gid://")
                ? targetProduct.shopifyProductId
                : `gid://shopify/Product/${targetProduct.shopifyProductId}`;

              const tVariantInputs = preview.items.map((item) => ({
                optionValues: Object.entries(item.options).map(([name, value]) => ({
                  optionName: name,
                  name: value,
                })),
                sku: item.generatedSku,
                price: (item.price || product.price || 0).toString(),
              }));

              const tResponse: any = await targetClient.request(
                `
                mutation productSet($input: ProductSetInput!) {
                  productSet(input: $input) {
                    product {
                      id
                      title
                      variants(first: 100) {
                        edges {
                          node {
                            id
                            sku
                            title
                            inventoryItem {
                              id
                            }
                          }
                        }
                      }
                    }
                    userErrors { field message }
                  }
                }
              `,
                {
                  variables: {
                    input: {
                      id: targetProdGid,
                      productOptions: optionInputs,
                      variants: tVariantInputs,
                    },
                  },
                }
              );

              targetShopifyTitle = tResponse?.data?.productSet?.product?.title || tResponse?.productSet?.product?.title || null;

              const tEdges = tResponse?.data?.productSet?.product?.variants?.edges || [];
              const targetLoc = await fetchDefaultLocation(targetStore.shopDomain).catch(() => null);

              for (const edge of tEdges) {
                const node = edge.node;
                if (node?.sku) targetShopifyVariantMap.set(node.sku.toLowerCase(), node.id);
                if (node?.title) targetShopifyVariantMap.set(node.title.toLowerCase(), node.id);

                if (targetLoc && node?.inventoryItem?.id) {
                  const itemMatch = preview.items.find(
                    (it) =>
                      (it.generatedSku && node.sku && it.generatedSku.toLowerCase() === node.sku.toLowerCase()) ||
                      (it.title && node.title && it.title.toLowerCase() === node.title.toLowerCase())
                  );
                  const targetQty = itemMatch?.inventoryQuantity || 0;
                  if (targetQty > 0) {
                    await setInventoryQuantity(targetStore.shopDomain, node.inventoryItem.id, targetLoc, targetQty).catch(() => {});
                  }
                }
              }

              // Automatically publish target product to Online Store and all channels
              await publishProductToAllChannels(targetStore.shopDomain, targetProdGid);
            } catch (tShopifyErr: any) {
              console.warn(`[SKU Application Service] Target store Shopify notice (${targetStoreLabel}):`, tShopifyErr.message);
            }

            // Replace variants in target store ProductCache
            let targetCreatedCount = 0;
            await prisma.$transaction(async (tx) => {
              // Delete old target variants
              const oldTargetVariants = await tx.productCache.findMany({
                where: {
                  storeId: targetStore.id,
                  shopifyProductId: targetProduct.shopifyProductId,
                },
                select: { id: true },
              });
              const oldTargetIds = oldTargetVariants.map((v) => v.id);

              if (oldTargetIds.length > 0) {
                await tx.collectionProduct.deleteMany({
                  where: { productCacheId: { in: oldTargetIds } },
                });
                await tx.variantMap.deleteMany({
                  where: {
                    storeId: targetStore.id,
                    shopifyProductId: targetProduct.shopifyProductId,
                  },
                });
                await tx.productCache.deleteMany({
                  where: { id: { in: oldTargetIds } },
                });
              }

              let targetBaseTitle = "";
              if (targetShopifyTitle && typeof targetShopifyTitle === "string" && targetShopifyTitle.trim()) {
                targetBaseTitle = targetShopifyTitle.trim();
              } else if (targetProduct.title && targetProduct.title.includes(" - ")) {
                targetBaseTitle = targetProduct.title.split(" - ")[0].trim();
              } else if (targetProduct.title && !targetProduct.title.includes(" / ")) {
                targetBaseTitle = targetProduct.title.trim();
              } else {
                targetBaseTitle = baseProductTitle;
              }

              // Create new replacement variants in target store
              for (const item of preview.items) {
                const adjustedPriceStr = await calculateAdjustedPrice(
                  item.price || product.price || 0,
                  targetStore,
                  collectionTitles
                );
                const adjustedPriceNum = parseFloat(adjustedPriceStr);

                const tVariantGid =
                  (item.generatedSku && targetShopifyVariantMap.get(item.generatedSku.toLowerCase())) ||
                  targetShopifyVariantMap.get(item.title.toLowerCase()) ||
                  `gid://shopify/ProductVariant/generated-conn-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

                const variantSuffix = item.title && item.title !== "Default Title" ? item.title.trim() : "";
                let targetFullTitle = targetBaseTitle;
                if (variantSuffix) {
                  if (variantSuffix.toLowerCase().startsWith(targetBaseTitle.toLowerCase() + " - ")) {
                    targetFullTitle = variantSuffix;
                  } else {
                    targetFullTitle = `${targetBaseTitle} - ${variantSuffix}`;
                  }
                }

                const newTRecord = await tx.productCache.create({
                  data: {
                    storeId: targetStore.id,
                    shopifyProductId: targetProduct.shopifyProductId,
                    shopifyVariantId: tVariantGid,
                    sku: item.generatedSku,
                    title: targetFullTitle,
                    tags: targetProduct.tags,
                    imageUrl: targetProduct.imageUrl || product.imageUrl,
                    price: adjustedPriceNum,
                    basePrice: item.price || product.price || 0,
                    inventoryQuantity: item.inventoryQuantity || 0,
                    optionsJson: item.options as any,
                  },
                });

                // Attach to target store collections
                for (const collId of targetCollIds) {
                  await tx.collectionProduct.create({
                    data: {
                      collectionId: collId,
                      productCacheId: newTRecord.id,
                    },
                  });
                }

                // Add variantMap for target store
                if (item.generatedSku) {
                  await tx.variantMap.create({
                    data: {
                      sku: item.generatedSku,
                      storeId: targetStore.id,
                      shopifyProductId: targetProduct.shopifyProductId,
                      shopifyVariantId: tVariantGid,
                    },
                  });
                }

                targetCreatedCount++;
              }
            });

            // Log Activity & Notification for target store
            await prisma.activityLog.create({
              data: {
                storeId: targetStore.id,
                productId: targetProduct.id,
                productTitle: targetProduct.title,
                sku: preview.items[0]?.generatedSku || null,
                imageUrl: targetProduct.imageUrl || product.imageUrl,
                eventType: "UPDATE",
                quantity: targetCreatedCount,
                description: `Synced & replaced ${targetCreatedCount} variant SKUs from Master Store (${storeLabel}) for "${targetProduct.title}"`,
              },
            });

            await createNotification({
              recipientStoreId: targetStore.id,
              type: "CONNECTED_STORE_UPDATE",
              title: "Master Store SKUs Synchronized",
              message: `Synchronized & replaced ${targetCreatedCount} variant SKUs from Master Store (${storeLabel}) for "${targetProduct.title}"`,
              productId: targetProduct.shopifyProductId,
              productTitle: targetProduct.title,
              sourceStoreId: store.id,
              targetStoreId: targetStore.id,
            });

            connectedStoresSyncedCount++;
          } catch (targetErr: any) {
            console.error(`[SKU Application Service] Error propagating to connected store (${targetStore.shopDomain}):`, targetErr.message);
          }
        }
      }
    } catch (masterErr: any) {
      console.error("[SKU Application Service] Master store propagation warning:", masterErr.message);
    }
  }

  return {
    success: true,
    summary: {
      totalCombinations: preview.totalCombinations,
      createdCount,
      updatedCount,
      existingCount: preview.existingCount,
      skippedCount: 0,
      connectedStoresSyncedCount,
      shopifySyncStatus,
      shopifyMessage,
    },
  };
}
