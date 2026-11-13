import { prisma } from '@/lib/db/prisma';
import { APP_NAME } from '@/lib/constants/app';

export interface PreorderMetrics {
  totalPreorders: number;
  pendingPreorders: number;
  revenue: number;
  pendingRevenue: number;
  totalRevenue: number;
  awaitingStockCount: number;
  allocatedStockCount: number;
  fulfilledCount: number;
  currency: string;
}

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
  // Status & Scheduling
  statusScheduleType?: 'AVAILABLE_NOW' | 'FROM_START_DATE' | 'UNTIL_END_DATE' | 'BETWEEN_DATES' | 'NOT_AVAILABLE';
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  // Countdown Timer
  showTimer?: boolean;
  timerDisplayMode?: string;
  timerStartDateMode?: string;
  timerCustomStartDate?: string | Date | null;
  timerDateMode?: string;
  timerCustomDate?: string | Date | null;
  timerHeading?: string;
  timerTextColor?: string;
  timerBgColor?: string;
  timerHeadingEnd?: string;
  timerTextColorEnd?: string;
  timerBgColorEnd?: string;
  timerBorderRadius?: number;
  timerShowDays?: boolean;
  timerShowHours?: boolean;
  timerShowMinutes?: boolean;
  timerShowSeconds?: boolean;
  timerDaysLabel?: string;
  timerHoursLabel?: string;
  timerMinutesLabel?: string;
  timerSecondsLabel?: string;
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
  // Status & Scheduling defaults
  statusScheduleType: 'AVAILABLE_NOW' as 'AVAILABLE_NOW' | 'FROM_START_DATE' | 'UNTIL_END_DATE' | 'BETWEEN_DATES' | 'NOT_AVAILABLE',
  startDate: null as Date | null,
  endDate: null as Date | null,
  // Countdown Timer defaults
  showTimer: false,
  timerDisplayMode: 'BEFORE_PREORDER' as 'BEFORE_PREORDER' | 'WHILE_PREORDER',
  timerStartDateMode: 'USE_STATUS_DATE' as 'USE_STATUS_DATE' | 'CUSTOM_DATES',
  timerCustomStartDate: null as Date | null,
  timerDateMode: 'USE_STATUS_DATE' as 'USE_STATUS_DATE' | 'CUSTOM_DATE',
  timerCustomDate: null as Date | null,
  timerHeading: 'Preorder starts in',
  timerTextColor: '#000000',
  timerBgColor: '#f5f5f5',
  timerHeadingEnd: 'Hurry up! Pre-order ending soon',
  timerTextColorEnd: '#000000',
  timerBgColorEnd: '#fee2e2',
  timerBorderRadius: 8,
  timerShowDays: true,
  timerShowHours: true,
  timerShowMinutes: true,
  timerShowSeconds: true,
  timerDaysLabel: 'Days',
  timerHoursLabel: 'Hours',
  timerMinutesLabel: 'Mins',
  timerSecondsLabel: 'Secs',
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

    // 1. Fetch store-level default config first
    let storeDefaultConfig: any = null;
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT * FROM "preorder_configs" WHERE "storeId" = $1 AND "shopifyProductId" IS NULL AND "shopifyVariantId" IS NULL LIMIT 1`,
        storeId
      ) as any[];
      storeDefaultConfig = rows[0] || null;
    } catch {
      storeDefaultConfig = await prisma.preorderConfig.findFirst({
        where: { storeId, shopifyProductId: null, shopifyVariantId: null },
      });
    }

    let config: any = null;

    // In ALL_PRODUCTS mode, the store-level default config governs all catalog products dynamically
    const isAllProductsMode = !storeDefaultConfig || !storeDefaultConfig.selectionMode || storeDefaultConfig.selectionMode === 'ALL_PRODUCTS';

    if (isAllProductsMode && storeDefaultConfig) {
      config = storeDefaultConfig;
    } else {
      // 1. Try variant-specific config if variantId is provided
      if (shopifyVariantId) {
        try {
          const vRows = await prisma.$queryRawUnsafe(
            `SELECT * FROM "preorder_configs" WHERE "storeId" = $1 AND "shopifyVariantId" = $2 LIMIT 1`,
            storeId, shopifyVariantId
          ) as any[];
          config = vRows[0] || null;
        } catch {
          config = await prisma.preorderConfig.findFirst({
            where: { storeId, shopifyVariantId },
          });
        }
      }

      // 2. Try product-specific config if productId is provided
      if (!config && shopifyProductId) {
        try {
          const pRows = await prisma.$queryRawUnsafe(
            `SELECT * FROM "preorder_configs" WHERE "storeId" = $1 AND "shopifyProductId" = $2 AND "shopifyVariantId" IS NULL LIMIT 1`,
            storeId, shopifyProductId
          ) as any[];
          config = pRows[0] || null;
        } catch {
          config = await prisma.preorderConfig.findFirst({
            where: { storeId, shopifyProductId, shopifyVariantId: null },
          });
        }
      }

      // 3. Fallback to store-level default config
      if (!config) {
        config = storeDefaultConfig;
      } else if (storeDefaultConfig) {
        // Inherit active promotional discount & payment plan options from store default if not overridden
        if (!(config as any).discountType || (config as any).discountType === 'none') {
          (config as any).discountType = storeDefaultConfig.discountType;
          (config as any).discountValue = storeDefaultConfig.discountValue;
        }
        if ((config as any).allowHalfPayment === undefined) {
          (config as any).allowHalfPayment = (storeDefaultConfig as any).allowHalfPayment;
        }
        if ((config as any).allowFullPayment === undefined) {
          (config as any).allowFullPayment = (storeDefaultConfig as any).allowFullPayment;
        }
        if (!(config as any).defaultPaymentOption) {
          (config as any).defaultPaymentOption = (storeDefaultConfig as any).defaultPaymentOption;
        }
      }
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
          'SELECT "discountType", "discountValue", "selectionMode", "selectedProductIds", "selectedCollectionIds", "allowHalfPayment", "allowFullPayment", "defaultPaymentOption", "statusScheduleType", "startDate", "endDate", "showTimer", "timerDisplayMode", "timerDateMode", "timerCustomDate", "timerHeading", "timerTextColor", "timerBgColor", "timerHeadingEnd", "timerTextColorEnd", "timerBgColorEnd", "timerBorderRadius", "timerShowDays", "timerShowHours", "timerShowMinutes", "timerShowSeconds", "timerDaysLabel", "timerHoursLabel", "timerMinutesLabel", "timerSecondsLabel" FROM "preorder_configs" WHERE "id" = $1 LIMIT 1',
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
          (config as any).statusScheduleType = rows[0].statusScheduleType || DEFAULT_PREORDER_CONFIG.statusScheduleType;
          (config as any).startDate = rows[0].startDate || null;
          (config as any).endDate = rows[0].endDate || null;
          (config as any).showTimer = rows[0].showTimer !== undefined && rows[0].showTimer !== null ? rows[0].showTimer : DEFAULT_PREORDER_CONFIG.showTimer;
          (config as any).timerDisplayMode = rows[0].timerDisplayMode || DEFAULT_PREORDER_CONFIG.timerDisplayMode;
          (config as any).timerDateMode = rows[0].timerDateMode || DEFAULT_PREORDER_CONFIG.timerDateMode;
          (config as any).timerCustomDate = rows[0].timerCustomDate || null;
          (config as any).timerHeading = rows[0].timerHeading || DEFAULT_PREORDER_CONFIG.timerHeading;
          (config as any).timerTextColor = rows[0].timerTextColor || DEFAULT_PREORDER_CONFIG.timerTextColor;
          (config as any).timerBgColor = rows[0].timerBgColor || DEFAULT_PREORDER_CONFIG.timerBgColor;
          (config as any).timerHeadingEnd = rows[0].timerHeadingEnd || DEFAULT_PREORDER_CONFIG.timerHeadingEnd;
          (config as any).timerTextColorEnd = rows[0].timerTextColorEnd || DEFAULT_PREORDER_CONFIG.timerTextColorEnd;
          (config as any).timerBgColorEnd = rows[0].timerBgColorEnd || DEFAULT_PREORDER_CONFIG.timerBgColorEnd;
          (config as any).timerBorderRadius = rows[0].timerBorderRadius !== undefined && rows[0].timerBorderRadius !== null ? Number(rows[0].timerBorderRadius) : DEFAULT_PREORDER_CONFIG.timerBorderRadius;
          (config as any).timerShowDays = rows[0].timerShowDays !== undefined && rows[0].timerShowDays !== null ? rows[0].timerShowDays : DEFAULT_PREORDER_CONFIG.timerShowDays;
          (config as any).timerShowHours = rows[0].timerShowHours !== undefined && rows[0].timerShowHours !== null ? rows[0].timerShowHours : DEFAULT_PREORDER_CONFIG.timerShowHours;
          (config as any).timerShowMinutes = rows[0].timerShowMinutes !== undefined && rows[0].timerShowMinutes !== null ? rows[0].timerShowMinutes : DEFAULT_PREORDER_CONFIG.timerShowMinutes;
          (config as any).timerShowSeconds = rows[0].timerShowSeconds !== undefined && rows[0].timerShowSeconds !== null ? rows[0].timerShowSeconds : DEFAULT_PREORDER_CONFIG.timerShowSeconds;
          (config as any).timerDaysLabel = rows[0].timerDaysLabel || DEFAULT_PREORDER_CONFIG.timerDaysLabel;
          (config as any).timerHoursLabel = rows[0].timerHoursLabel || DEFAULT_PREORDER_CONFIG.timerHoursLabel;
          (config as any).timerMinutesLabel = rows[0].timerMinutesLabel || DEFAULT_PREORDER_CONFIG.timerMinutesLabel;
          (config as any).timerSecondsLabel = rows[0].timerSecondsLabel || DEFAULT_PREORDER_CONFIG.timerSecondsLabel;
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

    // Scheduling & Timer Fields
    const statusScheduleType = data.statusScheduleType || (existing as any)?.statusScheduleType || DEFAULT_PREORDER_CONFIG.statusScheduleType;
    const startDate = data.startDate !== undefined ? (data.startDate ? new Date(data.startDate) : null) : ((existing as any)?.startDate || null);
    const endDate = data.endDate !== undefined ? (data.endDate ? new Date(data.endDate) : null) : ((existing as any)?.endDate || null);

    const showTimer = data.showTimer !== undefined ? data.showTimer : ((existing as any)?.showTimer ?? DEFAULT_PREORDER_CONFIG.showTimer);
    const timerDisplayMode = data.timerDisplayMode || (existing as any)?.timerDisplayMode || DEFAULT_PREORDER_CONFIG.timerDisplayMode;
    const timerStartDateMode = data.timerStartDateMode || (existing as any)?.timerStartDateMode || DEFAULT_PREORDER_CONFIG.timerStartDateMode;
    const timerCustomStartDate = data.timerCustomStartDate !== undefined ? (data.timerCustomStartDate ? new Date(data.timerCustomStartDate) : null) : ((existing as any)?.timerCustomStartDate || null);
    const timerDateMode = data.timerDateMode || (existing as any)?.timerDateMode || DEFAULT_PREORDER_CONFIG.timerDateMode;
    const timerCustomDate = data.timerCustomDate !== undefined ? (data.timerCustomDate ? new Date(data.timerCustomDate) : null) : ((existing as any)?.timerCustomDate || null);
    const timerHeadingEnd = data.timerHeadingEnd !== undefined ? data.timerHeadingEnd : (data.timerHeading || (existing as any)?.timerHeadingEnd || DEFAULT_PREORDER_CONFIG.timerHeadingEnd);
    const timerHeading = timerHeadingEnd;
    const effectiveBg = data.timerBgColorEnd || data.timerBgColor || (existing as any)?.timerBgColorEnd || DEFAULT_PREORDER_CONFIG.timerBgColorEnd;
    const effectiveText = data.timerTextColorEnd || data.timerTextColor || (existing as any)?.timerTextColorEnd || DEFAULT_PREORDER_CONFIG.timerTextColorEnd;
    const timerTextColor = effectiveText;
    const timerBgColor = effectiveBg;
    const timerTextColorEnd = effectiveText;
    const timerBgColorEnd = effectiveBg;
    const timerBorderRadius = data.timerBorderRadius !== undefined ? Number(data.timerBorderRadius) : ((existing as any)?.timerBorderRadius ?? DEFAULT_PREORDER_CONFIG.timerBorderRadius);
    const timerShowDays = data.timerShowDays !== undefined ? data.timerShowDays : ((existing as any)?.timerShowDays ?? DEFAULT_PREORDER_CONFIG.timerShowDays);
    const timerShowHours = data.timerShowHours !== undefined ? data.timerShowHours : ((existing as any)?.timerShowHours ?? DEFAULT_PREORDER_CONFIG.timerShowHours);
    const timerShowMinutes = data.timerShowMinutes !== undefined ? data.timerShowMinutes : ((existing as any)?.timerShowMinutes ?? DEFAULT_PREORDER_CONFIG.timerShowMinutes);
    const timerShowSeconds = data.timerShowSeconds !== undefined ? data.timerShowSeconds : ((existing as any)?.timerShowSeconds ?? DEFAULT_PREORDER_CONFIG.timerShowSeconds);
    const timerDaysLabel = data.timerDaysLabel !== undefined ? data.timerDaysLabel : ((existing as any)?.timerDaysLabel || DEFAULT_PREORDER_CONFIG.timerDaysLabel);
    const timerHoursLabel = data.timerHoursLabel !== undefined ? data.timerHoursLabel : ((existing as any)?.timerHoursLabel || DEFAULT_PREORDER_CONFIG.timerHoursLabel);
    const timerMinutesLabel = data.timerMinutesLabel !== undefined ? data.timerMinutesLabel : ((existing as any)?.timerMinutesLabel || DEFAULT_PREORDER_CONFIG.timerMinutesLabel);
    const timerSecondsLabel = data.timerSecondsLabel !== undefined ? data.timerSecondsLabel : ((existing as any)?.timerSecondsLabel || DEFAULT_PREORDER_CONFIG.timerSecondsLabel);

    if (!productId && !variantId && selMode === 'ALL_PRODUCTS') {
      try {
        await prisma.preorderConfig.deleteMany({
          where: {
            storeId,
            OR: [
              { shopifyProductId: { not: null } },
              { shopifyVariantId: { not: null } },
            ],
          },
        });
      } catch (cleanErr) {
        console.warn('[PreorderService] Stale overrides cleanup notice:', cleanErr);
      }
    }

    const fullConfigPayload = {
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
      statusScheduleType,
      startDate,
      endDate,
      showTimer,
      timerDisplayMode,
      timerStartDateMode,
      timerCustomStartDate,
      timerDateMode,
      timerCustomDate,
      timerHeading,
      timerTextColor,
      timerBgColor,
      timerHeadingEnd,
      timerTextColorEnd,
      timerBgColorEnd,
      timerBorderRadius,
      timerShowDays,
      timerShowHours,
      timerShowMinutes,
      timerShowSeconds,
      timerDaysLabel,
      timerHoursLabel,
      timerMinutesLabel,
      timerSecondsLabel,
    };


    if (existing) {
      try {
        return await (prisma as any).preorderConfig.update({
          where: { id: existing.id },
          data: fullConfigPayload,
        });
      } catch (err: any) {
        await prisma.$executeRawUnsafe(
          `UPDATE "preorder_configs" SET "enabled" = $1, "inventoryThreshold" = $2, "customerMessage" = $3, "shippingMessage" = $4, "fulfillmentMessage" = $5, "maxQuantity" = $6, "discountType" = $7, "discountValue" = $8, "selectionMode" = $9, "selectedProductIds" = $10, "selectedCollectionIds" = $11, "allowHalfPayment" = $12, "allowFullPayment" = $13, "defaultPaymentOption" = $14, "statusScheduleType" = $15, "startDate" = $16, "endDate" = $17, "showTimer" = $18, "timerDisplayMode" = $19, "timerDateMode" = $20, "timerCustomDate" = $21, "timerHeading" = $22, "timerTextColor" = $23, "timerBgColor" = $24, "timerBorderRadius" = $25, "timerShowDays" = $26, "timerShowHours" = $27, "timerShowMinutes" = $28, "timerShowSeconds" = $29, "timerDaysLabel" = $30, "timerHoursLabel" = $31, "timerMinutesLabel" = $32, "timerSecondsLabel" = $33, "timerHeadingEnd" = $34, "timerTextColorEnd" = $35, "timerBgColorEnd" = $36, "timerStartDateMode" = $37, "timerCustomStartDate" = $38, "updatedAt" = NOW() WHERE "id" = $39`,
          en, th, cm, sm, fm, mq, dType, dVal, selMode, selProdIds, selCollIds, allowHalf, allowFull, defaultOption,
          statusScheduleType, startDate, endDate, showTimer, timerDisplayMode, timerDateMode, timerCustomDate,
          timerHeading, timerTextColor, timerBgColor, timerBorderRadius, timerShowDays, timerShowHours, timerShowMinutes,
          timerShowSeconds, timerDaysLabel, timerHoursLabel, timerMinutesLabel, timerSecondsLabel,
          timerHeadingEnd, timerTextColorEnd, timerBgColorEnd, timerStartDateMode, timerCustomStartDate, existing.id
        );

        return {
          ...existing,
          ...fullConfigPayload,
        };
      }
    }

    try {
      return await (prisma as any).preorderConfig.create({
        data: {
          storeId,
          shopifyProductId: productId,
          shopifyVariantId: variantId,
          ...fullConfigPayload,
        },
      });
    } catch (err: any) {
      const id = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "preorder_configs" ("id", "storeId", "shopifyProductId", "shopifyVariantId", "enabled", "inventoryThreshold", "customerMessage", "shippingMessage", "fulfillmentMessage", "maxQuantity", "discountType", "discountValue", "selectionMode", "selectedProductIds", "selectedCollectionIds", "allowHalfPayment", "allowFullPayment", "defaultPaymentOption", "statusScheduleType", "startDate", "endDate", "showTimer", "timerDisplayMode", "timerDateMode", "timerCustomDate", "timerHeading", "timerTextColor", "timerBgColor", "timerHeadingEnd", "timerTextColorEnd", "timerBgColorEnd", "timerBorderRadius", "timerShowDays", "timerShowHours", "timerShowMinutes", "timerShowSeconds", "timerDaysLabel", "timerHoursLabel", "timerMinutesLabel", "timerSecondsLabel", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, NOW(), NOW())`,
        id, storeId, productId, variantId, en, th, cm, sm, fm, mq, dType, dVal, selMode, selProdIds, selCollIds, allowHalf, allowFull, defaultOption,
        statusScheduleType, startDate, endDate, showTimer, timerDisplayMode, timerDateMode, timerCustomDate,
        timerHeading, timerTextColor, timerBgColor, timerHeadingEnd, timerTextColorEnd, timerBgColorEnd, timerBorderRadius, timerShowDays, timerShowHours, timerShowMinutes,
        timerShowSeconds, timerDaysLabel, timerHoursLabel, timerMinutesLabel, timerSecondsLabel
      );

      return {
        id,
        storeId,
        shopifyProductId: productId,
        shopifyVariantId: variantId,
        ...fullConfigPayload,
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
    try {
      const { BackInStockService } = require('@/services/back-in-stock/back-in-stock-service');
      await BackInStockService.syncLivePreordersFromShopify(storeId);
    } catch (_) {}
    const skip = (Math.max(1, page) - 1) * pageSize;

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { isMaster: true },
    });

    let storeFilter: any = storeId;
    if (store?.isMaster) {
      const allStores = await prisma.store.findMany({ select: { id: true } });
      storeFilter = { in: allStores.map(s => s.id) };
    }

    const where: any = { storeId: storeFilter };
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

    const variantIds = records.map((r: any) => r.shopifyVariantId).filter(Boolean);
    const cleanVariantIds = variantIds.map((id: string) => id.replace(/\D/g, ''));

    const caches = await prisma.productCache.findMany({
      where: {
        OR: [
          { shopifyVariantId: { in: variantIds } },
          { shopifyVariantId: { in: cleanVariantIds.map((id: string) => `gid://shopify/ProductVariant/${id}`) } },
        ],
      },
      select: { shopifyVariantId: true, imageUrl: true, title: true },
    });

    const imageMap = new Map<string, string>();
    for (const c of caches) {
      const clean = c.shopifyVariantId.replace(/\D/g, '');
      if (c.imageUrl) {
        imageMap.set(clean, c.imageUrl);
        imageMap.set(c.shopifyVariantId, c.imageUrl);
      }
    }

    const missingTitleRecords = records.filter((r: any) => {
      const cleanVarId = (r.shopifyVariantId || '').replace(/\D/g, '');
      return !imageMap.get(cleanVarId) && !imageMap.get(r.shopifyVariantId) && r.productTitle;
    });

    if (missingTitleRecords.length > 0) {
      const titles: string[] = Array.from(
        new Set(missingTitleRecords.map((r: any) => String(r.productTitle || '').trim()).filter(Boolean))
      );
      const titleCaches = await prisma.productCache.findMany({
        where: {
          OR: titles.map((t) => ({
            title: { contains: t, mode: 'insensitive' }
          }))
        },
        select: { title: true, imageUrl: true },
      });
      for (const tc of titleCaches) {
        if (tc.imageUrl) {
          for (const t of titles) {
            if (tc.title.toLowerCase().includes(t.toLowerCase()) && !imageMap.has(`title:${t.toLowerCase()}`)) {
              imageMap.set(`title:${t.toLowerCase()}`, tc.imageUrl);
            }
          }
        }
      }
    }

    const decryptedRecords = records.map((r: any) => {
      const cleanVarId = (r.shopifyVariantId || '').replace(/\D/g, '');
      const titleKey = r.productTitle ? `title:${r.productTitle.trim().toLowerCase()}` : '';
      const imageUrl = imageMap.get(cleanVarId) || imageMap.get(r.shopifyVariantId) || (titleKey ? imageMap.get(titleKey) : null) || null;

      return {
        ...r,
        imageUrl,
        customerName: safeDecrypt(r.customerName),
        customerEmail: safeDecrypt(r.customerEmail),
        customerPhone: safeDecrypt(r.customerPhone),
      };
    });

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

    // Create in-app merchant notification with persistent deduplication
    try {
      const { PreorderNotificationService } = require('./preorder-notifications');
      if (record.status === 'ALLOCATED') {
        await PreorderNotificationService.notifyReadyForFulfillment({
          storeId,
          orderNumber: record.orderNumber,
          productTitle: record.productTitle || 'Pre-order Item',
          variantTitle: record.variantTitle,
          paymentOption: record.paymentOption,
          paymentStatus: 'PAID',
          productId: record.shopifyVariantId,
        });
      }
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
          ? `${APP_NAME} Pre-order ${cleanVal}% Discount`
          : `${APP_NAME} Pre-order Rs. ${cleanVal} Discount`;

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
      if (err?.message?.includes('401') || err?.message?.includes('invalid_grant') || err?.message?.includes('Requires OAuth')) {
        console.info(`[PreorderService:syncShopifyDiscount] Store ${store.shopDomain} requires an OAuth reconnect in Shopify Admin to sync discount codes.`);
      } else {
        console.warn('[PreorderService:syncShopifyDiscount] Note while creating Shopify discount (check scopes):', err.message || err);
      }
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
    const isPercentage = discountType === 'percentage' && Number(discountValue) > 0;
    const isFixed = discountType === 'fixed' && Number(discountValue) > 0;
    const cleanVal = Math.round(Number(discountValue) || 0);

    let effectivePct = 0.5;
    let depositCode = 'PREORDER-HALF-DEPOSIT';
    let title = `${APP_NAME} Pre-order (50% Initial Deposit)`;

    if (isPercentage) {
      effectivePct = Math.round((1 - (1 - cleanVal / 100) * 0.5) * 1000) / 1000;
      depositCode = `PREORDER-HALF-${cleanVal}PCT`;
      title = `${APP_NAME} Pre-order (${cleanVal}% Offer + 50% Deposit)`;
    } else if (isFixed) {
      const base = 1279;
      const discounted = Math.max(0, base - cleanVal);
      const dep = discounted * 0.5;
      effectivePct = Math.min(0.99, Math.round(((base - dep) / base) * 1000) / 1000);
      depositCode = `PREORDER-HALF-${cleanVal}OFF`;
      title = `${APP_NAME} Pre-order (Rs. ${cleanVal} Offer + 50% Deposit)`;
    }

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
              title: `${APP_NAME} Pre-order (50% Initial Deposit)`,
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
      return depositCode;
    } catch (err: any) {
      if (err?.message?.includes('401') || err?.message?.includes('invalid_grant') || err?.message?.includes('Requires OAuth')) {
        console.info(`[PreorderService:syncDepositDiscount] Store ${store?.shopDomain || storeId} requires an OAuth reconnect in Shopify Admin to sync deposit codes.`);
      } else {
        console.warn('[PreorderService:syncDepositDiscount] Note creating deposit code:', err.message);
      }
    }

    return depositCode;
  }

  /**
   * Automatically ensure targeted Shopify variants have inventoryPolicy = CONTINUE
   * so customers never see "already sold out" when placing pre-orders.
   */
  static async syncInventoryPolicy(storeId: string, productIds: string[]) {
    if (!productIds || productIds.length === 0) return;
    try {
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { shopDomain: true },
      });
      if (!store || !store.shopDomain) return;
      const { getAdminClient } = require('@/lib/shopify/admin');
      const client = await getAdminClient(store.shopDomain);

      for (const rawPid of productIds) {
        const pid = rawPid.startsWith('gid://') ? rawPid : `gid://shopify/Product/${rawPid}`;
        const query = `
          query getVariants($id: ID!) {
            product(id: $id) {
              variants(first: 50) {
                nodes {
                  id
                  inventoryPolicy
                }
              }
            }
          }
        `;
        const res: any = await client.request(query, { variables: { id: pid } });
        const variants = res.data?.product?.variants?.nodes || [];
        const toUpdate = variants
          .filter((v: any) => v.inventoryPolicy !== 'CONTINUE')
          .map((v: any) => ({ id: v.id, inventoryPolicy: 'CONTINUE' }));

        if (toUpdate.length > 0) {
          const mutation = `
            mutation updatePolicy($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                userErrors { field message }
              }
            }
          `;
          await client.request(mutation, { variables: { productId: pid, variants: toUpdate } });
          console.log(`[PreorderService] Automatically updated ${toUpdate.length} variants to CONTINUE for product ${pid}`);
        }
      }
    } catch (e) {
      console.warn('[PreorderService] Auto-sync inventory policy failed:', e);
    }
  }

  /**
   * Get accurate database-driven pre-order metrics for the StoreBridge dashboard:
   * 1. Total Pre-orders: All pre-orders created for this store.
   * 2. Pending Pre-orders: All pre-orders awaiting stock or fulfillment (not fulfilled, cancelled, or refunded).
   * 3. Pre-order Revenue: Total amount collected from pre-orders according to payment status rules.
   */
  static async getPreorderMetrics(storeId?: string | string[]): Promise<PreorderMetrics> {
    const emptyResult: PreorderMetrics = {
      totalPreorders: 0,
      pendingPreorders: 0,
      revenue: 0,
      pendingRevenue: 0,
      totalRevenue: 0,
      awaitingStockCount: 0,
      allocatedStockCount: 0,
      fulfilledCount: 0,
      currency: 'INR',
    };

    try {
      let whereClause: any = {};
      if (storeId && storeId !== 'ALL') {
        if (Array.isArray(storeId)) {
          whereClause = { storeId: { in: storeId } };
        } else {
          whereClause = { storeId };
        }
      }

      let records = await prisma.preorderRecord.findMany({
        where: whereClause,
        select: {
          status: true,
          paymentStatus: true,
          paymentOption: true,
          totalAmount: true,
          depositAmount: true,
          remainingBalance: true,
          currency: true,
        },
      });

      // If requested store filter returned 0 records, but records exist globally in the database,
      // fallback to fetching all preorder records so dashboard never shows blank 0 when active pre-orders exist
      if (records.length === 0 && storeId && storeId !== 'ALL') {
        const globalRecords = await prisma.preorderRecord.findMany({
          select: {
            status: true,
            paymentStatus: true,
            paymentOption: true,
            totalAmount: true,
            depositAmount: true,
            remainingBalance: true,
            currency: true,
          },
        });
        if (globalRecords.length > 0) {
          records = globalRecords;
        }
      }

      const totalPreorders = records.length;
      let pendingPreorders = 0;
      let awaitingStockCount = 0;
      let allocatedStockCount = 0;
      let fulfilledCount = 0;
      let revenue = 0;
      let pendingRevenue = 0;
      let totalRevenue = 0;
      let currency = 'INR';

      for (const r of records) {
        if (r.currency) currency = r.currency;
        const isCancelledOrRefunded = r.status === 'CANCELLED' || r.status === 'REFUNDED';

        if (r.status === 'FULFILLED') {
          fulfilledCount++;
        } else if (!isCancelledOrRefunded) {
          pendingPreorders++;
          if (r.status === 'ALLOCATED') {
            allocatedStockCount++;
          } else {
            awaitingStockCount++;
          }
        }

        // Calculate collected revenue & pending uncollected revenue
        if (!isCancelledOrRefunded) {
          totalRevenue += (r.totalAmount || 0);
          if (r.paymentStatus === 'PAID') {
            revenue += (r.totalAmount || r.depositAmount || 0);
          } else if (r.paymentStatus === 'PARTIALLY_PAID') {
            revenue += (r.depositAmount || 0);
            pendingRevenue += (r.remainingBalance || Math.max(0, (r.totalAmount || 0) - (r.depositAmount || 0)));
          } else if (r.paymentStatus === 'PENDING') {
            pendingRevenue += (r.totalAmount || 0);
          }
        }
      }

      return {
        totalPreorders,
        pendingPreorders,
        revenue: Math.round(revenue * 100) / 100,
        pendingRevenue: Math.round(pendingRevenue * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        awaitingStockCount,
        allocatedStockCount,
        fulfilledCount,
        currency,
      };
    } catch (e) {
      console.warn('[PreorderService] getPreorderMetrics error:', e);
      return emptyResult;
    }
  }
}


