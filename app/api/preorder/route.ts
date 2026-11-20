import { logUserActivity } from '@/lib/activity/user-activity';
import { NextRequest, NextResponse } from 'next/server';
import { authenticate, handleApiError } from '@/lib/shopify/authenticate';
import { PreorderService } from '@/services/preorder/preorder-service';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const PreorderConfigSchema = z.object({
  enabled: z.boolean().optional(),
  inventoryThreshold: z.number().int().min(-9999).max(10000).optional(),
  customerMessage: z.string().max(255).optional(),
  shippingMessage: z.string().max(255).optional(),
  fulfillmentMessage: z.string().max(255).optional(),
  maxQuantity: z.number().int().positive().nullable().optional(),
  discountType: z.enum(['none', 'percentage', 'fixed']).optional(),
  discountValue: z.number().min(0).max(1000000).optional(),
  selectionMode: z.enum(['ALL_PRODUCTS', 'SPECIFIC_PRODUCTS', 'COLLECTIONS']).optional(),
  selectedProductIds: z.array(z.string()).optional(),
  selectedCollectionIds: z.array(z.string()).optional(),
  shopifyProductId: z.string().nullable().optional(),
  shopifyVariantId: z.string().nullable().optional(),
  allowHalfPayment: z.boolean().optional(),
  allowFullPayment: z.boolean().optional(),
  defaultPaymentOption: z.enum(['HALF', 'FULL']).optional(),
  // Status & Scheduling
  statusScheduleType: z.enum(['AVAILABLE_NOW', 'FROM_START_DATE', 'UNTIL_END_DATE', 'BETWEEN_DATES', 'NOT_AVAILABLE']).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  // Countdown Timer
  showTimer: z.boolean().optional(),
  timerDisplayMode: z.string().optional(),
  timerDateMode: z.string().optional(),
  timerCustomDate: z.string().nullable().optional(),
  timerHeading: z.string().max(255).optional(),
  timerTextColor: z.string().max(50).optional(),
  timerBgColor: z.string().max(50).optional(),
  timerHeadingEnd: z.string().max(255).optional(),
  timerTextColorEnd: z.string().max(50).optional(),
  timerBgColorEnd: z.string().max(50).optional(),
  timerBorderRadius: z.number().int().min(0).max(100).optional(),
  timerShowDays: z.boolean().optional(),
  timerShowHours: z.boolean().optional(),
  timerShowMinutes: z.boolean().optional(),
  timerShowSeconds: z.boolean().optional(),
  timerDaysLabel: z.string().max(50).optional(),
  timerHoursLabel: z.string().max(50).optional(),
  timerMinutesLabel: z.string().max(50).optional(),
  timerSecondsLabel: z.string().max(50).optional(),
}).refine((data) => {
  if (data.allowHalfPayment === false && data.allowFullPayment === false) {
    return false;
  }
  return true;
}, {
  message: 'At least one payment option (Half Payment or Full Payment) must remain enabled.',
  path: ['allowHalfPayment'],
});

