import { prisma } from '@/lib/db/prisma';

export interface PreorderConfigInput {
  enabled?: boolean;
  inventoryThreshold?: number;
  customerMessage?: string;
  shippingMessage?: string;
  fulfillmentMessage?: string;
  maxQuantity?: number | null;
  discountType?: 'none' | 'percentage' | 'fixed';
  discountValue?: number;
  selectionMode?: 'ALL_PRODUCTS' | 'SPECIFIC_PRODUCTS' | 'COLLECTIONS';
  selectedProductIds?: string[];
  selectedCollectionIds?: string[];
  shopifyProductId?: string | null;
  shopifyVariantId?: string | null;
}

export interface PreorderPriceCalculation {
  originalPrice: number;
  discountType: 'none' | 'percentage' | 'fixed';
  discountValue: number;
  discountAmount: number;
  finalPrice: number;
  formattedOriginalPrice: string;
  formattedDiscountAmount: string;
  formattedFinalPrice: string;
  savingsText: string;
  offerBadge: string;
}

export const DEFAULT_PREORDER_CONFIG = {
  enabled: true,
  inventoryThreshold: 0,
  customerMessage: "Pre-order before it's gone.",
  shippingMessage: "Shipping: As soon as possible",
  fulfillmentMessage: "We will fulfill the item as soon as it becomes available",
  maxQuantity: null as number | null,
  discountType: 'none' as 'none' | 'percentage' | 'fixed',
  discountValue: 0,
  selectionMode: 'ALL_PRODUCTS' as 'ALL_PRODUCTS' | 'SPECIFIC_PRODUCTS' | 'COLLECTIONS',
  selectedProductIds: [] as string[],
  selectedCollectionIds: [] as string[],
};

