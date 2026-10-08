import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/shopify/webhooks";
import { prisma } from "@/lib/db/prisma";
import { safeEncrypt } from "@/lib/utils/encryption";
import { EmailNotificationService } from "@/services/notifications/email-notification-service";
import { NotificationChannel, NotificationJobStatus } from "@prisma/client";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { topic, shop, webhookId, eventId, rawBody } = await verifyWebhook(req);
    const timeISO = new Date().toISOString();

    console.log(`[Webhook:Received] Time: ${timeISO} | Shop: ${shop} | Topic: ${topic} | WebhookId: ${webhookId}`);

    if (topic !== 'orders/create' && topic !== 'orders/paid') {
      return new NextResponse('Ignored topic', { status: 200 });
    }

    const order = JSON.parse(rawBody);
    const orderId = String(order.id);
    const orderNumber = order.name || `#${orderId}`;
    const customerEmail = order.email || order.contact_email || order.customer?.email || null;
    const customerPhone = order.phone || order.customer?.phone || null;
    const customerName = [order.customer?.first_name, order.customer?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim() || null;

    // Resolve store
    const cleanShop = shop.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
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
      console.warn(`[Webhook:orders/create] Active store not found for domain: ${shop}`);
      return new NextResponse('Store not found', { status: 200 });
    }

    const storeDisplayName = store.label || store.shopDomain;

    // Check line items for pre-order flag
    const lineItems = order.line_items || [];
    let preorderCount = 0;

    for (const item of lineItems) {
      const properties = item.properties || item.customAttributes || [];
      const isPreorder = properties.some((prop: any) => {
        const key = prop.name || prop.key;
        const val = prop.value;
        return key === '_preorder' && (val === 'true' || val === true);
      });

      if (!isPreorder) continue;

      preorderCount++;
      const cleanVariantId = String(item.variant_id || '').replace(/\D/g, '');
      const itemTitle = item.title || 'Product';
      const variantTitle = item.variant_title || null;
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const price = item.price ? `₹${item.price}` : null;

      console.log(`[Webhook:orders/create] Detected Pre-order item: Order: ${orderNumber} | Variant: ${cleanVariantId} | Customer: ${customerEmail}`);

      // 1. Save PreorderRecord in DB with encrypted sensitive customer details
      try {
        await prisma.preorderRecord.upsert({
          where: {
            storeId_shopifyOrderId_shopifyVariantId: {
              storeId: store.id,
              shopifyOrderId: orderId,
              shopifyVariantId: cleanVariantId,
            },
          },
          create: {
            storeId: store.id,
            shopifyOrderId: orderId,
            orderNumber,
            shopifyVariantId: cleanVariantId,
            customerName: safeEncrypt(customerName),
            customerEmail: safeEncrypt(customerEmail),
            customerPhone: safeEncrypt(customerPhone),
            quantity,
            whatsappOptIn: false,
            status: 'UNFULFILLED',
          },
          update: {
            orderNumber,
            customerName: safeEncrypt(customerName),
            customerEmail: safeEncrypt(customerEmail),
            customerPhone: safeEncrypt(customerPhone),
            quantity,
          },
        });
      } catch (dbErr: any) {
        console.warn(`[Webhook:orders/create:PreorderRecordSaveError]`, dbErr.message);
      }

      // 2. Dispatch instant Pre-order Confirmation Email to the customer
      if (customerEmail) {
        try {
          let itemImageUrl: string | null = null;
          try {
            const cached = await prisma.productCache.findFirst({
              where: {
                storeId: store.id,
                OR: [
                  { shopifyVariantId: cleanVariantId },
                  { shopifyVariantId: `gid://shopify/ProductVariant/${cleanVariantId}` },
                ],
              },
            });
            if (cached?.imageUrl) itemImageUrl = cached.imageUrl;
          } catch {}

          const emailRes = await EmailNotificationService.sendPreorderConfirmationEmail({
            to: customerEmail,
            productTitle: itemTitle,
            variantTitle,
            orderNumber,
            customerName,
            price,
            imageUrl: itemImageUrl,
            storeName: storeDisplayName,
            productUrl: `https://${store.shopDomain}`,
          });

          // Log notification job in DB
          if (emailRes.success) {
            await prisma.notificationJob.create({
              data: {
                storeId: store.id,
                shopifyVariantId: cleanVariantId,
                customerEmail: safeEncrypt(customerEmail),
                channel: NotificationChannel.EMAIL,
                productTitle: `[Pre-order Confirmed] ${itemTitle}`,
                variantTitle,
                status: NotificationJobStatus.SENT,
                sentAt: new Date(),
              },
            });
          }
        } catch (mailErr: any) {
          console.error(`[Webhook:orders/create:EmailError]`, mailErr.message);
        }
      }
    }

    console.log(`[Webhook:orders/create] Completed order ${orderNumber}. Pre-order items found: ${preorderCount}`);
    return new NextResponse('Order processed successfully', { status: 200 });
  } catch (error: any) {
    console.error("[Webhook:orders/create] error:", error.message);
    if (error.message === "Webhook signature verification failed.") {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    // Return 200 to prevent Shopify from retrying excessively on internal errors
    return new NextResponse("Internal Server Error Handled", { status: 200 });
  }
}
