import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { safeEncrypt } from '@/lib/utils/encryption';
import { z } from 'zod';
import { PreorderNotificationService } from '@/services/preorder/preorder-notifications';

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
  orderId: z.union([z.string(), z.number()]).transform(v => String(v)).optional(),
  orderNumber: z.union([z.string(), z.number()]).transform(v => String(v)),
  variantId: z.union([z.string(), z.number()]).transform(v => String(v)),
  customerName: z.string().optional().nullable(),
  customerEmail: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  quantity: z.union([z.string(), z.number()]).transform(v => Math.max(1, parseInt(String(v), 10) || 1)).optional().default(1),
  productTitle: z.string().optional().nullable(),
  variantTitle: z.string().optional().nullable(),
  paymentOption: z.enum(['HALF', 'FULL']).optional().default('HALF'),
  totalAmount: z.union([z.string(), z.number()]).transform(v => parseFloat(String(v)) || 0).optional().default(0),
  depositAmount: z.union([z.string(), z.number()]).transform(v => parseFloat(String(v)) || 0).optional().default(0),
  remainingBalance: z.union([z.string(), z.number()]).transform(v => parseFloat(String(v)) || 0).optional().default(0),
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
    let formattedOrderNumber = data.orderNumber ? data.orderNumber.trim() : 'auto';
    let cleanOrderId = data.orderId || '';

    // Only real Shopify orders should be recorded - never invent fake sequential order numbers
    if (!data.orderNumber || data.orderNumber === 'auto' || data.orderNumber.toLowerCase() === 'pre-auto') {
      return NextResponse.json(
        { success: false, error: 'A valid Shopify order number is required to record a pre-order.' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    if (!formattedOrderNumber.toUpperCase().startsWith('PRE-')) {
      const base = formattedOrderNumber.startsWith('#') ? formattedOrderNumber : `#${formattedOrderNumber}`;
      formattedOrderNumber = `PRE-${base}`;
    }

    if (!cleanOrderId.startsWith('storefront_')) {
      try {
        await prisma.preorderRecord.deleteMany({
          where: {
            storeId: store.id,
            shopifyVariantId: cleanVariantId,
            shopifyOrderId: { startsWith: 'storefront_' },
          },
        });
      } catch (_) {}
    }

    let customerName = data.customerName || null;
    let customerEmail = data.customerEmail || null;
    let customerPhone = data.customerPhone || null;

    // Strict deduplication by orderNumber to guarantee no duplicate rows for the same Shopify order
    const existingByOrder = await prisma.preorderRecord.findFirst({
      where: {
        storeId: store.id,
        orderNumber: formattedOrderNumber,
      },
    });

    let record: any;
    if (existingByOrder) {
      record = await prisma.preorderRecord.update({
        where: { id: existingByOrder.id },
        data: {
          shopifyOrderId: cleanOrderId,
          shopifyVariantId: cleanVariantId,
          customerName: customerName ? safeEncrypt(customerName) : existingByOrder.customerName,
          customerEmail: customerEmail ? safeEncrypt(customerEmail) : existingByOrder.customerEmail,
          customerPhone: customerPhone ? safeEncrypt(customerPhone) : existingByOrder.customerPhone,
          quantity: data.quantity,
          status: 'UNFULFILLED',
          productTitle: data.productTitle || existingByOrder.productTitle,
          variantTitle: data.variantTitle || existingByOrder.variantTitle,
          paymentOption: data.paymentOption,
          totalAmount: data.totalAmount > 0 ? data.totalAmount : existingByOrder.totalAmount,
          depositAmount: data.depositAmount > 0 ? data.depositAmount : existingByOrder.depositAmount,
          remainingBalance: data.remainingBalance >= 0 ? data.remainingBalance : existingByOrder.remainingBalance,
          paymentStatus: data.paymentStatus,
        },
      });
    } else {
      record = await prisma.preorderRecord.upsert({
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
          customerName: customerName ? safeEncrypt(customerName) : null,
          customerEmail: customerEmail ? safeEncrypt(customerEmail) : null,
          customerPhone: customerPhone ? safeEncrypt(customerPhone) : null,
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
          customerName: customerName ? safeEncrypt(customerName) : null,
          customerEmail: customerEmail ? safeEncrypt(customerEmail) : null,
          customerPhone: customerPhone ? safeEncrypt(customerPhone) : null,
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
    }

    console.log(`[Storefront:RecordPreorder] Saved preorder for order ${formattedOrderNumber} (Variant: ${cleanVariantId})`);

    // Bidirectional sync to both Neon DBs (Vercel & AWS) so Amplify, Vercel, and Local are always 100% in sync
    const targetNeonUrls = [
      'postgresql://neondb_owner:npg_AnjY2lru1EtG@ep-restless-sun-b5m5tyc8-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
      'postgresql://neondb_owner:npg_U2vAaDoV4OKg@ep-patient-dream-bbqakoyb-pooler.c-15.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    ];

    for (const remoteNeonUrl of targetNeonUrls) {
      if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes(remoteNeonUrl.split('@')[1]?.split('?')[0])) {
        continue; // Skip the database we already wrote to above
      }
      try {
        const { PrismaClient } = require('@prisma/client');
        const remoteNeon = new PrismaClient({
          datasources: { db: { url: remoteNeonUrl } }
        });
        const existingRemoteByOrder = await remoteNeon.preorderRecord.findFirst({
          where: {
            storeId: store.id,
            orderNumber: formattedOrderNumber,
          },
        });

        if (existingRemoteByOrder) {
          await remoteNeon.preorderRecord.update({
            where: { id: existingRemoteByOrder.id },
            data: {
              shopifyOrderId: cleanOrderId,
              shopifyVariantId: cleanVariantId,
              customerName: customerName ? safeEncrypt(customerName) : existingRemoteByOrder.customerName,
              customerEmail: customerEmail ? safeEncrypt(customerEmail) : existingRemoteByOrder.customerEmail,
              customerPhone: customerPhone ? safeEncrypt(customerPhone) : existingRemoteByOrder.customerPhone,
              quantity: data.quantity,
              status: 'UNFULFILLED',
              productTitle: data.productTitle || existingRemoteByOrder.productTitle,
              variantTitle: data.variantTitle || existingRemoteByOrder.variantTitle,
              paymentOption: data.paymentOption,
              totalAmount: data.totalAmount > 0 ? data.totalAmount : existingRemoteByOrder.totalAmount,
              depositAmount: data.depositAmount > 0 ? data.depositAmount : existingRemoteByOrder.depositAmount,
              remainingBalance: data.remainingBalance >= 0 ? data.remainingBalance : existingRemoteByOrder.remainingBalance,
              paymentStatus: data.paymentStatus,
            },
          });
        } else {
          await remoteNeon.preorderRecord.upsert({
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
              customerName: customerName ? safeEncrypt(customerName) : null,
              customerEmail: customerEmail ? safeEncrypt(customerEmail) : null,
              customerPhone: customerPhone ? safeEncrypt(customerPhone) : null,
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
              customerName: customerName ? safeEncrypt(customerName) : null,
              customerEmail: customerEmail ? safeEncrypt(customerEmail) : null,
              customerPhone: customerPhone ? safeEncrypt(customerPhone) : null,
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
        }

        // Also create notification on remote Neon DB
        const fullTitle = data.variantTitle ? `${data.productTitle || 'Pre-order Item'} - ${data.variantTitle}` : (data.productTitle || 'Pre-order Item');
        const notifTitle = `New Pre-order: ${formattedOrderNumber}`;
        const paymentDesc = data.paymentOption === 'HALF'
          ? `Half Payment (Paid: ₹${Number(data.depositAmount).toFixed(2)}, Due: ₹${Number(data.remainingBalance).toFixed(2)})`
          : `Full Payment (Paid: ₹${Number(data.depositAmount).toFixed(2)})`;
        const notifMessage = `${customerName || customerEmail || 'Customer'} placed a pre-order for ${data.quantity}x ${fullTitle} (${formattedOrderNumber}). ${paymentDesc}.`;

        const existingNotif = await remoteNeon.notification.findFirst({
          where: { recipientStoreId: store.id, title: notifTitle }
        });
        if (!existingNotif) {
          await remoteNeon.notification.create({
            data: {
              recipientStoreId: store.id,
              type: 'INVENTORY_UPDATE',
              title: notifTitle,
              message: notifMessage,
              productId: cleanVariantId,
              productTitle: fullTitle,
              sourceStoreId: store.id,
              metadata: {
                eventType: 'PREORDER_CREATED',
                orderNumber: formattedOrderNumber,
                paymentOption: data.paymentOption,
                depositAmount: data.depositAmount,
                remainingBalance: data.remainingBalance,
              }
            }
          });
        }
        await remoteNeon.$disconnect();
      } catch (neonErr: any) {
        console.warn('[Storefront:RecordPreorder:NeonSyncWarn]', neonErr.message);
      }
    }

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

    // Create in-app notification in StoreBridge Dashboard with persistent deduplication
    try {
      await PreorderNotificationService.notifyNewPreorder({
        storeId: store.id,
        orderNumber: formattedOrderNumber,
        productTitle: data.productTitle || 'Pre-order Item',
        quantity: data.quantity,
        paymentOption: (data as any).paymentOption || 'FULL',
        depositAmount: Number(data.depositAmount) || 0,
        remainingBalance: Number(data.remainingBalance) || 0,
        customerName: customerName,
        customerEmail: customerEmail,
        productId: cleanVariantId,
      });

      await PreorderNotificationService.notifyAwaitingStock({
        storeId: store.id,
        orderNumber: formattedOrderNumber,
        productTitle: data.productTitle || 'Pre-order Item',
        quantity: data.quantity,
        productId: cleanVariantId,
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