export class PreorderService {
  /**
   * Determine whether a product or variant is targeted by the store pre-order configuration.
   * - ALL_PRODUCTS: Target all catalog products.
   * - SPECIFIC_PRODUCTS: Target only products in selectedProductIds.
   * - COLLECTIONS: Target only products in selectedCollectionIds.
   */
  static isProductTargeted(
    config: any,
    productId: string | null | undefined,
    productCollectionIds: string[] = []
  ): boolean {
    if (!config) return false;
    const mode = config.selectionMode || 'ALL_PRODUCTS';
    if (mode === 'ALL_PRODUCTS') {
      return true;
    }
    if (mode === 'SPECIFIC_PRODUCTS') {
      if (!productId) return false;
      const cleanPid = productId.replace(/^gid:\/\/shopify\/Product\//, '');
      const selected = (config.selectedProductIds || []).map((id: string) =>
        id.replace(/^gid:\/\/shopify\/Product\//, '')
      );
      return selected.includes(cleanPid);
    }
    if (mode === 'COLLECTIONS') {
      if (!productCollectionIds || productCollectionIds.length === 0) return false;
      const selectedColls = (config.selectedCollectionIds || []).map((id: string) =>
        id.replace(/^gid:\/\/shopify\/Collection\//, '').toLowerCase()
      );
      return productCollectionIds.some((cid) => {
        const cleanCid = cid.replace(/^gid:\/\/shopify\/Collection\//, '').toLowerCase();
        return selectedColls.includes(cleanCid);
      });
    }
    return true;
  }

  /**
   * Determine Pre-order eligibility based strictly on inventory & configuration rules:
   * - Must be targeted (by selection mode or explicit override)
   * - Pre-order must be enabled
   * - inventoryQuantity <= inventoryThreshold (e.g. 0 or negative for overselling/backorder)
   * If inventoryQuantity > threshold, item is IN-STOCK, so Pre-order is FALSE.
   */
  static evaluateEligibility(
    inventoryQuantity: number,
    inventoryThreshold: number = 0,
    isTargeted: boolean = true,
    enabled: boolean = true
  ): {
    isEligible: boolean;
    reason: 'IN_STOCK' | 'OUT_OF_STOCK_ELIGIBLE' | 'NOT_TARGETED' | 'DISABLED';
  } {
    if (!enabled) {
      return { isEligible: false, reason: 'DISABLED' };
    }
    if (!isTargeted) {
      return { isEligible: false, reason: 'NOT_TARGETED' };
    }
    if (inventoryQuantity <= inventoryThreshold) {
      return { isEligible: true, reason: 'OUT_OF_STOCK_ELIGIBLE' };
    }
    return { isEligible: false, reason: 'IN_STOCK' };
  }

  /**
   * Get pre-order configuration for a store, with optional product/variant override.
   */
  static async getConfig(storeId: string, shopifyProductId?: string | null, shopifyVariantId?: string | null) {
    if (!storeId) {
      throw new Error('storeId is required to retrieve preorder configuration');
    }

    // 1. Try variant-specific config if variantId is provided
    let config = null;
    if (shopifyVariantId) {
      config = await prisma.preorderConfig.findFirst({
        where: { storeId, shopifyVariantId },
      });
    }

    // 2. Try product-specific config if productId is provided
    if (!config && shopifyProductId) {
      config = await prisma.preorderConfig.findFirst({
        where: { storeId, shopifyProductId, shopifyVariantId: null },
      });
    }

    // 3. Fallback to store-level default config
    if (!config) {
      config = await prisma.preorderConfig.findFirst({
        where: { storeId, shopifyProductId: null, shopifyVariantId: null },
      });
    }

    // If none exists in DB yet, create standard default
    if (!config) {
      try {
        config = await prisma.preorderConfig.create({
          data: {
            storeId,
            shopifyProductId: null,
            shopifyVariantId: null,
            ...DEFAULT_PREORDER_CONFIG,
          },
        });
      } catch (createErr: any) {
        // Fallback create if client fields lag
        const id = crypto.randomUUID();
        await prisma.$executeRawUnsafe(
          `INSERT INTO "preorder_configs" ("id", "storeId", "shopifyProductId", "shopifyVariantId", "enabled", "inventoryThreshold", "customerMessage", "shippingMessage", "fulfillmentMessage", "maxQuantity", "discountType", "discountValue", "selectionMode", "selectedProductIds", "selectedCollectionIds", "createdAt", "updatedAt") VALUES ($1, $2, NULL, NULL, true, 0, $3, $4, $5, NULL, 'none', 0, 'ALL_PRODUCTS', '{}', '{}', NOW(), NOW())`,
          id, storeId, DEFAULT_PREORDER_CONFIG.customerMessage, DEFAULT_PREORDER_CONFIG.shippingMessage, DEFAULT_PREORDER_CONFIG.fulfillmentMessage
        );
        config = {
          id,
          storeId,
          shopifyProductId: null,
          shopifyVariantId: null,
          ...DEFAULT_PREORDER_CONFIG,
        } as any;
      }
    }

    if (config) {
      // Ensure fields are populated from raw query if needed
      try {
        const rows: any[] = await prisma.$queryRawUnsafe(
          'SELECT "discountType", "discountValue", "selectionMode", "selectedProductIds", "selectedCollectionIds" FROM "preorder_configs" WHERE "id" = $1 LIMIT 1',
          config.id
        );
        if (rows && rows[0]) {
          (config as any).discountType = rows[0].discountType || 'none';
          (config as any).discountValue = Number(rows[0].discountValue) || 0;
          (config as any).selectionMode = rows[0].selectionMode || 'ALL_PRODUCTS';
          (config as any).selectedProductIds = rows[0].selectedProductIds || [];
          (config as any).selectedCollectionIds = rows[0].selectedCollectionIds || [];
        }
      } catch (e) {
        console.warn('[PreorderService] Fallback raw query error:', e);
      }
    }

    return config;
  }

  /**
   * Upsert pre-order configuration for store or specific product/variant.
   */
  static async upsertConfig(storeId: string, data: PreorderConfigInput) {
    if (!storeId) {
      throw new Error('storeId is required to update preorder configuration');
    }

    const productId = data.shopifyProductId ?? null;
    const variantId = data.shopifyVariantId ?? null;

    const existing = await prisma.preorderConfig.findFirst({
      where: {
        storeId,
        shopifyProductId: productId,
        shopifyVariantId: variantId,
      },
    });

    const selMode = data.selectionMode || (existing as any)?.selectionMode || DEFAULT_PREORDER_CONFIG.selectionMode;
    const selProdIds = data.selectedProductIds !== undefined ? data.selectedProductIds : ((existing as any)?.selectedProductIds || []);
    const selCollIds = data.selectedCollectionIds !== undefined ? data.selectedCollectionIds : ((existing as any)?.selectedCollectionIds || []);
    const dType = data.discountType !== undefined ? data.discountType : (existing as any)?.discountType ?? 'none';
    const dVal = data.discountValue !== undefined ? Number(data.discountValue) : (existing as any)?.discountValue ?? 0;
    const en = data.enabled !== undefined ? data.enabled : (existing?.enabled ?? DEFAULT_PREORDER_CONFIG.enabled);
    const th = data.inventoryThreshold !== undefined ? data.inventoryThreshold : (existing?.inventoryThreshold ?? DEFAULT_PREORDER_CONFIG.inventoryThreshold);
    const cm = data.customerMessage !== undefined ? data.customerMessage.trim() : (existing?.customerMessage ?? DEFAULT_PREORDER_CONFIG.customerMessage);
    const sm = data.shippingMessage !== undefined ? data.shippingMessage.trim() : (existing?.shippingMessage ?? DEFAULT_PREORDER_CONFIG.shippingMessage);
    const fm = data.fulfillmentMessage !== undefined ? data.fulfillmentMessage.trim() : (existing?.fulfillmentMessage ?? DEFAULT_PREORDER_CONFIG.fulfillmentMessage);
    const mq = data.maxQuantity !== undefined ? data.maxQuantity : (existing?.maxQuantity ?? DEFAULT_PREORDER_CONFIG.maxQuantity);

    if (existing) {
      try {
        return await prisma.preorderConfig.update({
          where: { id: existing.id },
          data: {
            enabled: en,
            inventoryThreshold: th,
            customerMessage: cm,
            shippingMessage: sm,
            fulfillmentMessage: fm,
            maxQuantity: mq,
            discountType: dType,
            discountValue: dVal,
            selectionMode: selMode,
            selectedProductIds: selProdIds,
            selectedCollectionIds: selCollIds,
          } as any,
        });
      } catch (err: any) {
        await prisma.$executeRawUnsafe(
          `UPDATE "preorder_configs" SET "enabled" = $1, "inventoryThreshold" = $2, "customerMessage" = $3, "shippingMessage" = $4, "fulfillmentMessage" = $5, "maxQuantity" = $6, "discountType" = $7, "discountValue" = $8, "selectionMode" = $9, "selectedProductIds" = $10, "selectedCollectionIds" = $11, "updatedAt" = NOW() WHERE "id" = $12`,
          en, th, cm, sm, fm, mq, dType, dVal, selMode, selProdIds, selCollIds, existing.id
        );

        return {
          ...existing,
          enabled: en,
          inventoryThreshold: th,
          customerMessage: cm,
          shippingMessage: sm,
          fulfillmentMessage: fm,
          maxQuantity: mq,
          discountType: dType,
          discountValue: dVal,
          selectionMode: selMode,
          selectedProductIds: selProdIds,
          selectedCollectionIds: selCollIds,
        };
      }
    }

    try {
      return await prisma.preorderConfig.create({
        data: {
          storeId,
          shopifyProductId: productId,
          shopifyVariantId: variantId,
          enabled: en,
          inventoryThreshold: th,
          customerMessage: cm,
          shippingMessage: sm,
          fulfillmentMessage: fm,
          maxQuantity: mq,
          discountType: dType,
          discountValue: dVal,
          selectionMode: selMode,
          selectedProductIds: selProdIds,
          selectedCollectionIds: selCollIds,
        } as any,
      });
    } catch (err: any) {
      const id = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "preorder_configs" ("id", "storeId", "shopifyProductId", "shopifyVariantId", "enabled", "inventoryThreshold", "customerMessage", "shippingMessage", "fulfillmentMessage", "maxQuantity", "discountType", "discountValue", "selectionMode", "selectedProductIds", "selectedCollectionIds", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())`,
        id, storeId, productId, variantId, en, th, cm, sm, fm, mq, dType, dVal, selMode, selProdIds, selCollIds
      );

      return {
        id,
        storeId,
        shopifyProductId: productId,
        shopifyVariantId: variantId,
        enabled: en,
        inventoryThreshold: th,
        customerMessage: cm,
        shippingMessage: sm,
        fulfillmentMessage: fm,
        maxQuantity: mq,
        discountType: dType,
        discountValue: dVal,
        selectionMode: selMode,
        selectedProductIds: selProdIds,
        selectedCollectionIds: selCollIds,
      };
    }
  }

  /**
   * Pure backend calculation engine for Pre-order offers.
   * Handles:
   * - 'none': No discount (final price = base price)
   * - 'percentage': (basePrice * discountValue) / 100 (e.g., 100 with 10% => -10 = 90)
   * - 'fixed': basePrice - discountValue (e.g., 100 with 10 => -10 = 90)
   * Dynamically applies to any product price.
   */
  static calculatePrice(
    basePrice: number,
    discountType: 'none' | 'percentage' | 'fixed' = 'none',
    discountValue: number = 0,
    currencySymbol: string = 'Rs.'
  ): PreorderPriceCalculation {
    const originalPrice = Math.max(0, Number(basePrice) || 0);
    const value = Math.max(0, Number(discountValue) || 0);
    let discountAmount = 0;

    if (discountType === 'percentage') {
      discountAmount = (originalPrice * value) / 100;
    } else if (discountType === 'fixed') {
      discountAmount = Math.min(originalPrice, value);
    } else {
      discountAmount = 0;
    }

    discountAmount = Math.round(discountAmount * 100) / 100;
    const finalPrice = Math.max(0, Math.round((originalPrice - discountAmount) * 100) / 100);

    let savingsText = '';
    let offerBadge = '';

    if (discountType === 'percentage' && value > 0) {
      savingsText = `Save ${value}% (-${currencySymbol} ${discountAmount.toFixed(2)})`;
      offerBadge = `${value}% OFF`;
    } else if (discountType === 'fixed' && value > 0) {
      savingsText = `Save ${currencySymbol} ${discountAmount.toFixed(2)}`;
      offerBadge = `${currencySymbol} ${value.toFixed(0)} OFF`;
    }

    return {
      originalPrice,
      discountType,
      discountValue: value,
      discountAmount,
      finalPrice,
      formattedOriginalPrice: `${currencySymbol} ${originalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      formattedDiscountAmount: `${currencySymbol} ${discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      formattedFinalPrice: `${currencySymbol} ${finalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      savingsText,
      offerBadge,
    };
  }

  /**
   * List all custom product/variant pre-order overrides for a store.
   */
  static async listOverrides(storeId: string) {
    return prisma.preorderConfig.findMany({
      where: {
        storeId,
        OR: [
          { shopifyProductId: { not: null } },
          { shopifyVariantId: { not: null } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Get paginated pre-order customer orders with safe decryption of sensitive consumer data.
   */
  static async getPreorderRecords(storeId: string, page = 1, pageSize = 10) {
    const { safeDecrypt } = require('@/lib/utils/encryption');
    const skip = (Math.max(1, page) - 1) * pageSize;

    const [total, records] = await Promise.all([
      prisma.preorderRecord.count({ where: { storeId } }),
      prisma.preorderRecord.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    const decryptedRecords = records.map((r) => ({
      ...r,
      customerName: safeDecrypt(r.customerName),
      customerEmail: safeDecrypt(r.customerEmail),
      customerPhone: safeDecrypt(r.customerPhone),
    }));

    return {
      data: decryptedRecords,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
        hasNext: page < Math.ceil(total / pageSize),
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Helper to derive deterministic discount code name from offer settings.
   */
  static getDiscountCode(
    discountType: 'none' | 'percentage' | 'fixed' | string,
    discountValue: number
  ): string | null {
    if (discountType === 'none' || !discountValue || discountValue <= 0) {
      return null;
    }
    const cleanVal = Math.round(Number(discountValue) * 100) / 100;
    return discountType === 'percentage'
      ? `PREORDER-${Math.round(cleanVal)}PCT`
      : `PREORDER-${Math.round(cleanVal)}OFF`;
  }

  /**
   * Synchronize Shopify Discount Code corresponding to pre-order offer settings.
   * Auto-creates matching discount code in Shopify Admin so checkout charges discounted price.
   */
  static async syncShopifyDiscount(
    storeId: string,
    discountType: 'none' | 'percentage' | 'fixed' | string,
    discountValue: number
  ): Promise<string | null> {
    const discountCode = PreorderService.getDiscountCode(discountType, discountValue);
    if (!discountCode) {
      return null;
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { shopDomain: true, accessToken: true },
    });

    if (!store || !store.shopDomain) {
      console.warn('[PreorderService:syncShopifyDiscount] Store not found:', storeId);
      return discountCode;
    }

    try {
      const { getAdminClient } = require('@/lib/shopify/admin');
      const client = await getAdminClient(store.shopDomain);

      const cleanVal = Math.round(Number(discountValue) * 100) / 100;
      const customerGetsValue =
        discountType === 'percentage'
          ? { percentage: cleanVal / 100 }
          : { discountAmount: { amount: cleanVal.toFixed(2), appliesOnEachItem: false } };

      const mutation = `
        mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
          discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
            codeDiscountNode {
              id
              codeDiscount {
                ... on DiscountCodeBasic {
                  title
                  codes(first: 1) {
                    nodes {
                      code
                    }
                  }
                }
              }
            }
            userErrors {
              field
              code
              message
            }
          }
        }
      `;

      const title =
        discountType === 'percentage'
          ? `StoreBridge Pre-order ${cleanVal}% Discount`
          : `StoreBridge Pre-order Rs. ${cleanVal} Discount`;

      const variables = {
        basicCodeDiscount: {
          title,
          code: discountCode,
          startsAt: new Date(Date.now() - 60000).toISOString(),
          customerSelection: { all: true },
          customerGets: {
            value: customerGetsValue,
            items: { all: true },
          },
          appliesOncePerCustomer: false,
        },
      };

      const response: any = await client.request(mutation, { variables });
      const userErrors = response.data?.discountCodeBasicCreate?.userErrors || [];

      if (userErrors.length > 0) {
        const isTaken = userErrors.some(
          (e: any) =>
            e.code === 'TAKEN' ||
            e.message?.toLowerCase().includes('taken') ||
            e.message?.toLowerCase().includes('already exists')
        );
        if (isTaken) {
          console.log(`[PreorderService:syncShopifyDiscount] Discount ${discountCode} already exists in Shopify. Active.`);
        } else {
          console.warn('[PreorderService:syncShopifyDiscount] Shopify returned userErrors:', userErrors);
        }
      } else {
        console.log(`[PreorderService:syncShopifyDiscount] Successfully synchronized Shopify discount code: ${discountCode}`);
      }
    } catch (err: any) {
      console.warn('[PreorderService:syncShopifyDiscount] Note while creating Shopify discount (check scopes):', err.message || err);
    }

    return discountCode;
  }
}

