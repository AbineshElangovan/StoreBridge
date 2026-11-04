import { prisma } from "@/lib/db/prisma";
import { getAdminClient } from "@/lib/shopify/admin";

export const GLOBAL_APP_PREFIX = "STB";

/**
 * Extracts a normalized, URL/SKU-safe variant option slug.
 * Examples:
 *   - variant with option1="Blue", option2="XL" -> "BLUE-XL"
 *   - variant title="Blue / XL" -> "BLUE-XL"
 *   - variant title="mens shirt - Blue / XL" with baseTitle="mens shirt" -> "BLUE-XL"
 *   - variant title="Default Title" -> ""
 */
export function extractVariantOptionsSlug(variant: any, baseProductTitle?: string): string {
  if (!variant) return "";

  // 1. Check selectedOptions (Shopify GraphQL format)
  if (Array.isArray(variant.selectedOptions) && variant.selectedOptions.length > 0) {
    const valid = variant.selectedOptions
      .filter((o: any) => o && o.name !== "Title" && o.value && o.value !== "Default Title")
      .map((o: any) => o.value);
    if (valid.length > 0) {
      return valid
        .map((v: string) =>
          v
            .toString()
            .toUpperCase()
            .replace(/[\s\/]+/g, "-")
            .replace(/[^A-Z0-9\-]/g, "")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
        )
        .filter(Boolean)
        .join("-");
    }
  }

  // 2. Check option1, option2, option3 (Shopify REST / Webhook format)
  const rawOpts = [variant.option1, variant.option2, variant.option3].filter(
    (o: any) => o && o !== "Default Title"
  );
  if (rawOpts.length > 0) {
    return rawOpts
      .map((o: any) =>
        o
          .toString()
          .toUpperCase()
          .replace(/[\s\/]+/g, "-")
          .replace(/[^A-Z0-9\-]/g, "")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
      )
      .filter(Boolean)
      .join("-");
  }

  // 3. Fallback to variant.title
  let rawTitle = variant.title || "";
  if (rawTitle && rawTitle !== "Default Title") {
    // Strip product title prefix if title is "Product Title - Option1 / Option2"
    if (baseProductTitle && rawTitle.toLowerCase().startsWith(baseProductTitle.toLowerCase() + " - ")) {
      rawTitle = rawTitle.slice(baseProductTitle.length + 3);
    } else if (rawTitle.includes(" - ")) {
      rawTitle = rawTitle.split(" - ").slice(1).join(" - ");
    }
    return rawTitle
      .toUpperCase()
      .replace(/[\s\/]+/g, "-")
      .replace(/[^A-Z0-9\-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  return "";
}

/**
 * Builds the SKU string according to the StoreBridge pattern:
 * Format: STB-[StorePrefix]-[OptionalCollectionPrefix]-[VariantOptionsSlug]-[SequencePadded]
 */
export function buildSkuString(
  storePrefix: string,
  optionsStr: string,
  sequence: number,
  collectionPrefix?: string | null
): string {
  const parts: string[] = [GLOBAL_APP_PREFIX, (storePrefix || "SKU").trim().toUpperCase()];

  if (collectionPrefix && collectionPrefix.trim()) {
    parts.push(collectionPrefix.trim().toUpperCase());
  }

  if (optionsStr && optionsStr.trim()) {
    parts.push(optionsStr.trim().toUpperCase());
  }

  const paddedSeq = sequence.toString().padStart(4, "0");
  parts.push(paddedSeq);

  return parts.join("-");
}

/**
 * Automatically generates SKUs for all variants of a product if they are missing or "N/A".
 * Works for Master, Standalone, and Sub stores.
 * Updates StoreSetting.skuSequence by the exact number of variants assigned.
 * Directly saves to ProductCache, VariantMap, and pushes to Shopify.
 */
export async function generateSkusForProductIfNeeded(shopDomain: string, payload: any) {
  const store = await prisma.store.findUnique({ where: { shopDomain } });
  if (!store) return payload;

  let setting = await prisma.storeSetting.findUnique({ where: { storeId: store.id } });
  if (!setting) {
    setting = await prisma.storeSetting.create({
      data: {
        storeId: store.id,
        skuPrefix: "SKU",
        skuSequence: 1,
        isSkuGenerationEnabled: true,
      },
    });
  }

  if (!setting.isSkuGenerationEnabled) {
    return payload;
  }

  const variants = payload.variants || [];
  if (variants.length === 0) return payload;

  const numericProductId = payload.admin_graphql_api_id
    ? payload.admin_graphql_api_id.replace("gid://shopify/Product/", "")
    : payload.id.toString();
  const graphqlProductId = `gid://shopify/Product/${numericProductId}`;

  // 1. Fetch active collection rules for this store
  const activeRules = await prisma.collectionSkuRule.findMany({
    where: { storeId: store.id, enabled: true },
    include: { collection: true },
  });

  let appliedRule: any = null;
  if (activeRules.length > 0) {
    try {
      const payloadTags = (payload.tags || "")
        .split(",")
        .map((t: string) => t.trim().toLowerCase());
      const payloadCollections = (payload.collections || []).map((c: any) =>
        (c.id || c.shopifyCollectionId || "").toString()
      );

      activeRules.sort((a, b) => a.collection.title.localeCompare(b.collection.title));

      for (const rule of activeRules) {
        const titleLower = rule.collection.title.toLowerCase();
        const tagMatches = payloadTags.some(
          (tag: string) => titleLower.includes(tag) || tag.includes(titleLower)
        );
        const colMatches = payloadCollections.includes(rule.collection.shopifyCollectionId);

        if (tagMatches || colMatches) {
          appliedRule = rule;
          break;
        }
      }
    } catch (err: any) {
      console.warn("[SKU Generator] Collection check error:", err.message);
    }
  }

  // Resolve collection prefix string if rule applies
  let colPrefix: string | null = null;
  if (appliedRule) {
    if (appliedRule.skuPrefix?.trim()) {
      colPrefix = appliedRule.skuPrefix.trim().toUpperCase();
    } else if (appliedRule.collection?.title) {
      const words = appliedRule.collection.title.trim().split(/[\s\-]+/).filter(Boolean);
      if (words.length === 1) {
        colPrefix = words[0].substring(0, 3).toUpperCase();
      } else if (words.length === 2) {
        colPrefix = (words[0][0] + words[1].substring(0, 2)).toUpperCase();
      } else if (words.length >= 3) {
        colPrefix = (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
      }
      colPrefix = (colPrefix || "COL").padEnd(3, "X").substring(0, 3);
    }
  }

  const variantsToUpdate: any[] = [];
  const baseProductTitle = payload.title || "Product";

  for (const variant of variants) {
    const numericVariantId = variant.admin_graphql_api_id
      ? variant.admin_graphql_api_id.replace("gid://shopify/ProductVariant/", "")
      : variant.id.toString();
    const shopifyVariantId = `gid://shopify/ProductVariant/${numericVariantId}`;

    const existingValidSku =
      variant.sku && variant.sku !== "N/A" && variant.sku.trim() !== "";

    let variantBase = await prisma.variantBaseSku.findUnique({
      where: {
        storeId_shopifyVariantId: {
          storeId: store.id,
          shopifyVariantId: numericVariantId,
        },
      },
    });

    if (existingValidSku && !variantBase) {
      // Keep merchant's explicit valid SKU
      continue;
    }

    let sequenceToUse = 1;
    if (!variantBase) {
      // Increment global sequence in StoreSetting
      const updatedSetting = await prisma.storeSetting.update({
        where: { storeId: store.id },
        data: { skuSequence: { increment: 1 } },
        select: { skuSequence: true },
      });
      sequenceToUse = updatedSetting.skuSequence - 1;

      variantBase = await prisma.variantBaseSku.create({
        data: {
          storeId: store.id,
          shopifyVariantId: numericVariantId,
          baseSequence: sequenceToUse,
        },
      });
    } else {
      sequenceToUse = variantBase.baseSequence;
    }

    const optionsStr = extractVariantOptionsSlug(variant, baseProductTitle);
    const expectedSku = buildSkuString(
      setting.skuPrefix || "SKU",
      optionsStr,
      sequenceToUse,
      colPrefix
    );

    if (variant.sku !== expectedSku) {
      variant.sku = expectedSku;
      variantsToUpdate.push({
        variant,
        shopifyVariantId,
        numericVariantId,
        sku: expectedSku,
      });
    }
  }

  // Persist generated SKUs in local DB and push to Shopify
  if (variantsToUpdate.length > 0) {
    for (const item of variantsToUpdate) {
      // 1. Update ProductCache
      await prisma.productCache.updateMany({
        where: {
          storeId: store.id,
          shopifyVariantId: item.shopifyVariantId,
        },
        data: { sku: item.sku },
      });

      // 2. Update VariantMap
      await prisma.variantMap.upsert({
        where: {
          storeId_shopifyVariantId: {
            storeId: store.id,
            shopifyVariantId: item.shopifyVariantId,
          },
        },
        update: { sku: item.sku },
        create: {
          storeId: store.id,
          shopifyProductId: graphqlProductId,
          shopifyVariantId: item.shopifyVariantId,
          sku: item.sku,
        },
      });
    }

    // 3. Push to Shopify Admin via GraphQL mutation
    try {
      const client = await getAdminClient(shopDomain);
      const formattedVariants = variantsToUpdate.map((item) => ({
        id: item.shopifyVariantId,
        inventoryItem: { sku: item.sku },
      }));

      const updateMutation = `
        mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            userErrors { field message }
          }
        }
      `;
      const shopifyRes: any = await client.request(updateMutation, {
        variables: {
          productId: graphqlProductId,
          variants: formattedVariants,
        },
      });
      const errors =
        shopifyRes?.data?.productVariantsBulkUpdate?.userErrors ||
        shopifyRes?.productVariantsBulkUpdate?.userErrors ||
        [];
      if (errors.length > 0) {
        console.warn(
          `[SKU Generator] Shopify push userErrors for ${graphqlProductId}:`,
          errors
        );
      } else {
        console.log(
          `[SKU Generator] Successfully synced ${variantsToUpdate.length} variant SKUs to Shopify for ${graphqlProductId}`
        );
      }
    } catch (pushErr: any) {
      console.warn(`[SKU Generator] Notice pushing SKUs to Shopify:`, pushErr.message);
    }
  }

  return payload;
}

/**
 * Immediate single-variant SKU resolver.
 * Used during cache ingestion (updateLocalProductCache & bulk-sync) if a variant arrives without a SKU.
 */
export async function resolveOrGenerateSkuForVariant(
  storeId: string,
  shopifyProductId: string,
  variant: any,
  baseProductTitle?: string
): Promise<string> {
  const existingSku = variant.sku?.trim();
  if (existingSku && existingSku !== "N/A") {
    return existingSku;
  }

  let setting = await prisma.storeSetting.findUnique({ where: { storeId } });
  if (!setting) {
    setting = await prisma.storeSetting.create({
      data: {
        storeId,
        skuPrefix: "SKU",
        skuSequence: 1,
        isSkuGenerationEnabled: true,
      },
    });
  }

  const numericVariantId = variant.admin_graphql_api_id
    ? variant.admin_graphql_api_id.replace("gid://shopify/ProductVariant/", "")
    : (variant.id || "").toString();

  let sequenceToUse = 1;
  let variantBase: any = null;

  if (numericVariantId) {
    variantBase = await prisma.variantBaseSku.findUnique({
      where: {
        storeId_shopifyVariantId: {
          storeId,
          shopifyVariantId: numericVariantId,
        },
      },
    });
  }

  if (!variantBase) {
    const updatedSetting = await prisma.storeSetting.update({
      where: { storeId },
      data: { skuSequence: { increment: 1 } },
      select: { skuSequence: true },
    });
    sequenceToUse = updatedSetting.skuSequence - 1;

    if (numericVariantId) {
      await prisma.variantBaseSku.create({
        data: {
          storeId,
          shopifyVariantId: numericVariantId,
          baseSequence: sequenceToUse,
        },
      }).catch(() => null);
    }
  } else {
    sequenceToUse = variantBase.baseSequence;
  }

  const optionsStr = extractVariantOptionsSlug(variant, baseProductTitle);
  const generatedSku = buildSkuString(
    setting.skuPrefix || "SKU",
    optionsStr,
    sequenceToUse
  );

  return generatedSku;
}

/**
 * Backfill & auto-assign routine.
 * Finds all ProductCache records that currently have missing, empty, or "N/A" SKUs
 * and assigns them proper sequential SKUs derived from Global SKU settings.
 * Pushes the updated SKUs to Shopify.
 */
export async function autoAssignMissingSkus(storeId?: string): Promise<{ updatedCount: number }> {
  try {
    const whereClause: any = {
      OR: [{ sku: null }, { sku: "" }, { sku: "N/A" }],
    };
    if (storeId) {
      whereClause.storeId = storeId;
    }

    const missingCaches = await prisma.productCache.findMany({
      where: whereClause,
      include: {
        store: true,
        collections: { include: { collection: true } },
      },
    });

    if (missingCaches.length === 0) {
      return { updatedCount: 0 };
    }

    console.log(`[AutoAssignMissingSkus] Found ${missingCaches.length} variants needing SKUs.`);

    // Group by store and product
    const grouped = new Map<string, typeof missingCaches>();
    for (const item of missingCaches) {
      const key = `${item.storeId}:::${item.shopifyProductId}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    }

    let totalUpdated = 0;

    for (const [key, items] of grouped.entries()) {
      const [currentStoreId, shopifyProductId] = key.split(":::");
      const store = items[0].store;
      if (!store) continue;

      let setting = await prisma.storeSetting.findUnique({ where: { storeId: currentStoreId } });
      if (!setting) {
        setting = await prisma.storeSetting.create({
          data: {
            storeId: currentStoreId,
            skuPrefix: "SKU",
            skuSequence: 1,
            isSkuGenerationEnabled: true,
          },
        });
      }

      const variantsToPush: any[] = [];

      for (const item of items) {
        const numericVariantId = item.shopifyVariantId.replace("gid://shopify/ProductVariant/", "");

        let variantBase = await prisma.variantBaseSku.findUnique({
          where: {
            storeId_shopifyVariantId: {
              storeId: currentStoreId,
              shopifyVariantId: numericVariantId,
            },
          },
        });

        let sequenceToUse = 1;
        if (!variantBase) {
          const updated = await prisma.storeSetting.update({
            where: { storeId: currentStoreId },
            data: { skuSequence: { increment: 1 } },
            select: { skuSequence: true },
          });
          sequenceToUse = updated.skuSequence - 1;

          variantBase = await prisma.variantBaseSku.create({
            data: {
              storeId: currentStoreId,
              shopifyVariantId: numericVariantId,
              baseSequence: sequenceToUse,
            },
          }).catch(() => null);
        } else {
          sequenceToUse = variantBase.baseSequence;
        }

        const baseTitle = item.title ? item.title.split(" - ")[0].trim() : "Product";
        const optionsStr = extractVariantOptionsSlug({ title: item.title, optionsJson: item.optionsJson }, baseTitle);
        const generatedSku = buildSkuString(setting.skuPrefix || "SKU", optionsStr, sequenceToUse);

        // Update DB
        await prisma.productCache.update({
          where: { id: item.id },
          data: { sku: generatedSku },
        });

        await prisma.variantMap.upsert({
          where: {
            storeId_shopifyVariantId: {
              storeId: currentStoreId,
              shopifyVariantId: item.shopifyVariantId,
            },
          },
          update: { sku: generatedSku },
          create: {
            storeId: currentStoreId,
            shopifyProductId,
            shopifyVariantId: item.shopifyVariantId,
            sku: generatedSku,
          },
        });

        variantsToPush.push({
          id: item.shopifyVariantId,
          sku: generatedSku,
        });

        totalUpdated++;
      }

      // Sync to Shopify
      if (variantsToPush.length > 0 && store.shopDomain) {
        try {
          const client = await getAdminClient(store.shopDomain);
          const formatted = variantsToPush.map((v) => ({
            id: v.id,
            inventoryItem: { sku: v.sku },
          }));
          const updateMutation = `
            mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                userErrors { field message }
              }
            }
          `;
          await client.request(updateMutation, {
            variables: {
              productId: shopifyProductId,
              variants: formatted,
            },
          });
        } catch (pushErr: any) {
          console.warn(`[AutoAssignMissingSkus] Notice syncing to Shopify for ${shopifyProductId}:`, pushErr.message);
        }
      }
    }

    return { updatedCount: totalUpdated };
  } catch (err: any) {
    console.error("[AutoAssignMissingSkus] Error:", err.message);
    return { updatedCount: 0 };
  }
}
