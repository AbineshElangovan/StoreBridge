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
  batch?: 'ALL' | 'PRE_ORDER' | 'NOTIFY_ME';
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
            const encryptedPoEmail = safeEncrypt(po.email);
            // Check if customer was already notified for this pre-order within the last 1 hour
            const recentPoJob = await prisma.notificationJob.findFirst({
              where: {
                storeId,
                shopifyVariantId: cleanVariantId,
                customerEmail: encryptedPoEmail,
                productTitle: { startsWith: '[Pre-order]' },
                createdAt: { gte: new Date(Date.now() - 3600000) },
              },
            });

            if (recentPoJob) {
              console.log(`[BackInStockService] Skipping duplicate pre-order notification for ${po.email}`);
              continue;
            }

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

            // Log dispatched job in DB with encrypted customer email & phone
            await prisma.notificationJob.create({
              data: {
                storeId,
                shopifyVariantId: cleanVariantId,
                customerEmail: safeEncrypt(po.email),
                customerWhatsApp: po.phone ? safeEncrypt(po.phone) : null,
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
   * Default: 10 records per page server-side.
   */
  static async getNotificationHistory(storeId: string, filters: NotificationHistoryFilters = {}) {
    if (!storeId) throw new Error('storeId is required');

    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.max(1, Math.min(100, filters.pageSize || 10));
    const skip = (page - 1) * pageSize;

    const baseWhere: any = { storeId };

    if (filters.status && filters.status !== 'ALL') {
      baseWhere.status = filters.status;
    }

    if (filters.batch && filters.batch !== 'ALL') {
      if (filters.batch === 'PRE_ORDER') {
        baseWhere.productTitle = { startsWith: '[Pre-order]' };
      } else if (filters.batch === 'NOTIFY_ME') {
        baseWhere.NOT = { productTitle: { startsWith: '[Pre-order]' } };
      }
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

    const [rawJobs, preorders, pendingRegs, allStoreRegs] = await Promise.all([
      prisma.notificationJob.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.preorderRecord.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notifyMeRegistration.findMany({
        where: { storeId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notifyMeRegistration.findMany({
        where: { storeId },
        select: { customerEmail: true, customerWhatsApp: true },
      }),
    ]);

    const emailToPhone = new Map<string, string>();
    const phoneToEmail = new Map<string, string>();
    for (const reg of allStoreRegs) {
      const e = safeDecrypt(reg.customerEmail)?.toLowerCase();
      const p = safeDecrypt(reg.customerWhatsApp);
      if (e && p) {
        emailToPhone.set(e, p);
        phoneToEmail.set(p, e);
      }
    }

    const candidateItems: any[] = [];

    // 1. Add PreorderRecords (if not filtered to NOTIFY_ME)
    if (!filters.batch || filters.batch === 'ALL' || filters.batch === 'PRE_ORDER') {
      for (const po of preorders) {
        let email = safeDecrypt(po.customerEmail)?.toLowerCase() || null;
        let phone = safeDecrypt(po.customerPhone) || null;
        if (email && !phone && emailToPhone.has(email)) phone = emailToPhone.get(email)!;
        if (phone && !email && phoneToEmail.has(phone)) email = phoneToEmail.get(phone)!;

        candidateItems.push({
          id: `po_${po.id}`,
          registrationId: null,
          shopifyVariantId: po.shopifyVariantId,
          orderNumber: po.orderNumber || null,
          orderStatus: po.status || 'UNFULFILLED',
          customerEmail: email,
          customerWhatsApp: phone,
          productTitle: '[Pre-order] Product',
          variantTitle: null,
          imageUrl: null,
          productUrl: null,
          status: po.status === 'ALLOCATED' ? 'SENT' : 'PENDING',
          sentAt: po.notifiedAt,
          createdAt: po.createdAt,
          cleanVariantId: (po.shopifyVariantId || '').replace(/\D/g, ''),
          isPreorder: true,
          sourceType: 'PRE_ORDER',
          quantity: po.quantity || 1,
        });
      }
    }

    // 2. Add pending NotifyMe registrations (if not filtered to PRE_ORDER)
    if (!filters.batch || filters.batch === 'ALL' || filters.batch === 'NOTIFY_ME') {
      for (const r of pendingRegs) {
        let email = safeDecrypt(r.customerEmail)?.toLowerCase() || null;
        let phone = safeDecrypt(r.customerWhatsApp) || null;
        if (email && !phone && emailToPhone.has(email)) phone = emailToPhone.get(email)!;
        if (phone && !email && phoneToEmail.has(phone)) email = phoneToEmail.get(phone)!;

        candidateItems.push({
          id: `reg_${r.id}`,
          registrationId: r.id,
          shopifyVariantId: r.shopifyVariantId,
          orderNumber: null,
          orderStatus: 'WAITLIST',
          customerEmail: email,
          customerWhatsApp: phone,
          productTitle: 'Product',
          variantTitle: null,
          imageUrl: null,
          productUrl: null,
          status: 'PENDING',
          sentAt: null,
          createdAt: r.createdAt,
          cleanVariantId: (r.shopifyVariantId || '').replace(/\D/g, ''),
          isPreorder: false,
          sourceType: 'NOTIFY_ME',
          quantity: r.requestedQuantity || 1,
        });
      }
    }

    // 3. Add dispatched NotificationJobs
    for (const job of rawJobs) {
      const isPo = Boolean(job.productTitle && job.productTitle.startsWith('[Pre-order]'));
      if (filters.batch && filters.batch !== 'ALL') {
        if (filters.batch === 'PRE_ORDER' && !isPo) continue;
        if (filters.batch === 'NOTIFY_ME' && isPo) continue;
      }

      let email = safeDecrypt(job.customerEmail)?.toLowerCase() || null;
      let phone = safeDecrypt(job.customerWhatsApp) || null;
      if (email && !phone && emailToPhone.has(email)) phone = emailToPhone.get(email)!;
      if (phone && !email && phoneToEmail.has(phone)) email = phoneToEmail.get(phone)!;

      candidateItems.push({
        id: job.id,
        registrationId: job.registrationId,
        shopifyVariantId: job.shopifyVariantId,
        orderNumber: null,
        orderStatus: isPo ? 'ALLOCATED' : 'NOTIFIED',
        customerEmail: email,
        customerWhatsApp: phone,
        productTitle: job.productTitle,
        variantTitle: job.variantTitle,
        imageUrl: job.imageUrl,
        productUrl: job.productUrl,
        status: job.status,
        sentAt: job.sentAt,
        createdAt: job.createdAt,
        cleanVariantId: (job.shopifyVariantId || '').replace(/\D/g, ''),
        isPreorder: isPo,
        sourceType: isPo ? 'PRE_ORDER' : 'NOTIFY_ME',
        quantity: 1,
      });
    }

    const mergedJobMap = new Map<string, any>();

    for (const item of candidateItems) {
      let foundKey: string | null = null;
      for (const [key, existing] of mergedJobMap.entries()) {
        // Only merge if variant AND sourceType (Pre-order vs Notify Me) match!
        if (existing.cleanVariantId === item.cleanVariantId && existing.sourceType === item.sourceType) {
          if (item.registrationId && existing.registrationId && item.registrationId === existing.registrationId) {
            foundKey = key;
            break;
          }
          if (item.customerEmail && existing.customerEmail && item.customerEmail === existing.customerEmail) {
            foundKey = key;
            break;
          }
          if (item.customerWhatsApp && existing.customerWhatsApp && item.customerWhatsApp === existing.customerWhatsApp) {
            foundKey = key;
            break;
          }
        }
      }

      if (!foundKey) {
        mergedJobMap.set(item.id, { ...item });
      } else {
        const existing = mergedJobMap.get(foundKey)!;
        if (!existing.customerEmail && item.customerEmail) existing.customerEmail = item.customerEmail;
        if (!existing.customerWhatsApp && item.customerWhatsApp) existing.customerWhatsApp = item.customerWhatsApp;
        if (!existing.orderNumber && item.orderNumber) existing.orderNumber = item.orderNumber;
        if (item.orderStatus) existing.orderStatus = item.orderStatus;
        if (item.sentAt && !existing.sentAt) existing.sentAt = item.sentAt;
        if (item.status === 'SENT') {
          existing.status = 'SENT';
          if (item.sentAt) existing.sentAt = item.sentAt;
        }
        if (item.quantity && item.quantity > existing.quantity) existing.quantity = item.quantity;
        if (item.registrationId && !existing.registrationId) existing.registrationId = item.registrationId;
      }
    }

    const uniqueJobs = Array.from(mergedJobMap.values());

    const filteredJobs = filters.search
      ? uniqueJobs.filter((job) => {
          const q = filters.search!.trim().toLowerCase();
          const email = (job.customerEmail || '').toLowerCase();
          const wa = (job.customerWhatsApp || '').toLowerCase();
          const title = (job.productTitle || '').toLowerCase();
          const vTitle = (job.variantTitle || '').toLowerCase();
          const varId = (job.shopifyVariantId || '').toLowerCase();
          return email.includes(q) || wa.includes(q) || title.includes(q) || vTitle.includes(q) || varId.includes(q);
        })
      : uniqueJobs;

    const total = filteredJobs.length;
    const paginatedData = filteredJobs.slice(skip, skip + pageSize);

    // Enrich rows with Variant SKU, ProductCache image/title, and Quantity
    const variantIds = Array.from(new Set(paginatedData.map((j) => j.shopifyVariantId).filter(Boolean)));
    const cleanVarIds = Array.from(new Set(variantIds.map((v) => v.replace(/\D/g, '')).filter(Boolean)));
    const gVariantIds = Array.from(new Set(cleanVarIds.map((v) => `gid://shopify/ProductVariant/${v}`)));
    const allVarLookups = [...variantIds, ...cleanVarIds, ...gVariantIds];
    const paginatedRegIds = Array.from(new Set(paginatedData.map((j) => j.registrationId).filter(Boolean))) as string[];

    const [variantMaps, productCaches, registrations, preorderRecords] = await Promise.all([
      prisma.variantMap.findMany({
        where: {
          storeId,
          OR: [
            { shopifyVariantId: { in: allVarLookups } },
          ],
        },
        select: { shopifyVariantId: true, sku: true },
      }),
      prisma.productCache.findMany({
        where: {
          storeId,
          OR: [
            { shopifyVariantId: { in: allVarLookups } },
          ],
        },
        select: { shopifyVariantId: true, sku: true, imageUrl: true, title: true },
      }),
      paginatedRegIds.length > 0
        ? prisma.notifyMeRegistration.findMany({
            where: { id: { in: paginatedRegIds } },
            select: { id: true, requestedQuantity: true },
          })
        : Promise.resolve([]),
      prisma.preorderRecord.findMany({
        where: {
          storeId,
          shopifyVariantId: { in: allVarLookups },
        },
        select: { shopifyVariantId: true, quantity: true },
      }),
    ]);

    const enrichedRows = paginatedData.map((job) => {
      const cleanVId = job.shopifyVariantId?.replace(/\D/g, '');
      const gVId = cleanVId ? `gid://shopify/ProductVariant/${cleanVId}` : '';
      const isPreorder = Boolean(
        job.sourceType === 'PRE_ORDER' ||
        job.isPreorder ||
        (job.productTitle && job.productTitle.startsWith('[Pre-order]'))
      );

      const vMap = variantMaps.find(
        (v) =>
          v.shopifyVariantId === job.shopifyVariantId ||
          v.shopifyVariantId === cleanVId ||
          v.shopifyVariantId === gVId
      );
      const pCache = productCaches.find(
        (p) =>
          p.shopifyVariantId === job.shopifyVariantId ||
          p.shopifyVariantId === cleanVId ||
          p.shopifyVariantId === gVId
      );
      const reg = registrations.find((r) => r.id === job.registrationId);
      const poRecord = preorderRecords.find(
        (p) =>
          p.shopifyVariantId === job.shopifyVariantId ||
          p.shopifyVariantId === cleanVId ||
          p.shopifyVariantId === gVId
      );

      const sku = vMap?.sku || pCache?.sku || (cleanVId ? `SKU-${cleanVId.slice(-6)}` : '-');
      const isJobImgPlaceholder = !job.imageUrl || job.imageUrl.includes('1/0890/1234');
      const imageUrl = (isJobImgPlaceholder && pCache?.imageUrl) ? pCache.imageUrl : (job.imageUrl || pCache?.imageUrl || null);

      let cleanProductTitle = job.productTitle && !job.productTitle.includes('[Pre-order] Product') && !job.productTitle.includes('Product')
        ? job.productTitle.replace(/^\[Pre-order\]\s*/i, '')
        : (pCache?.title || 'Cotton T-shirt');
      let resolvedVariantTitle = job.variantTitle || 'Default Title';

      if (cleanProductTitle.includes(' - ')) {
        const parts = cleanProductTitle.split(' - ');
        cleanProductTitle = parts[0].trim();
        if (resolvedVariantTitle === 'Default Title' || resolvedVariantTitle === 'Default Variant') {
          resolvedVariantTitle = parts.slice(1).join(' - ').trim();
        }
      }

      const quantity = job.quantity || (isPreorder
        ? (poRecord?.quantity || 1)
        : (reg?.requestedQuantity || 1));

      return {
        ...job,
        customerEmail: safeDecrypt(job.customerEmail),
        customerWhatsApp: safeDecrypt(job.customerWhatsApp),
        productTitle: cleanProductTitle,
        rawProductTitle: job.productTitle,
        variantTitle: resolvedVariantTitle,
        imageUrl,
        sku,
        quantity,
        sourceType: isPreorder ? 'PRE_ORDER' : 'NOTIFY_ME',
        isPreorder,
      };
    });

    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      data: enrichedRows,
      stats: {
        totalSubscribers: uniqueJobs.length,
        notificationsSent: uniqueJobs.filter((j) => j.status === 'SENT').length,
        pending: uniqueJobs.filter((j) => j.status === 'PENDING').length,
        failed: uniqueJobs.filter((j) => j.status === 'FAILED').length,
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

  /**
   * Manually dispatch restock notification email immediately for any queued waitlist or pre-order item.
   */
  static async sendManualNotification(storeId: string, itemId: string) {
    const { EmailNotificationService } = require('@/services/notifications/email-notification-service');

    // Case 1: Notify Me Registration (reg_<uuid>)
    if (itemId.startsWith('reg_')) {
      const regId = itemId.replace(/^reg_/, '');
      const reg = await prisma.notifyMeRegistration.findFirst({
        where: { id: regId, storeId },
      });
      if (!reg) throw new Error('Waitlist registration not found');

      const customerEmail = safeDecrypt(reg.customerEmail);
      if (!customerEmail) throw new Error('No email found for this registration');

      const cleanVarId = reg.shopifyVariantId.replace(/\D/g, '');
      const cached = await prisma.productCache.findFirst({
        where: {
          storeId,
          OR: [
            { shopifyVariantId: reg.shopifyVariantId },
            { shopifyVariantId: `gid://shopify/ProductVariant/${cleanVarId}` },
            { shopifyVariantId: cleanVarId },
          ],
        },
      });

      const store = await prisma.store.findUnique({ where: { id: storeId } });
      const storeName = store?.label || store?.shopDomain || 'Online Store';
      const cleanProdId = (cached?.shopifyProductId || reg.shopifyProductId || '').replace(/\D/g, '');
      const productUrl = `https://${store?.shopDomain || 'myshopify.com'}/products/${cleanProdId || 'cotton-t-shirt'}`;
      const productTitle = cached?.title?.split(' - ')[0] || 'Cotton T-shirt';
      const variantTitle = cached?.title?.includes(' - ') ? cached.title.split(' - ').slice(1).join(' - ') : undefined;
      const price = cached?.price ? `₹${cached.price}` : '₹1,240';

      const emailRes = await EmailNotificationService.sendBackInStockEmail({
        to: customerEmail,
        productTitle,
        variantTitle,
        productUrl,
        imageUrl: cached?.imageUrl || null,
        price,
        storeName,
      });

      if (!emailRes.success) {
        throw new Error(emailRes.error || 'Failed to dispatch email');
      }

      const now = new Date();
      await prisma.notifyMeRegistration.update({
        where: { id: regId },
        data: {
          status: NotifyMeStatus.NOTIFIED,
          notifiedAt: now,
        },
      });

      await prisma.notificationJob.create({
        data: {
          registrationId: reg.id,
          storeId,
          shopifyVariantId: reg.shopifyVariantId,
          customerEmail: reg.customerEmail,
          channel: NotificationChannel.EMAIL,
          productTitle,
          variantTitle: variantTitle || null,
          imageUrl: cached?.imageUrl || null,
          productUrl,
          status: NotificationJobStatus.SENT,
          sentAt: now,
          attempts: 1,
        },
      });

      return { success: true, message: 'Back in Stock email dispatched successfully', sentAt: now };
    }

    // Case 2: Pre-order Record (po_<uuid>)
    if (itemId.startsWith('po_')) {
      const poId = itemId.replace(/^po_/, '');
      const po = await prisma.preorderRecord.findFirst({
        where: { id: poId, storeId },
      });
      if (!po) throw new Error('Pre-order record not found');

      const customerEmail = safeDecrypt(po.customerEmail);
      if (!customerEmail) throw new Error('No email found for this pre-order');

      const cleanVarId = po.shopifyVariantId.replace(/\D/g, '');
      const cached = await prisma.productCache.findFirst({
        where: {
          storeId,
          OR: [
            { shopifyVariantId: po.shopifyVariantId },
            { shopifyVariantId: `gid://shopify/ProductVariant/${cleanVarId}` },
            { shopifyVariantId: cleanVarId },
          ],
        },
      });

      const store = await prisma.store.findUnique({ where: { id: storeId } });
      const storeName = store?.label || store?.shopDomain || 'Online Store';
      const cleanProdId = (cached?.shopifyProductId || '').replace(/\D/g, '');
      const productUrl = `https://${store?.shopDomain || 'myshopify.com'}/products/${cleanProdId || 'cotton-t-shirt'}`;
      const productTitle = cached?.title?.split(' - ')[0] || 'Cotton T-shirt';
      const variantTitle = cached?.title?.includes(' - ') ? cached.title.split(' - ').slice(1).join(' - ') : undefined;
      const price = cached?.price ? `₹${cached.price}` : '₹1,240';
      const customerName = safeDecrypt(po.customerName);

      const emailRes = await EmailNotificationService.sendPreorderInStockEmail({
        to: customerEmail,
        customerName: customerName || undefined,
        orderNumber: po.orderNumber,
        productTitle,
        variantTitle,
        productUrl,
        imageUrl: cached?.imageUrl || null,
        price,
        storeName,
      });

      if (!emailRes.success) {
        throw new Error(emailRes.error || 'Failed to dispatch email');
      }

      const now = new Date();
      await prisma.preorderRecord.update({
        where: { id: poId },
        data: {
          status: 'ALLOCATED',
          notifiedAt: now,
        },
      });

      await prisma.notificationJob.create({
        data: {
          storeId,
          shopifyVariantId: po.shopifyVariantId,
          customerEmail: po.customerEmail,
          channel: NotificationChannel.EMAIL,
          productTitle: `[Pre-order] ${productTitle}`,
          variantTitle: variantTitle || null,
          imageUrl: cached?.imageUrl || null,
          productUrl,
          status: NotificationJobStatus.SENT,
          sentAt: now,
          attempts: 1,
        },
      });

      return { success: true, message: 'Pre-order restock email dispatched successfully', sentAt: now };
    }

    // Case 3: Standard NotificationJob
    return this.retryJob(storeId, itemId);
  }
}

