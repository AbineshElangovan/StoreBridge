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
  allowHalfPayment?: boolean;
  allowFullPayment?: boolean;
  defaultPaymentOption?: 'HALF' | 'FULL';
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
  allowHalfPayment: true,
  allowFullPayment: true,
  defaultPaymentOption: 'HALF' as 'HALF' | 'FULL',
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
          'SELECT "discountType", "discountValue", "selectionMode", "selectedProductIds", "selectedCollectionIds", "allowHalfPayment", "allowFullPayment", "defaultPaymentOption" FROM "preorder_configs" WHERE "id" = $1 LIMIT 1',
          config.id
        );
        if (rows && rows[0]) {
          (config as any).discountType = rows[0].discountType || 'none';
          (config as any).discountValue = Number(rows[0].discountValue) || 0;
          (config as any).selectionMode = rows[0].selectionMode || 'ALL_PRODUCTS';
          (config as any).selectedProductIds = rows[0].selectedProductIds || [];
          (config as any).selectedCollectionIds = rows[0].selectedCollectionIds || [];
          (config as any).allowHalfPayment = rows[0].allowHalfPayment !== undefined && rows[0].allowHalfPayment !== null ? rows[0].allowHalfPayment : DEFAULT_PREORDER_CONFIG.allowHalfPayment;
          (config as any).allowFullPayment = rows[0].allowFullPayment !== undefined && rows[0].allowFullPayment !== null ? rows[0].allowFullPayment : DEFAULT_PREORDER_CONFIG.allowFullPayment;
          (config as any).defaultPaymentOption = rows[0].defaultPaymentOption || DEFAULT_PREORDER_CONFIG.defaultPaymentOption;
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
    const allowHalf = data.allowHalfPayment !== undefined ? data.allowHalfPayment : ((existing as any)?.allowHalfPayment ?? DEFAULT_PREORDER_CONFIG.allowHalfPayment);
    const allowFull = data.allowFullPayment !== undefined ? data.allowFullPayment : ((existing as any)?.allowFullPayment ?? DEFAULT_PREORDER_CONFIG.allowFullPayment);
    const defaultOption = data.defaultPaymentOption || (existing as any)?.defaultPaymentOption || DEFAULT_PREORDER_CONFIG.defaultPaymentOption;

    if (existing) {
      try {
        return await (prisma as any).preorderConfig.update({
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
            allowHalfPayment: allowHalf,
            allowFullPayment: allowFull,
            defaultPaymentOption: defaultOption,
          },
        });
      } catch (err: any) {
        await prisma.$executeRawUnsafe(
          `UPDATE "preorder_configs" SET "enabled" = $1, "inventoryThreshold" = $2, "customerMessage" = $3, "shippingMessage" = $4, "fulfillmentMessage" = $5, "maxQuantity" = $6, "discountType" = $7, "discountValue" = $8, "selectionMode" = $9, "selectedProductIds" = $10, "selectedCollectionIds" = $11, "allowHalfPayment" = $12, "allowFullPayment" = $13, "defaultPaymentOption" = $14, "updatedAt" = NOW() WHERE "id" = $15`,
          en, th, cm, sm, fm, mq, dType, dVal, selMode, selProdIds, selCollIds, allowHalf, allowFull, defaultOption, existing.id
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
          allowHalfPayment: allowHalf,
          allowFullPayment: allowFull,
          defaultPaymentOption: defaultOption,
        };
      }
    }

    try {
      return await (prisma as any).preorderConfig.create({
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
          allowHalfPayment: allowHalf,
          allowFullPayment: allowFull,
          defaultPaymentOption: defaultOption,
        },
      });
    } catch (err: any) {
      const id = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "preorder_configs" ("id", "storeId", "shopifyProductId", "shopifyVariantId", "enabled", "inventoryThreshold", "customerMessage", "shippingMessage", "fulfillmentMessage", "maxQuantity", "discountType", "discountValue", "selectionMode", "selectedProductIds", "selectedCollectionIds", "allowHalfPayment", "allowFullPayment", "defaultPaymentOption", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())`,
        id, storeId, productId, variantId, en, th, cm, sm, fm, mq, dType, dVal, selMode, selProdIds, selCollIds, allowHalf, allowFull, defaultOption
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
        allowHalfPayment: allowHalf,
        allowFullPayment: allowFull,
        defaultPaymentOption: defaultOption,
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
   * Currency-safe calculation of payment breakdown for Full vs Half Payment.
   * Handles rounding accurately: initialPayment + remainingBalance === totalAmount.
   */
  static calculatePaymentBreakdown(
    productPrice: number,
    paymentOption: 'HALF' | 'FULL' = 'HALF',
    currencySymbol: string = '₹'
  ) {
    const totalAmount = Math.max(0, Math.round(Number(productPrice) * 100) / 100);
    let initialPayment = totalAmount;
    let remainingBalance = 0;

    if (paymentOption === 'HALF') {
      // 50% calculation: round initial payment to 2 decimal places
      initialPayment = Math.round((totalAmount / 2) * 100) / 100;
      // Remaining is strictly totalAmount - initialPayment to prevent rounding discrepancies
      remainingBalance = Math.round((totalAmount - initialPayment) * 100) / 100;
    }

    const formatCurrency = (val: number) =>
      `${currencySymbol}${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return {
      totalAmount,
      initialPayment,
      remainingBalance,
      paymentOption,
      formattedTotal: formatCurrency(totalAmount),
      formattedInitial: formatCurrency(initialPayment),
      formattedRemaining: formatCurrency(remainingBalance),
    };
  }

  /**
   * Get paginated pre-order customer orders with safe decryption of sensitive consumer data.
   * Supports filtering by search (order number, product title, email) and payment status.
   */
  static async getPreorderRecords(
    storeId: string,
    page = 1,
    pageSize = 10,
    search = '',
    paymentStatus = 'ALL'
  ) {
    const { safeDecrypt } = require('@/lib/utils/encryption');
    const skip = (Math.max(1, page) - 1) * pageSize;

    const where: any = { storeId };
    if (paymentStatus && paymentStatus !== 'ALL') {
      where.paymentStatus = paymentStatus;
    }
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { productTitle: { contains: q, mode: 'insensitive' } },
        { variantTitle: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      (prisma as any).preorderRecord.count({ where }),
      (prisma as any).preorderRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    const decryptedRecords = records.map((r: any) => ({
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
   * Mark remaining balance as paid for a Pre-order record.
   * Updates balance to 0 and marks paymentStatus to PAID.
   */
  static async confirmRemainingPayment(recordId: string, storeId: string) {
    const record = await (prisma as any).preorderRecord.findFirst({
      where: { id: recordId, storeId },
    });
    if (!record) {
      throw new Error('Pre-order record not found');
    }

    const updated = await (prisma as any).preorderRecord.update({
      where: { id: recordId },
      data: {
        depositAmount: record.totalAmount || record.depositAmount,
        remainingBalance: 0,
        paymentStatus: 'PAID',
        finalPaymentDate: new Date(),
      },
    });

    // Create in-app merchant notification
    try {
      await prisma.notification.create({
        data: {
          recipientStoreId: storeId,
          type: 'INVENTORY_UPDATE',
          title: 'Pre-order Fully Paid',
          message: `Remaining balance for Order ${record.orderNumber} was confirmed. Status updated to Fully Paid.`,
          productId: record.shopifyVariantId,
          productTitle: record.productTitle || 'Pre-order Item',
          sourceStoreId: storeId,
          isRead: false,
        },
      });
    } catch {}

    return updated;
  }

  /**
   * Generate or retrieve a supported Shopify Draft Order invoice payment link
   * for the customer to pay their remaining balance.
   */
  static async generateRemainingPaymentLink(recordId: string, storeId: string) {
    const record = await (prisma as any).preorderRecord.findFirst({
      where: { id: recordId, storeId },
    });
    if (!record) {
      throw new Error('Pre-order record not found');
    }

    if (record.paymentStatus === 'PAID' || record.remainingBalance <= 0) {
      return {
        success: true,
        paymentLink: null,
        message: 'Order is already fully paid.',
      };
    }

    if (record.paymentLink) {
      return {
        success: true,
        paymentLink: record.paymentLink,
        message: 'Payment link retrieved.',
      };
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { shopDomain: true },
    });

    if (!store?.shopDomain) {
      throw new Error('Store not found');
    }

    let invoiceUrl = `https://${store.shopDomain}/account/orders`;

    try {
      const { getAdminClient } = require('@/lib/shopify/admin');
      const client = await getAdminClient(store.shopDomain);

      const mutation = `
        mutation draftOrderCreate($input: DraftOrderInput!) {
          draftOrderCreate(input: $input) {
            draftOrder {
              id
              invoiceUrl
              status
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variables = {
        input: {
          note: `Pre-order Remaining Balance for Order ${record.orderNumber}`,
          lineItems: [
            {
              title: `Remaining Balance: ${record.productTitle || 'Pre-order Product'} (${record.orderNumber})`,
              originalUnitPrice: record.remainingBalance.toFixed(2),
              quantity: 1,
            },
          ],
          tags: ['preorder-balance', `order-${record.orderNumber}`],
        },
      };

      const response: any = await client.request(mutation, { variables });
      const draft = response.data?.draftOrderCreate?.draftOrder;
      if (draft?.invoiceUrl) {
        invoiceUrl = draft.invoiceUrl;
      }
    } catch (err: any) {
      console.warn('[PreorderService:generatePaymentLink] Draft order creation fallback:', err.message);
    }

    await (prisma as any).preorderRecord.update({
      where: { id: recordId },
      data: { paymentLink: invoiceUrl },
    });

    return {
      success: true,
      paymentLink: invoiceUrl,
      message: 'Payment link generated successfully.',
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

  /**
   * Synchronize deposit discount code in Shopify Admin for Half Payment orders.
   * If a pre-order offer is active (e.g. 10% OFF), combines the offer with the 50% deposit
   * so the customer sees both the offer and deposit clearly at checkout, paying the exact deposit.
   */
  static async syncShopifyDepositDiscount(
    storeId: string,
    discountType: string = 'none',
    discountValue: number = 0
  ): Promise<string> {
    const isOfferActive = discountType === 'percentage' && Number(discountValue) > 0;
    const cleanPct = isOfferActive ? Math.round(Number(discountValue)) : 0;

    // Combined discount calculation:
    // e.g. 10% offer on Rs. 1,240 = Rs. 1,116.
    // 50% deposit of Rs. 1,116 = Rs. 558 due today.
    // Total discount from original: (1,240 - 558) / 1,240 = 55% OFF.
    // Formula: 1 - (1 - discount% / 100) * 0.5
    const effectivePct = isOfferActive
      ? Math.round((1 - (1 - cleanPct / 100) * 0.5) * 1000) / 1000
      : 0.5;

    const depositCode = isOfferActive
      ? `PREORDER-HALF-${cleanPct}PCT`
      : 'PREORDER-HALF-DEPOSIT';

    const title = isOfferActive
      ? `StoreBridge Pre-order (${cleanPct}% Offer + 50% Deposit)`
      : 'StoreBridge Pre-order (50% Initial Deposit)';

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { shopDomain: true },
    });

    if (!store?.shopDomain) return depositCode;

    try {
      const { getAdminClient } = require('@/lib/shopify/admin');
      const client = await getAdminClient(store.shopDomain);

      const mutation = `
        mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
          discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
            codeDiscountNode { id }
            userErrors { field code message }
          }
        }
      `;

      // 1. Create/Sync primary deposit discount (with offer if active)
      const variables = {
        basicCodeDiscount: {
          title,
          code: depositCode,
          startsAt: new Date(Date.now() - 60000).toISOString(),
          customerSelection: { all: true },
          customerGets: {
            value: { percentage: effectivePct },
            items: { all: true },
          },
          appliesOncePerCustomer: false,
        },
      };

      const response: any = await client.request(mutation, { variables });
      const userErrors = response.data?.discountCodeBasicCreate?.userErrors || [];
      if (userErrors.length === 0) {
        console.log(`[PreorderService:syncDepositDiscount] Active code: ${depositCode} (${Math.round(effectivePct * 100)}%)`);
      } else {
        const isTaken = userErrors.some(
          (e: any) =>
            e.code === 'TAKEN' ||
            e.message?.toLowerCase().includes('taken') ||
            e.message?.toLowerCase().includes('already exists')
        );
        if (isTaken) {
          console.log(`[PreorderService:syncDepositDiscount] Discount ${depositCode} already exists in Shopify. Active.`);
        } else {
          console.warn('[PreorderService:syncDepositDiscount] Shopify returned userErrors:', userErrors);
        }
      }

      // 2. Also ensure standard fallback code PREORDER-HALF-DEPOSIT exists
      if (depositCode !== 'PREORDER-HALF-DEPOSIT') {
        try {
          const fallbackVariables = {
            basicCodeDiscount: {
              title: 'StoreBridge Pre-order (50% Initial Deposit)',
              code: 'PREORDER-HALF-DEPOSIT',
              startsAt: new Date(Date.now() - 60000).toISOString(),
              customerSelection: { all: true },
              customerGets: {
                value: { percentage: 0.5 },
                items: { all: true },
              },
              appliesOncePerCustomer: false,
            },
          };
          await client.request(mutation, { variables: fallbackVariables });
        } catch (_) {}
      }
    } catch (err: any) {
      console.warn('[PreorderService:syncDepositDiscount] Note creating deposit code:', err.message);
    }

    return depositCode;
  }
}

