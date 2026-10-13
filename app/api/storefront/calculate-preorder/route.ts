import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { PreorderService } from '@/services/preorder/preorder-service';
import { isStoreStandalone } from '@/lib/shopify/authenticate';

export const dynamic = 'force-dynamic';

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Shopify-Shop-Domain, X-Tunnel-Skip-Anti-Phishing-Page, Accept',
  };
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin');
  try {
    const searchParams = req.nextUrl.searchParams;
    let shop = searchParams.get('shop') || req.headers.get('x-shopify-shop-domain');
    const productId = searchParams.get('productId');
    const variantId = searchParams.get('variantId');
    const price = parseFloat(searchParams.get('price') || '0');
    const currency = searchParams.get('currency') || 'Rs.';

    if (!shop && origin) {
      try {
        shop = new URL(origin).hostname;
      } catch (e) {}
    }

    if (!shop) {
      return NextResponse.json(
        { success: false, error: 'Shop domain parameter is required' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const cleanShop = shop.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    const store = await prisma.store.findFirst({
      where: {
        OR: [
          { shopDomain: { equals: cleanShop, mode: 'insensitive' } },
          { shopDomain: { contains: cleanShop, mode: 'insensitive' } },
        ],
      },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: 'Store not found' },
        { status: 404, headers: corsHeaders(origin) }
      );
    }

    const isStandalone = await isStoreStandalone(store.id);
    if (!isStandalone) {
      return NextResponse.json(
        { success: false, error: 'Pre-order is not enabled for this store' },
        { status: 403, headers: corsHeaders(origin) }
      );
    }

    const preorderConfig = await PreorderService.getConfig(store.id, productId, variantId);

    const calculation = PreorderService.calculatePrice(
      price,
      (preorderConfig as any).discountType || 'none',
      (preorderConfig as any).discountValue || 0,
      currency
    );

    return NextResponse.json(
      {
        success: true,
        calculation,
      },
      { headers: corsHeaders(origin) }
    );
  } catch (error: any) {
    console.error('[Storefront:CalculatePreorder:Error]', error);
    return NextResponse.json(
      { success: false, error: 'Calculation failed' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
