import { prisma } from '@/lib/db/prisma';
import {
  NotificationChannel,
  NotificationJobStatus,
  NotifyMeStatus,
} from '@prisma/client';
import { CustomerNotificationService } from '@/services/notifications';
import { safeEncrypt, safeDecrypt } from '@/lib/utils/encryption';

export interface BackInStockEventParams {
  storeId: string;
  shopifyProductId: string;
  shopifyVariantId: string;
  available: number;
  productTitle?: string;
  variantTitle?: string;
  imageUrl?: string | null;
  productUrl?: string | null;
}

export interface NotificationHistoryFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: NotificationJobStatus | 'ALL';
  channel?: NotificationChannel | 'ALL';
  productId?: string;
  variantId?: string;
  startDate?: string;
  endDate?: string;
}

export class BackInStockService {
  /**
   * Called when inventory transitions from 0 -> positive (> 0).
   * Identifies all PENDING registrations for the exact store and variant, creates NotificationJobs,
   * updates registrations to NOTIFIED, and dispatches the jobs.
   */
  static async processBackInStock(params: BackInStockEventParams) {
    const {
      storeId,
      shopifyProductId,
      shopifyVariantId,
      available,
      productTitle = 'Product',
      variantTitle,
      imageUrl,
      productUrl,
    } = params;

    if (!storeId || !shopifyVariantId || available <= 0) {
      return { triggered: false, reason: 'Invalid parameters or non-positive stock' };
    }

    // Standardize IDs
    const cleanVariantId = shopifyVariantId.replace(/^gid:\/\/shopify\/ProductVariant\//, '');
    const cleanProductId = shopifyProductId ? shopifyProductId.replace(/^gid:\/\/shopify\/Product\//, '') : '';

    console.log(`[BackInStockService] Checking restock for Store: ${storeId} | Variant: ${cleanVariantId} (New Stock: ${available})`);

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { shopDomain: true, label: true },
    });

    const storeDomain = store?.shopDomain || '';
    const finalProductUrl = productUrl || (storeDomain ? `https://${storeDomain}/products/${cleanProductId}` : '');

    // 1. PRE-ORDER PRIORITY CHECK
    // Calculate how many units are already committed to valid pre-orders
    const { committedPreorders, preorderOrders } = await BackInStockService.getPreorderCommitments(
      storeId,
      cleanVariantId
    );

    console.log(`[BackInStockService] Available New Stock: ${available} | Committed Pre-orders: ${committedPreorders}`);

    // 2. CONFIRMED PRE-ORDER STOCK ALLOCATION
    // IMPORTANT BUSINESS RULE: Send the pre-order message ONLY after confirming stock
    // has actually been allocated to that order, not merely because inventory increased!
    let stockRemainingToAllocate = available;
    const allocatedPreorders: Array<{
      orderId: string;
      orderNumber: string;
      customerName?: string | null;
      email?: string | null;
      phone?: string | null;
      quantity: number;
      whatsappOptIn: boolean;
    }> = [];

    for (const po of preorderOrders) {
      const neededQty = po.quantity || 1;
      if (stockRemainingToAllocate >= neededQty) {
        allocatedPreorders.push(po);
        stockRemainingToAllocate -= neededQty;
      }
    }

    console.log(`[BackInStockService] Allocated stock to ${allocatedPreorders.length} of ${preorderOrders.length} pre-order(s). Units allocated: ${available - stockRemainingToAllocate}`);

    // NOTIFY ONLY PRE-ORDER CUSTOMERS WHO RECEIVED CONFIRMED STOCK ALLOCATION
    if (allocatedPreorders.length > 0) {
      const { EmailNotificationService } = require('@/services/notifications/email-notification-service');

      for (const po of allocatedPreorders) {
        // Update PreorderRecord status in DB
        try {
          await (prisma as any).preorderRecord.updateMany({
            where: {
              storeId,
              shopifyOrderId: po.orderId,
              shopifyVariantId: cleanVariantId,
            },
            data: {
              status: 'ALLOCATED',
              notifiedAt: new Date(),
            },
          });
        } catch (statErr: any) {
          console.warn('[BackInStockService:PreorderRecord:StatusUpdateError]', statErr.message);
        }

        if (po.email) {
          try {
            await EmailNotificationService.sendPreorderInStockEmail({
              to: po.email,
              productTitle,
              variantTitle,
              productUrl: finalProductUrl,
              imageUrl: imageUrl || null,
              storeName: store?.label || store?.shopDomain || 'StoreBridge Store',
              customerName: po.customerName,
              orderNumber: po.orderNumber,
            });

            // Log dispatched job in DB with encrypted customer email
            await prisma.notificationJob.create({
              data: {
                storeId,
                shopifyVariantId: cleanVariantId,
                customerEmail: safeEncrypt(po.email),
                channel: NotificationChannel.EMAIL,
                productTitle: `[Pre-order] ${productTitle}`,
                variantTitle: variantTitle || null,
                imageUrl: imageUrl || null,
                productUrl: finalProductUrl,
                status: NotificationJobStatus.SENT,
                sentAt: new Date(),
              } as any,
            });
          } catch (poErr) {
            console.warn('[BackInStockService:PreorderEmail:Failed]', poErr);
          }
        }
      }
    }

    // 3. CALCULATE REMAINING UNCOMMITTED INVENTORY FOR NOTIFY ME
    const remainingAvailable = Math.max(0, stockRemainingToAllocate);

    // 4. FIND PENDING NOTIFY ME SUBSCRIBERS
    const pendingRegistrations = await prisma.notifyMeRegistration.findMany({
      where: {
        storeId,
        status: NotifyMeStatus.PENDING,
        OR: [
          { shopifyVariantId: cleanVariantId },
          { shopifyVariantId: `gid://shopify/ProductVariant/${cleanVariantId}` },
          { shopifyVariantId: shopifyVariantId },
        ],
      },
      orderBy: { createdAt: 'asc' }, // FIFO: First registered, first served
    });

    if (pendingRegistrations.length === 0) {
      console.log(`[BackInStockService] No pending Notify Me registrations for variant ${cleanVariantId}.`);
      return {
        triggered: true,
        committedPreorders,
        preordersNotified: allocatedPreorders.length,
        remainingAvailable,
        subscriberCount: 0,
      };
    }

    if (remainingAvailable <= 0) {
      console.log(`[BackInStockService] All new stock (${available}) is committed to pre-orders (${committedPreorders}). Remaining for Notify Me: 0. Keeping ${pendingRegistrations.length} registrations as PENDING.`);
      return {
        triggered: true,
        committedPreorders,
        preordersNotified: allocatedPreorders.length,
        remainingAvailable: 0,
        subscribersNotified: 0,
        subscribersPending: pendingRegistrations.length,
        message: 'All inventory allocated to pre-orders. Notify Me waitlist remains PENDING.',
      };
    }

    // 5. ALLOCATE NOTIFY ME SLOTS UP TO REMAINING INVENTORY CAPACITY
    let allocatedUnits = 0;
    const registrationsToNotify: typeof pendingRegistrations = [];

    for (const reg of pendingRegistrations) {
      const requested = reg.requestedQuantity || 1;
      if (allocatedUnits + requested <= remainingAvailable || registrationsToNotify.length === 0) {
        registrationsToNotify.push(reg);
        allocatedUnits += requested;
        if (allocatedUnits >= remainingAvailable) break;
      }
    }

    console.log(`[BackInStockService] Notifying ${registrationsToNotify.length} of ${pendingRegistrations.length} Notify Me subscribers based on ${remainingAvailable} remaining units.`);

    let createdJobsCount = 0;

    for (const reg of registrationsToNotify) {
      // Create Email job if customer opted in and has email
      if (reg.notifyByEmail && reg.customerEmail) {
        const recentJob = await prisma.notificationJob.findFirst({
          where: {
            registrationId: reg.id,
            channel: NotificationChannel.EMAIL,
            createdAt: { gte: new Date(Date.now() - 3600000) },
          },
        });

        if (!recentJob) {
          await prisma.notificationJob.create({
            data: {
              registrationId: reg.id,
              storeId,
              shopifyVariantId: cleanVariantId,
              customerEmail: reg.customerEmail,
              channel: NotificationChannel.EMAIL,
              productTitle,
              variantTitle: variantTitle || null,
              imageUrl: imageUrl || null,
              productUrl: finalProductUrl,
              status: NotificationJobStatus.PENDING,
            },
          });
          createdJobsCount++;
        }
      }

      // Mark registration as NOTIFIED
      await prisma.notifyMeRegistration.update({
        where: { id: reg.id },
        data: {
          status: NotifyMeStatus.NOTIFIED,
          notifiedAt: new Date(),
        },
      });
    }

    // 6. Process all pending jobs immediately
    const dispatchResult = await CustomerNotificationService.processPendingJobs(storeId);

    return {
      triggered: true,
      committedPreorders,
      preordersNotified: allocatedPreorders.length,
      remainingAvailable,
      subscriberCount: pendingRegistrations.length,
      subscribersNotified: registrationsToNotify.length,
      jobsCreated: createdJobsCount,
      dispatchResult,
    };
  }

