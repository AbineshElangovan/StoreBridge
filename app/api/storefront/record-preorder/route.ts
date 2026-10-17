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

    // Reject/ignore premature PRE- temporary tokens from button clicks
    if (data.orderNumber.startsWith('PRE-')) {
      console.log(`[Storefront:RecordPreorder] Ignored temporary button token: ${data.orderNumber}`);
      return NextResponse.json(
        { success: true, message: 'Temporary token acknowledged. Waiting for completed order.' },
        { status: 200, headers: corsHeaders(origin) }
      );
    }

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

    // Standardize pre-order number as PRE-#XXXX with the real Shopify order number
    const rawNumber = data.orderNumber.trim();
    let formattedOrderNumber = rawNumber;
    if (!formattedOrderNumber.toUpperCase().startsWith('PRE-')) {
      const base = formattedOrderNumber.startsWith('#') ? formattedOrderNumber : `#${formattedOrderNumber}`;
      formattedOrderNumber = `PRE-${base}`;
    }

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
        orderNumber: formattedOrderNumber,
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
        orderNumber: formattedOrderNumber,
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

    console.log(`[Storefront:RecordPreorder] Saved preorder for order ${formattedOrderNumber} (Variant: ${cleanVariantId})`);

    // Dispatch Pre-order confirmation email to customer
    if (data.customerEmail) {
      try {
        const { EmailNotificationService } = require('@/services/notifications/email-notification-service');
        await EmailNotificationService.sendPreorderConfirmationEmail({
          to: data.customerEmail,
          productTitle: data.productTitle || 'Pre-order Item',
          variantTitle: data.variantTitle || undefined,
          orderNumber: formattedOrderNumber,
          customerName: data.customerName || undefined,
          paymentOption: data.paymentOption,
          depositAmount: data.depositAmount,
          remainingBalance: data.remainingBalance,
          totalAmount: data.totalAmount,
          storeName: store.label || store.shopDomain,
          productUrl: `https://${cleanShop}`,
        });
      } catch (emErr: any) {
        console.warn('[Storefront:RecordPreorder:EmailError]', emErr.message);
      }
    }

    // Create in-app notification in StoreBridge Dashboard
    try {
      await prisma.notification.create({
        data: {
          recipientStoreId: store.id,
          type: 'INVENTORY_UPDATE',
          title: `New Pre-order: ${formattedOrderNumber}`,
          message: `${data.customerName || data.customerEmail || 'Customer'} placed a pre-order for ${data.productTitle || 'Product'} (${data.quantity} ${data.quantity === 1 ? 'unit' : 'units'}) - ${formattedOrderNumber}.`,
          productId: cleanVariantId,
          productTitle: data.productTitle || 'Pre-order Item',
          sourceStoreId: store.id,
          isRead: false,
        },
      });
    } catch (_) {}

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
