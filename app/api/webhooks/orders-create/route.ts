import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/shopify/webhooks";
import { prisma } from "@/lib/db/prisma";
import { safeEncrypt } from "@/lib/utils/encryption";
import { EmailNotificationService } from "@/services/notifications/email-notification-service";
import { PreorderNotificationService } from "@/services/preorder/preorder-notifications";
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
    const rawOrderName = order.name || `#${orderId}`;
    const orderNumber = `PRE-${rawOrderName.startsWith('#') ? rawOrderName : `#${rawOrderName}`}`;
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
      let isPreorder = properties.some((prop: any) => {
        const key = (prop.name || prop.key || '').toLowerCase();
        const val = String(prop.value || '').toLowerCase();
        return key === '_preorder' || key.includes('preorder') || key.includes('pre-order') || val === 'true';
      });

      if (!isPreorder && (item.title?.toLowerCase().includes('pre-order') || item.variant_title?.toLowerCase().includes('pre-order'))) {
        isPreorder = true;
      }

      if (!isPreorder) continue;

      preorderCount++;
      const cleanVariantId = String(item.variant_id || '').replace(/\D/g, '');
      const itemTitle = item.title || 'Product';
      const variantTitle = item.variant_title || null;
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const itemPrice = Number(item.price) || 0;
      const price = item.price ? `₹${item.price}` : null;

      // Extract payment option & amounts from custom line item properties
      let paymentOption = 'FULL';
      let propTotal: number | null = null;
      let propDeposit: number | null = null;
      let propRemaining: number | null = null;

      for (const p of properties) {
        const k = (p.name || p.key || '').toLowerCase();
        const v = String(p.value || '').trim();
        if (k === '_paymentoption' || k === 'payment option') {
          if (v.toUpperCase().includes('HALF') || v.includes('50%')) {
            paymentOption = 'HALF';
          } else if (v.toUpperCase().includes('FULL') || v.includes('100%')) {
            paymentOption = 'FULL';
          }
        }
        if (k === '_totalamount' && !isNaN(parseFloat(v))) propTotal = parseFloat(v);
        if (k === '_depositamount' && !isNaN(parseFloat(v))) propDeposit = parseFloat(v);
        if (k === '_remainingamount' && !isNaN(parseFloat(v))) propRemaining = parseFloat(v);
      }

      let totalAmount = 0;
      let depositAmount = 0;
      let remainingBalance = 0;

      if (paymentOption === 'HALF') {
        const unitTotal = propTotal && propTotal > 0 ? propTotal : (itemPrice > 0 ? itemPrice * 2 : 500);
        totalAmount = Math.round(unitTotal * quantity * 100) / 100;
        const unitDeposit = propDeposit && propDeposit > 0 ? propDeposit : (unitTotal / 2);
        depositAmount = Math.round(unitDeposit * quantity * 100) / 100;
        remainingBalance = Math.max(0, Math.round((totalAmount - depositAmount) * 100) / 100);
      } else {
        const unitTotal = propTotal && propTotal > 0 ? propTotal : itemPrice;
        totalAmount = Math.round(unitTotal * quantity * 100) / 100;
        depositAmount = totalAmount;
        remainingBalance = 0;
      }

      // Determine initial payment status strictly using Shopify source of truth
      const finStatus = (order.financial_status || '').toLowerCase();
      let calculatedPaymentStatus = 'PENDING';
      if (paymentOption === 'HALF') {
        // Half-payment orders must remain PARTIALLY_PAID until remaining balance is collected
        calculatedPaymentStatus = finStatus === 'voided' ? 'CANCELLED'
          : finStatus === 'refunded' ? 'REFUNDED'
          : 'PARTIALLY_PAID';
      } else {
        calculatedPaymentStatus = finStatus === 'paid' ? 'PAID'
          : finStatus === 'voided' ? 'CANCELLED'
          : finStatus === 'refunded' ? 'REFUNDED'
          : 'PENDING';
      }

      // Check existing record to avoid duplicate or overwriting confirmed payments
      const existingRecord = await (prisma as any).preorderRecord.findFirst({
        where: {
          storeId: store.id,
          shopifyOrderId: orderId,
          shopifyVariantId: cleanVariantId,
        },
      });

      // Preserve PAID if already confirmed
      const finalPaymentStatus = existingRecord?.paymentStatus === 'PAID'
        ? 'PAID'
        : calculatedPaymentStatus;

      const finalDepositAmount = finalPaymentStatus === 'PAID' ? totalAmount : depositAmount;
      const finalRemainingBalance = finalPaymentStatus === 'PAID' ? 0 : remainingBalance;

      const paymentLink = order.order_status_url || order.invoice_url || `https://${cleanShop}/account/orders`;

      console.log(`[Webhook:orders/create] Pre-order: ${orderNumber} | Variant: ${cleanVariantId} | Option: ${paymentOption} | Total: ${totalAmount} | Deposit: ${finalDepositAmount} | Due: ${finalRemainingBalance} | Status: ${finalPaymentStatus}`);

      // 1. Save PreorderRecord in DB with encrypted sensitive customer details
      try {
        await (prisma as any).preorderRecord.upsert({
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
            productTitle: itemTitle,
            variantTitle: variantTitle,
            customerName: safeEncrypt(customerName),
            customerEmail: safeEncrypt(customerEmail),
            customerPhone: safeEncrypt(customerPhone),
            quantity,
            whatsappOptIn: false,
            status: 'UNFULFILLED',
            paymentOption,
            totalAmount,
            depositAmount: finalDepositAmount,
            remainingBalance: finalRemainingBalance,
            paymentStatus: finalPaymentStatus,
            paymentLink,
            currency: order.currency || 'INR',
          },
          update: {
            orderNumber,
            productTitle: itemTitle,
            variantTitle: variantTitle,
            customerName: safeEncrypt(customerName),
            customerEmail: safeEncrypt(customerEmail),
            customerPhone: safeEncrypt(customerPhone),
            quantity,
            paymentOption,
            totalAmount,
            depositAmount: finalDepositAmount,
            remainingBalance: finalRemainingBalance,
            paymentStatus: finalPaymentStatus,
            paymentLink,
            currency: order.currency || 'INR',
          },
        });

        // 1b. Create in-app notification for merchant with persistent deduplication
        await PreorderNotificationService.notifyNewPreorder({
          storeId: store.id,
          orderNumber,
          productTitle: itemTitle,
          variantTitle,
          quantity,
          paymentOption,
          depositAmount: finalDepositAmount,
          totalAmount,
          remainingBalance: finalRemainingBalance,
          customerName,
          customerEmail,
          paymentStatus: finalPaymentStatus,
          productId: String(item.product_id || ''),
        });

        // Notify awaiting stock if order was created with status UNFULFILLED
        await PreorderNotificationService.notifyAwaitingStock({
          storeId: store.id,
          orderNumber,
          productTitle: itemTitle,
          variantTitle,
          quantity,
          productId: String(item.product_id || ''),
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
            price: `₹${finalDepositAmount.toFixed(2)}`,
            imageUrl: itemImageUrl,
            storeName: storeDisplayName,
            productUrl: `https://${store.shopDomain}`,
            paymentOption,
            depositAmount: finalDepositAmount,
            remainingBalance: finalRemainingBalance,
            totalAmount,
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
