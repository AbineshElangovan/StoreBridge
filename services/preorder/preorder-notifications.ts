import { prisma } from '@/lib/db/prisma';
import { createNotification } from '@/services/notification-service';
import { NotificationType } from '@prisma/client';

export interface PreorderNotificationPayload {
  storeId: string;
  orderNumber: string;
  shopifyOrderId?: string | null;
  productTitle: string;
  variantTitle?: string | null;
  quantity?: number;
  paymentOption?: string | null;
  depositAmount?: number;
  totalAmount?: number;
  remainingBalance?: number;
  customerName?: string | null;
  customerEmail?: string | null;
  paymentStatus?: string | null;
  productId?: string | null;
}

/**
 * Service to handle persistent, store-isolated, strictly-once pre-order notifications
 * for the StoreBridge dashboard and notification center.
 */
export class PreorderNotificationService {
  /**
   * 1. Notify admin when a new pre-order is created.
   */
  static async notifyNewPreorder(payload: PreorderNotificationPayload) {
    const {
      storeId,
      orderNumber,
      productTitle,
      variantTitle,
      quantity = 1,
      paymentOption = 'FULL',
      depositAmount = 0,
      remainingBalance = 0,
      customerName,
      customerEmail,
      productId,
    } = payload;

    if (!storeId || !orderNumber) return null;

    const fullTitle = variantTitle ? `${productTitle} - ${variantTitle}` : productTitle;
    const title = `New Pre-order: ${orderNumber}`;

    // Prevent duplicate: check if notification already exists for this order
    const existing = await prisma.notification.findFirst({
      where: {
        recipientStoreId: storeId,
        title,
      },
    });

    if (existing) {
      return existing;
    }

    const customerDisplay = customerName || customerEmail || 'Customer';
    const paymentDesc = paymentOption === 'HALF'
      ? `Half Payment (Paid: ₹${depositAmount.toFixed(2)}, Due: ₹${remainingBalance.toFixed(2)})`
      : `Full Payment (Paid: ₹${depositAmount.toFixed(2)})`;

    const message = `${customerDisplay} placed a pre-order for ${quantity}x ${fullTitle} (${orderNumber}). ${paymentDesc}.`;

    return await createNotification({
      recipientStoreId: storeId,
      type: NotificationType.INVENTORY_UPDATE,
      title,
      message,
      productId: productId || null,
      productTitle: fullTitle,
      sourceStoreId: storeId,
      metadata: {
        eventType: 'PREORDER_CREATED',
        orderNumber,
        paymentOption,
        depositAmount,
        remainingBalance,
      },
    });
  }

  /**
   * 2. Notify admin when a pre-order is awaiting stock / requires replenishment.
   */
  static async notifyAwaitingStock(payload: PreorderNotificationPayload) {
    const {
      storeId,
      orderNumber,
      productTitle,
      variantTitle,
      quantity = 1,
      productId,
    } = payload;

    if (!storeId || !orderNumber) return null;

    const fullTitle = variantTitle ? `${productTitle} - ${variantTitle}` : productTitle;
    const title = `Pre-order Awaiting Stock: ${orderNumber}`;

    const existing = await prisma.notification.findFirst({
      where: {
        recipientStoreId: storeId,
        title,
      },
    });

    if (existing) {
      return existing;
    }

    const message = `Order ${orderNumber} (${quantity}x ${fullTitle}) has 0 inventory available and is awaiting stock arrival.`;

    return await createNotification({
      recipientStoreId: storeId,
      type: NotificationType.OUT_OF_STOCK,
      title,
      message,
      productId: productId || null,
      productTitle: fullTitle,
      sourceStoreId: storeId,
      metadata: {
        eventType: 'PREORDER_AWAITING_STOCK',
        orderNumber,
      },
    });
  }

