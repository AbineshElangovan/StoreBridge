import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { safeEncrypt } from '@/lib/utils/encryption';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Shopify-Shop-Domain, X-Tunnel-Skip-Anti-Phishing-Page, Accept',
  };
}

const RecordPreorderSchema = z.object({
  shop: z.string().min(1, 'Shop domain is required'),
  orderId: z.string().optional(),
  orderNumber: z.string().min(1, 'Order number is required'),
  variantId: z.string().min(1, 'Variant ID is required'),
  customerName: z.string().optional().nullable(),
  customerEmail: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  quantity: z.number().int().min(1).optional().default(1),
  productTitle: z.string().optional().nullable(),
  variantTitle: z.string().optional().nullable(),
  paymentOption: z.enum(['HALF', 'FULL']).optional().default('HALF'),
  totalAmount: z.number().optional().default(0),
  depositAmount: z.number().optional().default(0),
  remainingBalance: z.number().optional().default(0),
  paymentStatus: z.string().optional().default('PARTIALLY_PAID'),
  currency: z.string().optional().default('INR'),
});

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  try {
    const body = await req.json();
    const parsed = RecordPreorderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const data = parsed.data;
    const cleanShop = data.shop.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];

    const store = await prisma.store.findFirst({
      where: {
        isActive: true,
        OR: [
          { shopDomain: cleanShop },
          { shopDomain: { contains: cleanShop.split('.')[0], mode: 'insensitive' } },
        ],
      },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: 'Store not found' },
        { status: 404, headers: corsHeaders(origin) }
      );
    }

    const cleanVariantId = data.variantId.replace(/\D/g, '');
    const cleanOrderId = data.orderId || `storefront_${data.orderNumber.replace(/\D/g, '') || Date.now()}`;

    const record = await prisma.preorderRecord.upsert({
      where: {
        storeId_shopifyOrderId_shopifyVariantId: {
          storeId: store.id,
          shopifyOrderId: cleanOrderId,
          shopifyVariantId: cleanVariantId,
        },
      },
      create: {
        storeId: store.id,
        shopifyOrderId: cleanOrderId,
        orderNumber: data.orderNumber,
        shopifyVariantId: cleanVariantId,
        customerName: data.customerName ? safeEncrypt(data.customerName) : null,
        customerEmail: data.customerEmail ? safeEncrypt(data.customerEmail) : null,
        customerPhone: data.customerPhone ? safeEncrypt(data.customerPhone) : null,
        quantity: data.quantity,
        whatsappOptIn: false,
        status: 'UNFULFILLED',
        productTitle: data.productTitle || null,
        variantTitle: data.variantTitle || null,
        paymentOption: data.paymentOption,
        totalAmount: data.totalAmount,
        depositAmount: data.depositAmount,
        remainingBalance: data.remainingBalance,
        paymentStatus: data.paymentStatus,
        currency: data.currency,
      },
      update: {
        orderNumber: data.orderNumber,
        customerName: data.customerName ? safeEncrypt(data.customerName) : null,
        customerEmail: data.customerEmail ? safeEncrypt(data.customerEmail) : null,
        customerPhone: data.customerPhone ? safeEncrypt(data.customerPhone) : null,
        quantity: data.quantity,
        status: 'UNFULFILLED',
        productTitle: data.productTitle || null,
        variantTitle: data.variantTitle || null,
        paymentOption: data.paymentOption,
        totalAmount: data.totalAmount,
        depositAmount: data.depositAmount,
        remainingBalance: data.remainingBalance,
        paymentStatus: data.paymentStatus,
      },
    });

    console.log(`[Storefront:RecordPreorder] Saved preorder for order ${data.orderNumber} (Variant: ${cleanVariantId})`);

    return NextResponse.json(
      { success: true, recordId: record.id },
      { status: 200, headers: corsHeaders(origin) }
    );
  } catch (error: any) {
    console.error('[Storefront:RecordPreorder] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