  /**
   * Helper to determine committed pre-orders from Shopify unfulfilled orders.
   * Extracts customer name, order number, and explicit WhatsApp opt-in status.
   */
  static async getPreorderCommitments(storeId: string, variantId: string) {
    try {
      const cleanTargetVariantId = variantId.replace(/\D/g, '');

      // 1. Check local database for stored unfulfilled pre-orders first
      const dbPreorders: any[] = await (prisma as any).preorderRecord.findMany({
        where: {
          storeId,
          shopifyVariantId: cleanTargetVariantId,
          status: 'UNFULFILLED',
        },
        orderBy: { createdAt: 'asc' },
      });

      if (dbPreorders.length > 0) {
        let committedPreorders = 0;
        const preorderOrders = dbPreorders.map((po: any) => {
          const qty = po.quantity || 1;
          committedPreorders += qty;
          return {
            orderId: po.shopifyOrderId,
            orderNumber: po.orderNumber,
            customerName: safeDecrypt(po.customerName),
            email: safeDecrypt(po.customerEmail),
            phone: safeDecrypt(po.customerPhone),
            quantity: qty,
            whatsappOptIn: po.whatsappOptIn || false,
          };
        });

        console.log(`[BackInStockService:getPreorderCommitments] Found ${preorderOrders.length} unfulfilled pre-orders in DB (Total units: ${committedPreorders})`);
        return { committedPreorders, preorderOrders };
      }

      // 2. Fallback to Shopify GraphQL orders query
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { shopDomain: true, accessToken: true },
      });