  /**
   * 3. Notify admin when stock becomes available for a pre-order (Stock Allocated).
   */
  static async notifyStockAllocated(payload: PreorderNotificationPayload) {
    const {
      storeId,
      orderNumber,
      productTitle,
      variantTitle,
      quantity = 1,
      productId,
    } = payload;

    if (!storeId || !orderNumber) return null;

    const fullTitle = variantTitle ? `${productTitle} - ${variantTitle}` : productTitle;
    const title = `Stock Allocated: ${orderNumber}`;

    const existing = await prisma.notification.findFirst({
      where: {
        recipientStoreId: storeId,
        title,
      },
    });

    if (existing) {
      return existing;
    }

    const message = `Inventory has arrived! Stock was successfully allocated to pre-order ${orderNumber} (${quantity}x ${fullTitle}).`;

    return await createNotification({
      recipientStoreId: storeId,
      type: NotificationType.INVENTORY_UPDATE,
      title,
      message,
      productId: productId || null,
      productTitle: fullTitle,
      sourceStoreId: storeId,
      metadata: {
        eventType: 'PREORDER_STOCK_ALLOCATED',
        orderNumber,
      },
    });
  }

  /**
   * 4. Notify admin when a pre-order is ready for fulfillment.
   */
  static async notifyReadyForFulfillment(payload: PreorderNotificationPayload) {
    const {
      storeId,
      orderNumber,
      productTitle,
      variantTitle,
      paymentOption,
      paymentStatus,
      productId,
    } = payload;

    if (!storeId || !orderNumber) return null;

    const fullTitle = variantTitle ? `${productTitle} - ${variantTitle}` : productTitle;
    const title = `Pre-order Ready for Fulfillment: ${orderNumber}`;

    const existing = await prisma.notification.findFirst({
      where: {
        recipientStoreId: storeId,
        title,
      },
    });

    if (existing) {
      return existing;
    }

    const paymentText = paymentStatus === 'PAID'
      ? 'Fully Paid'
      : paymentOption === 'HALF'
      ? 'Deposit Received (Remaining Balance Due)'
      : 'Payment Confirmed';

    const message = `Pre-order ${orderNumber} (${fullTitle}) is ready for fulfillment (${paymentText}). Ready for dispatch in Shopify Admin.`;

    return await createNotification({
      recipientStoreId: storeId,
      type: NotificationType.INVENTORY_UPDATE,
      title,
      message,
      productId: productId || null,
      productTitle: fullTitle,
      sourceStoreId: storeId,
      metadata: {
        eventType: 'PREORDER_READY_FOR_FULFILLMENT',
        orderNumber,
        paymentStatus,
      },
    });
  }

  /**
   * 5. Notify admin when a pre-order is fulfilled or cancelled in Shopify.
   */
  static async notifyStatusChanged(
    payload: PreorderNotificationPayload & { newStatus: 'FULFILLED' | 'CANCELLED' | 'REFUNDED' }
  ) {
    const {
      storeId,
      orderNumber,
      productTitle,
      variantTitle,
      newStatus,
      productId,
    } = payload;

    if (!storeId || !orderNumber) return null;

    const fullTitle = variantTitle ? `${productTitle} - ${variantTitle}` : productTitle;
    const isFulfilled = newStatus === 'FULFILLED';
    const title = isFulfilled
      ? `Pre-order Fulfilled: ${orderNumber}`
      : `Pre-order Cancelled: ${orderNumber}`;

    const existing = await prisma.notification.findFirst({
      where: {
        recipientStoreId: storeId,
        title,
      },
    });

    if (existing) {
      return existing;
    }

    const message = isFulfilled
      ? `Pre-order ${orderNumber} for ${fullTitle} has been completely fulfilled.`
      : `Pre-order ${orderNumber} for ${fullTitle} has been cancelled or refunded.`;

    return await createNotification({
      recipientStoreId: storeId,
      type: isFulfilled ? NotificationType.INVENTORY_UPDATE : NotificationType.OUT_OF_STOCK,
      title,
      message,
      productId: productId || null,
      productTitle: fullTitle,
      sourceStoreId: storeId,
      metadata: {
        eventType: isFulfilled ? 'PREORDER_FULFILLED' : 'PREORDER_CANCELLED',
        orderNumber,
        newStatus,
      },
    });
  }
}