export async function GET(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type');
    const action = searchParams.get('action');

    // Live calculation API endpoint: all calculations computed exclusively in backend API
    if (action === 'calculate') {
      const basePrice = parseFloat(searchParams.get('basePrice') || '1240');
      const discountType = (searchParams.get('discountType') || 'none') as 'none' | 'percentage' | 'fixed';
      const discountValue = parseFloat(searchParams.get('discountValue') || '0');
      const paymentOption = (searchParams.get('paymentOption') || 'HALF') as 'HALF' | 'FULL';

      const calculation = PreorderService.calculatePrice(basePrice, discountType, discountValue);
      const effectivePrice = calculation.finalPrice > 0 ? calculation.finalPrice : basePrice;
      const paymentBreakdown = PreorderService.calculatePaymentBreakdown(effectivePrice, paymentOption);
      const sample100 = PreorderService.calculatePrice(100, discountType, discountValue);
      const sample1240 = PreorderService.calculatePrice(1240, discountType, discountValue);
      const sample500Half = PreorderService.calculatePaymentBreakdown(500, 'HALF');
      const sample500Full = PreorderService.calculatePaymentBreakdown(500, 'FULL');

      return NextResponse.json({
        success: true,
        calculation,
        paymentBreakdown,
        sample100,
        sample1240,
        sample500Half,
        sample500Full,
      });
    }

    if (action === 'products') {
      const items = await prisma.productCache.findMany({
        where: { storeId: store.id },
        select: {
          id: true,
          shopifyProductId: true,
          shopifyVariantId: true,
          title: true,
          sku: true,
          imageUrl: true,
          price: true,
          inventoryQuantity: true,
          collections: {
            select: {
              collection: {
                select: { id: true, title: true }
              }
            }
          }
        },
        orderBy: { title: 'asc' }
      });

      const productMap = new Map<string, any>();
      for (const item of items) {
        const cleanTitle = item.title ? item.title.split(' - ')[0].trim() : 'Untitled Product';
        let existing = productMap.get(item.shopifyProductId);
        if (!existing) {
          existing = {
            id: item.id,
            shopifyProductId: item.shopifyProductId,
            title: cleanTitle,
            sku: item.sku || null,
            imageUrl: item.imageUrl || null,
            price: item.price || 0,
            totalInventory: 0,
            variantCount: 0,
            hasOutOfStockVariant: false,
            variants: [],
            collections: [],
          };
          productMap.set(item.shopifyProductId, existing);
        }

        existing.variantCount += 1;
        existing.totalInventory += item.inventoryQuantity;
        if (item.inventoryQuantity <= 0) {
          existing.hasOutOfStockVariant = true;
        }

        existing.variants.push({
          id: item.shopifyVariantId,
          title: item.title,
          sku: item.sku,
          inventoryQuantity: item.inventoryQuantity,
          price: item.price,
        });

        if (item.collections) {
          for (const cp of item.collections) {
            if (cp.collection && !existing.collections.some((c: any) => c.id === cp.collection.id)) {
              existing.collections.push(cp.collection);
            }
          }
        }
        if (!existing.imageUrl && item.imageUrl) {
          existing.imageUrl = item.imageUrl;
        }
      }

      const products = Array.from(productMap.values()).map(p => ({
        ...p,
        isOutOfStock: p.totalInventory <= 0 || p.hasOutOfStockVariant,
      }));

      return NextResponse.json({
        success: true,
        products,
      });
    }

    if (type === 'records') {
      const page = parseInt(searchParams.get('page') || '1', 10);
      const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
      const search = searchParams.get('search') || '';
      const paymentStatus = searchParams.get('paymentStatus') || 'ALL';
      const records = await PreorderService.getPreorderRecords(store.id, page, pageSize, search, paymentStatus);
      const metrics = await PreorderService.getPreorderMetrics(store.id);
      return NextResponse.json({
        success: true,
        ...records,
        metrics,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        }
      });
    }

    if (type === 'metrics') {
      const metrics = await PreorderService.getPreorderMetrics(store.id);
      return NextResponse.json({
        success: true,
        metrics,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        }
      });
    }

    const productId = searchParams.get('productId');
    const variantId = searchParams.get('variantId');

    const config = await PreorderService.getConfig(store.id, productId, variantId);
    const overrides = await PreorderService.listOverrides(store.id);
    const metrics = await PreorderService.getPreorderMetrics(store.id);

    // Initial calculations computed strictly in backend API
    const calculation = PreorderService.calculatePrice(
      1240,
      (config as any).discountType || 'none',
      (config as any).discountValue || 0
    );
    const sample100 = PreorderService.calculatePrice(
      100,
      (config as any).discountType || 'none',
      (config as any).discountValue || 0
    );
    const sample500Half = PreorderService.calculatePaymentBreakdown(500, 'HALF');
    const sample500Full = PreorderService.calculatePaymentBreakdown(500, 'FULL');

    return NextResponse.json({
      success: true,
      config,
      metrics,
      calculation,
      sample100,
      sample500Half,
      sample500Full,
      overrides,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
      }
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    const body = await req.json();

    const parsed = PreorderConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await PreorderService.upsertConfig(store.id, parsed.data);

    // Real-time synchronization to Neon DB so live storefront updates immediately
    const neonUrl = process.env.VERCEL_NEON_URL ||
      process.env.REMOTE_NEON_URL ||
      'postgresql://neondb_owner:npg_7rDw2gJtlEeU@ep-restless-sun-b5m5tyc8.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require';

    if (!process.env.DATABASE_URL?.includes('neon.tech')) {
      try {
        const { PrismaClient } = await import('@prisma/client');
        const neonPrisma = new PrismaClient({
          datasources: { db: { url: neonUrl } },
        });

        const existing = await neonPrisma.preorderConfig.findFirst({
          where: {
            storeId: store.id,
            shopifyProductId: (updated as any).shopifyProductId || null,
            shopifyVariantId: (updated as any).shopifyVariantId || null,
          },
        });

        const configFields = {
          enabled: (updated as any).enabled,
          inventoryThreshold: (updated as any).inventoryThreshold,
          customerMessage: (updated as any).customerMessage,
          shippingMessage: (updated as any).shippingMessage,
          fulfillmentMessage: (updated as any).fulfillmentMessage,
          maxQuantity: (updated as any).maxQuantity,
          discountType: (updated as any).discountType,
          discountValue: (updated as any).discountValue,
          selectionMode: (updated as any).selectionMode,
          selectedProductIds: (updated as any).selectedProductIds,
          selectedCollectionIds: (updated as any).selectedCollectionIds,
          allowHalfPayment: (updated as any).allowHalfPayment,
          allowFullPayment: (updated as any).allowFullPayment,
          defaultPaymentOption: (updated as any).defaultPaymentOption,
          statusScheduleType: (updated as any).statusScheduleType,
          startDate: (updated as any).startDate ? new Date((updated as any).startDate) : null,
          endDate: (updated as any).endDate ? new Date((updated as any).endDate) : null,
          showTimer: Boolean((updated as any).showTimer),
          timerDisplayMode: (updated as any).timerDisplayMode,
          timerDateMode: (updated as any).timerDateMode,
          timerCustomDate: (updated as any).timerCustomDate ? new Date((updated as any).timerCustomDate) : null,
          timerHeading: (updated as any).timerHeading,
          timerTextColor: (updated as any).timerTextColor,
          timerBgColor: (updated as any).timerBgColor,
          timerHeadingEnd: (updated as any).timerHeadingEnd,
          timerTextColorEnd: (updated as any).timerTextColorEnd,
          timerBgColorEnd: (updated as any).timerBgColorEnd,
          timerBorderRadius: (updated as any).timerBorderRadius,
          timerShowDays: (updated as any).timerShowDays,
          timerShowHours: (updated as any).timerShowHours,
          timerShowMinutes: (updated as any).timerShowMinutes,
          timerShowSeconds: (updated as any).timerShowSeconds,
          timerDaysLabel: (updated as any).timerDaysLabel,
          timerHoursLabel: (updated as any).timerHoursLabel,
          timerMinutesLabel: (updated as any).timerMinutesLabel,
          timerSecondsLabel: (updated as any).timerSecondsLabel,
        };

        if (existing) {
          await neonPrisma.preorderConfig.update({
            where: { id: existing.id },
            data: configFields,
          });
        } else {
          await neonPrisma.preorderConfig.create({
            data: {
              id: (updated as any).id,
              storeId: store.id,
              shopifyProductId: (updated as any).shopifyProductId || null,
              shopifyVariantId: (updated as any).shopifyVariantId || null,
              ...configFields,
            },
          });
        }
        await neonPrisma.$disconnect();
        console.log(`[RealtimeNeonSync] Successfully replicated preorder config to Neon DB for store ${store.id}`);
      } catch (neonErr) {
        console.warn('[RealtimeNeonSync] Warning: Failed to replicate to Neon DB:', neonErr);
      }
    }

    await logUserActivity({
      action: 'PREORDER_SETTINGS_CHANGED',
      shopDomain: store.shopDomain,
      storeId: store.id,
      merchantId: store.shopifyStoreId || store.id,
      actorType: 'SHOPIFY_USER',
      entityType: 'SETTINGS',
      description: `Pre-order updated: ${parsed.data.enabled !== undefined ? (parsed.data.enabled ? 'Enabled' : 'Disabled') : 'Configured'} (Mode: ${parsed.data.selectionMode || 'ALL_PRODUCTS'}).`,
      metadata: { enabled: parsed.data.enabled, selectionMode: parsed.data.selectionMode },
    });
    const effectiveDiscountType = (updated as any).discountType || parsed.data.discountType || 'none';
    const effectiveDiscountValue = (updated as any).discountValue !== undefined ? Number((updated as any).discountValue) : Number(parsed.data.discountValue || 0);

    let discountCode = null;
    if (effectiveDiscountType !== 'none' && effectiveDiscountValue > 0) {
      discountCode = await PreorderService.syncShopifyDiscount(
        store.id,
        effectiveDiscountType,
        effectiveDiscountValue
      );
    }

    // If Half Payment is allowed, sync deposit discount code in Shopify
    if (parsed.data.allowHalfPayment !== false) {
      await PreorderService.syncShopifyDepositDiscount(
        store.id,
        effectiveDiscountType,
        effectiveDiscountValue
      );
    }

    // Auto-update Shopify inventory policy to CONTINUE for targeted products so cart add succeeds
    const effectiveSelectedProductIds = (updated as any).selectedProductIds || parsed.data.selectedProductIds || [];
    await PreorderService.syncInventoryPolicy(store.id, effectiveSelectedProductIds);

    const calculation = PreorderService.calculatePrice(
      1240,
      effectiveDiscountType,
      effectiveDiscountValue
    );
    const sample100 = PreorderService.calculatePrice(
      100,
      effectiveDiscountType,
      effectiveDiscountValue
    );
    const sample500Half = PreorderService.calculatePaymentBreakdown(500, 'HALF');
    const sample500Full = PreorderService.calculatePaymentBreakdown(500, 'FULL');

    return NextResponse.json({
      success: true,
      config: updated,
      discountCode,
      calculation,
      sample100,
      sample500Half,
      sample500Full,
      message: 'Pre-order configuration saved successfully',
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}
