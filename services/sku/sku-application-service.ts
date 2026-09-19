import { prisma } from "@/lib/db/prisma";
import { getAdminClient } from "@/lib/shopify/admin";
import { createNotification } from "@/services/notification-service";
import { calculateAdjustedPrice } from "@/services/shopify/pricing";
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

  // 2. Perform DB creation and missing SKU updates inside Prisma transaction
  try {
    await prisma.$transaction(async (tx) => {
      // Create new variants
      for (const item of newItems) {
        const dummyVariantGid = `gid://shopify/ProductVariant/generated-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const price = customPrice !== undefined ? customPrice : product.price || 0;
        const qty = customQuantity !== undefined ? customQuantity : product.inventoryQuantity || 0;

        await tx.productCache.create({
          data: {
            storeId: store.id,
            shopifyProductId: product.shopifyProductId,
            shopifyVariantId: dummyVariantGid,
            sku: item.generatedSku,
            title: item.title,
            tags: product.tags,
            imageUrl: product.imageUrl,
            price,
            basePrice: price,
            inventoryQuantity: qty,
            optionsJson: item.options as any,
          },
        });
        createdCount++;
      }

      // Update existing variants that were missing SKUs
      for (const item of existingItemsToUpdate) {
        if (item.existingVariantId) {
          await tx.productCache.update({
            where: { id: item.existingVariantId },
            data: { sku: item.generatedSku },
          });
          updatedCount++;
        }
      }

      // Update store SKU sequence counter
      const totalChanges = createdCount + updatedCount;
      if (totalChanges > 0) {
        await tx.storeSetting.updateMany({
          where: { storeId: store.id },
          data: { skuSequence: { increment: totalChanges } },
        });
      }
    });
  } catch (dbErr: any) {
    console.error("[SKU Application Service] DB Transaction Error:", dbErr.message);
    throw new Error(`Failed to save variants to database: ${dbErr.message}`);
  }

  // 3. Sync newly generated variants to Shopify Admin API for current store
  try {
    const client = await getAdminClient(store.shopDomain);
    const prodGid = product.shopifyProductId.startsWith("gid://")
      ? product.shopifyProductId
      : `gid://shopify/Product/${product.shopifyProductId}`;

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

    const response: any = await client.request(
      `
      mutation productSet($input: ProductSetInput!) {
        productSet(input: $input) {
          product {
            id
            variants(first: 100) {
              edges {
                node {
                  id
                  sku
                  title
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

    const errors = response?.data?.productSet?.userErrors || response?.productSet?.userErrors || [];
    if (errors.length > 0) {
      shopifySyncStatus = "PARTIAL_FAILED";
      shopifyMessage = `Shopify Notice: ${errors.map((e: any) => e.message).join("; ")}`;
    } else {
      shopifyMessage = `Successfully synchronized ${createdCount + updatedCount} variants with Shopify.`;
    }
  } catch (shopifyErr: any) {
    console.error("[SKU Application Service] Shopify API Warning:", shopifyErr.message);
    shopifySyncStatus = "PARTIAL_FAILED";
    shopifyMessage = `Local DB updated (${createdCount} created, ${updatedCount} updated). Shopify sync notice: ${shopifyErr.message}`;
  }

  // 4. Record Activity Log & Notification for the active store
  const storeLabel = store.label || store.shopDomain;
  try {
    await prisma.activityLog.create({
      data: {
        storeId: store.id,
        productId: product.id,
        productTitle: product.title,
        sku: newItems[0]?.generatedSku || existingItemsToUpdate[0]?.generatedSku || null,
        imageUrl: product.imageUrl,
        eventType: createdCount > 0 ? "CREATE" : "UPDATE",
        quantity: createdCount + updatedCount,
        description: `Generated & applied ${createdCount + updatedCount} variant SKUs for "${product.title}" in ${storeLabel}`,
      },
    });

    await createNotification({
      recipientStoreId: store.id,
      type: "PRODUCT_UPDATED",
      title: "SKUs Applied Successfully",
      message: `Generated and applied ${createdCount + updatedCount} variant SKUs for "${product.title}" in ${storeLabel}`,
      productId: product.shopifyProductId,
      productTitle: product.title,
      sourceStoreId: store.id,
    });
  } catch (logErr: any) {
    console.error("[SKU Application Service] Log Warning:", logErr.message);
  }

  // 5. MASTER STORE SCOPING: Auto-propagate generated variants & SKUs to Connected Target Stores
  // If store is Master, propagate to all connected target stores!
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

            let targetCreatedCount = 0;
            for (const item of newItems) {
              const adjustedPriceStr = await calculateAdjustedPrice(
                item.price || product.price || 0,
                targetStore,
                collectionTitles
              );
              const adjustedPriceNum = parseFloat(adjustedPriceStr);

              const dummyVariantGid = `gid://shopify/ProductVariant/generated-conn-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

              await prisma.productCache.create({
                data: {
                  storeId: targetStore.id,
                  shopifyProductId: targetProduct.shopifyProductId,
                  shopifyVariantId: dummyVariantGid,
                  sku: item.generatedSku,
                  title: item.title,
                  tags: targetProduct.tags,
                  imageUrl: targetProduct.imageUrl || product.imageUrl,
                  price: adjustedPriceNum,
                  basePrice: item.price || product.price || 0,
                  inventoryQuantity: item.inventoryQuantity || 0,
                  optionsJson: item.options as any,
                },
              });
              targetCreatedCount++;
            }

            // Sync to target store's Shopify API if active
            try {
              const targetClient = await getAdminClient(targetStore.shopDomain);
              const targetProdGid = targetProduct.shopifyProductId.startsWith("gid://")
                ? targetProduct.shopifyProductId
                : `gid://shopify/Product/${targetProduct.shopifyProductId}`;

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
                price: (item.price || product.price || 0).toString(),
              }));

              await targetClient.request(
                `
                mutation productSet($input: ProductSetInput!) {
                  productSet(input: $input) {
                    product { id }
                    userErrors { field message }
                  }
                }
              `,
                {
                  variables: {
                    input: {
                      id: targetProdGid,
                      productOptions: optionInputs,
                      variants: variantInputs,
                    },
                  },
                }
              );
            } catch (tShopifyErr: any) {
              console.warn(`[SKU Application Service] Target store Shopify notice (${targetStoreLabel}):`, tShopifyErr.message);
            }

            // Log Activity & Notification for target store
            await prisma.activityLog.create({
              data: {
                storeId: targetStore.id,
                productId: targetProduct.id,
                productTitle: targetProduct.title,
                sku: newItems[0]?.generatedSku || null,
                imageUrl: targetProduct.imageUrl || product.imageUrl,
                eventType: "CREATE",
                quantity: targetCreatedCount,
                description: `Synced ${targetCreatedCount} new variant SKUs from Master Store (${storeLabel}) for "${targetProduct.title}"`,
              },
            });

            await createNotification({
              recipientStoreId: targetStore.id,
              type: "CONNECTED_STORE_UPDATE",
              title: "Master Store SKUs Synchronized",
              message: `Synchronized ${targetCreatedCount} new variant SKUs from Master Store (${storeLabel}) for "${targetProduct.title}"`,
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