      if (!store || !store.shopDomain) {
        return { committedPreorders: 0, preorderOrders: [] };
      }

      const { getAdminClient } = require('@/lib/shopify/admin');
      const client = await getAdminClient(store.shopDomain);

      const query = `
        query getUnfulfilledOrders {
          orders(first: 50, query: "fulfillment_status:unfulfilled") {
            edges {
              node {
                id
                name
                email
                phone
                customer {
                  firstName
                  lastName
                  phone
                }
                customAttributes {
                  key
                  value
                }
                lineItems(first: 50) {
                  edges {
                    node {
                      variant {
                        id
                      }
                      quantity
                      customAttributes {
                        key
                        value
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response: any = await client.request(query);
      const orders = response?.data?.orders?.edges || [];

      let committedPreorders = 0;
      const preorderOrders: Array<{
        orderId: string;
        orderNumber: string;
        customerName?: string | null;
        email?: string | null;
        phone?: string | null;
        quantity: number;
        whatsappOptIn: boolean;
      }> = [];

      for (const orderEdge of orders) {
        const orderNode = orderEdge.node;
        let orderPreorderQuantity = 0;

        for (const lineEdge of orderNode.lineItems?.edges || []) {
          const line = lineEdge.node;
          const lineVarId = line.variant?.id ? String(line.variant.id).replace(/\D/g, '') : '';

          if (lineVarId === cleanTargetVariantId) {
            const isPreorder = line.customAttributes?.some(
              (attr: any) => attr.key === '_preorder' && (attr.value === 'true' || attr.value === true)
            );

            if (isPreorder) {
              const qty = line.quantity || 1;
              orderPreorderQuantity += qty;
              committedPreorders += qty;
            }
          }
        }

        if (orderPreorderQuantity > 0 && (orderNode.email || orderNode.phone || orderNode.customer?.phone)) {
          // Check explicit opt-in for WhatsApp (compliance rule: checkout phone alone is not sufficient)
          const whatsappOptIn = Boolean(
            orderNode.customAttributes?.some(
              (attr: any) =>
                (attr.key === 'whatsapp_opt_in' || attr.key === 'whatsapp_notification') &&
                (attr.value === 'true' || attr.value === true)
            )
          );

          const customerFullName = orderNode.customer?.firstName
            ? `${orderNode.customer.firstName} ${orderNode.customer.lastName || ''}`.trim()
            : null;

          preorderOrders.push({
            orderId: orderNode.id,
            orderNumber: orderNode.name || orderNode.id.split('/').pop() || '#1234',
            customerName: customerFullName,
            email: orderNode.email || null,
            phone: orderNode.phone || orderNode.customer?.phone || null,
            quantity: orderPreorderQuantity,
            whatsappOptIn,
          });
        }
      }

      // Securely store pre-order customer details in DB with AES-256-GCM encryption
      for (const po of preorderOrders) {
        try {
          await (prisma as any).preorderRecord.upsert({
            where: {
              storeId_shopifyOrderId_shopifyVariantId: {
                storeId,
                shopifyOrderId: po.orderId,
                shopifyVariantId: cleanTargetVariantId,
              },
            },
            create: {
              storeId,
              shopifyOrderId: po.orderId,
              orderNumber: po.orderNumber,
              shopifyVariantId: cleanTargetVariantId,
              customerName: safeEncrypt(po.customerName),
              customerEmail: safeEncrypt(po.email),
              customerPhone: safeEncrypt(po.phone),
              quantity: po.quantity,
              whatsappOptIn: po.whatsappOptIn,
              status: 'UNFULFILLED',
            },
            update: {
              orderNumber: po.orderNumber,
              customerName: safeEncrypt(po.customerName),
              customerEmail: safeEncrypt(po.email),
              customerPhone: safeEncrypt(po.phone),
              quantity: po.quantity,
              whatsappOptIn: po.whatsappOptIn,
            },
          });
        } catch (poDbErr: any) {
          console.warn('[BackInStockService:PreorderRecord:SaveError]', poDbErr.message);
        }
      }

      return { committedPreorders, preorderOrders };
    } catch (err: any) {
      console.warn('[BackInStockService:getPreorderCommitments] Safe fallback - no orders found:', err.message);
      return { committedPreorders: 0, preorderOrders: [] };
    }
  }

  /**
   * Paginated notification history for StoreBridge Admin /back-in-stock
   * Default: 15 records per page server-side.
   */
  static async getNotificationHistory(storeId: string, filters: NotificationHistoryFilters = {}) {
    if (!storeId) throw new Error('storeId is required');

    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.max(1, Math.min(100, filters.pageSize || 15));
    const skip = (page - 1) * pageSize;

    const baseWhere: any = { storeId };

    if (filters.status && filters.status !== 'ALL') {
      baseWhere.status = filters.status;
    }

    if (filters.channel && filters.channel !== 'ALL') {
      baseWhere.channel = filters.channel;
    }

    if (filters.productId) {
      baseWhere.shopifyProductId = filters.productId;
    }

    if (filters.variantId) {
      baseWhere.shopifyVariantId = filters.variantId;
    }

    if (filters.startDate || filters.endDate) {
      baseWhere.createdAt = {};
      if (filters.startDate) baseWhere.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) baseWhere.createdAt.lte = new Date(filters.endDate);
    }

    const [totalSent, totalPending, totalFailed, totalSubscribers] = await Promise.all([
      prisma.notificationJob.count({ where: { storeId, status: NotificationJobStatus.SENT } }),
      prisma.notificationJob.count({ where: { storeId, status: NotificationJobStatus.PENDING } }),
      prisma.notificationJob.count({ where: { storeId, status: NotificationJobStatus.FAILED } }),
      prisma.notifyMeRegistration.count({ where: { storeId } }),
    ]);

    let total = 0;
    let paginatedData: any[] = [];

    if (filters.search) {
      const q = filters.search.trim().toLowerCase();
      const candidates = await prisma.notificationJob.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
      });

      const matched = candidates.filter((job) => {
        const email = (safeDecrypt(job.customerEmail) || '').toLowerCase();
        const wa = (safeDecrypt(job.customerWhatsApp) || '').toLowerCase();
        const title = (job.productTitle || '').toLowerCase();
        const vTitle = (job.variantTitle || '').toLowerCase();
        const varId = (job.shopifyVariantId || '').toLowerCase();
        return email.includes(q) || wa.includes(q) || title.includes(q) || vTitle.includes(q) || varId.includes(q);
      });

      total = matched.length;
      paginatedData = matched.slice(skip, skip + pageSize).map((job) => ({
        ...job,
        customerEmail: safeDecrypt(job.customerEmail),
        customerWhatsApp: safeDecrypt(job.customerWhatsApp),
      }));
    } else {
      const [count, rows] = await Promise.all([
        prisma.notificationJob.count({ where: baseWhere }),
        prisma.notificationJob.findMany({
          where: baseWhere,
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
        }),
      ]);

      total = count;
      paginatedData = rows.map((job) => ({
        ...job,
        customerEmail: safeDecrypt(job.customerEmail),
        customerWhatsApp: safeDecrypt(job.customerWhatsApp),
      }));
    }

    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      data: paginatedData,
      stats: {
        totalSubscribers,
        notificationsSent: totalSent,
        pending: totalPending,
        failed: totalFailed,
      },
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Retry a failed notification job.
   */
  static async retryJob(storeId: string, jobId: string) {
    const job = await prisma.notificationJob.findFirst({
      where: { id: jobId, storeId },
    });

    if (!job) throw new Error('Notification job not found');

    await prisma.notificationJob.update({
      where: { id: jobId },
      data: {
        status: NotificationJobStatus.PENDING,
        attempts: 0,
        lastError: null,
      },
    });

    return CustomerNotificationService.processPendingJobs(storeId, 1);
  }
}
