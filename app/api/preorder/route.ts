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
    const { store, isStandalone } = await authenticate(req);
    if (!isStandalone) {
      return NextResponse.json(
        { success: false, error: 'Pre-order is restricted to Standalone stores.' },
        { status: 403 }
      );
    }
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
      return NextResponse.json({
        success: true,
        ...records,
      });
    }

    const productId = searchParams.get('productId');
    const variantId = searchParams.get('variantId');

    const config = await PreorderService.getConfig(store.id, productId, variantId);
    const overrides = await PreorderService.listOverrides(store.id);

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
      calculation,
      sample100,
      sample500Half,
      sample500Full,
      overrides,
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { store, isStandalone } = await authenticate(req);
    if (!isStandalone) {
      return NextResponse.json(
        { success: false, error: 'Pre-order is restricted to Standalone stores.' },
        { status: 403 }
      );
    }
    const body = await req.json();

    const parsed = PreorderConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await PreorderService.upsertConfig(store.id, parsed.data);
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
