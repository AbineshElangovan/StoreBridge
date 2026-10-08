import { NextRequest, NextResponse } from 'next/server';
import { authenticate, handleApiError } from '@/lib/shopify/authenticate';
import { PreorderService } from '@/services/preorder/preorder-service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const PreorderConfigSchema = z.object({
  enabled: z.boolean().optional(),
  inventoryThreshold: z.number().int().min(0).max(10000).optional(),
  customerMessage: z.string().max(255).optional(),
  shippingMessage: z.string().max(255).optional(),
  fulfillmentMessage: z.string().max(255).optional(),
  maxQuantity: z.number().int().positive().nullable().optional(),
  discountType: z.enum(['none', 'percentage', 'fixed']).optional(),
  discountValue: z.number().min(0).max(1000000).optional(),
  shopifyProductId: z.string().nullable().optional(),
  shopifyVariantId: z.string().nullable().optional(),
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

      const calculation = PreorderService.calculatePrice(basePrice, discountType, discountValue);
      const sample100 = PreorderService.calculatePrice(100, discountType, discountValue);
      const sample1240 = PreorderService.calculatePrice(1240, discountType, discountValue);

      return NextResponse.json({
        success: true,
        calculation,
        sample100,
        sample1240,
      });
    }

    if (type === 'records') {
      const page = parseInt(searchParams.get('page') || '1', 10);
      const pageSize = parseInt(searchParams.get('pageSize') || '15', 10);
      const records = await PreorderService.getPreorderRecords(store.id, page, pageSize);
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

    return NextResponse.json({
      success: true,
      config,
      calculation,
      sample100,
      overrides,
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
    const calculation = PreorderService.calculatePrice(
      1240,
      (updated as any).discountType || 'none',
      (updated as any).discountValue || 0
    );
    const sample100 = PreorderService.calculatePrice(
      100,
      (updated as any).discountType || 'none',
      (updated as any).discountValue || 0
    );

    return NextResponse.json({
      success: true,
      config: updated,
      calculation,
      sample100,
      message: 'Pre-order configuration saved successfully',
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}
