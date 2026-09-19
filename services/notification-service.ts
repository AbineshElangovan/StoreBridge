import { prisma } from '@/lib/db/prisma';
import { NotificationType } from '@prisma/client';

export interface CreateNotificationParams {
  recipientStoreId: string;
  type: NotificationType;
  title: string;
  message: string;
  productId?: string | null;
  productTitle?: string | null;
  sourceStoreId?: string | null;
  targetStoreId?: string | null;
  metadata?: Record<string, any> | null;
}

export interface NotificationQueryOptions {
  type?: string;
  status?: 'unread' | 'read' | 'all';
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Main backend service for handling persistent store notifications.
 */
export async function createNotification(params: CreateNotificationParams) {
  const {
    recipientStoreId,
    type,
    title,
    message,
    productId,
    productTitle,
    sourceStoreId,
    targetStoreId,
    metadata,
  } = params;

  if (!recipientStoreId) {
    console.warn('[NotificationService] Missing recipientStoreId, skipping notification.');
    return null;
  }

  try {
    // 1. Fetch recipient store & settings
    const store = await prisma.store.findUnique({
      where: { id: recipientStoreId },
      include: { storeSettings: true },
    });

    if (!store || !store.isActive) {
      console.log(`[NotificationService] Store ${recipientStoreId} not found or inactive. Skipping.`);
      return null;
    }

    // 2. Check store settings (Backend level suppression)
    const settings = store.storeSettings;
    if (settings) {
      switch (type) {
        case 'LOW_STOCK':
        case 'OUT_OF_STOCK':
        case 'STOCKOUT_RISK':
          if (settings.notifyLowStock === false) return null;
          break;
        case 'INVENTORY_UPDATE':
          if (settings.notifyInventoryUpdate === false) return null;
          break;
        case 'PRICE_UPDATE':
          if (settings.notifyPriceUpdate === false) return null;
          break;
        case 'SYNC_UPDATE':
          if (settings.notifySyncUpdate === false) return null;
          break;
        case 'SYNC_FAILURE':
          if (settings.notifySyncFailure === false) return null;
          break;
        case 'CONNECTED_STORE_UPDATE':
        case 'PRODUCT_UPDATED':
          if (settings.notifyStoreUpdate === false) return null;
          break;
      }
    }

    // 3. Enforce Multi-Store Rules
    // Check if store is Standalone (not master and has no store connections)
    const connectionCount = await prisma.storeConnection.count({
      where: {
        OR: [{ sourceStoreId: store.id }, { targetStoreId: store.id }],
      },
    });
    const isStandalone = !store.isMaster && connectionCount === 0;

    // Standalone stores cannot receive CONNECTED_STORE_UPDATE
    if (isStandalone && type === 'CONNECTED_STORE_UPDATE') {
      console.log(`[NotificationService] Standalone store ${store.id} cannot receive CONNECTED_STORE_UPDATE. Skipping.`);
      return null;
    }

    // 4. Anti-Spam De-duplication for ALL notification types (1 minute window for exact message, 10 min for product)
    const cleanProductId = productId ? productId.replace(/^gid:\/\/shopify\/(Product|Variant)\//, '').trim() : null;

    const recentDuplicate = await prisma.notification.findFirst({
      where: {
        recipientStoreId,
        type,
        title,
        OR: [
          { message },
          ...(cleanProductId ? [
            { productId: cleanProductId },
            { productId: `gid://shopify/Product/${cleanProductId}` }
          ] : []),
          ...(productTitle ? [{ productTitle }] : [])
        ],
        createdAt: {
          gte: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes anti-spam window
        },
      },
    });

    if (recentDuplicate) {
      console.log(`[NotificationService] Duplicate notification (${type} - ${title}) already exists for store ${recipientStoreId}. Skipping.`);
      return recentDuplicate;
    }

    // 5. Create notification record
    let notification: any = null;
    const db = prisma as any;
    if (db.notification && typeof db.notification.create === 'function') {
      notification = await db.notification.create({
        data: {
          recipientStoreId,
          type,
          title,
          message,
          productId: productId || null,
          productTitle: productTitle || null,
          sourceStoreId: sourceStoreId || null,
          targetStoreId: targetStoreId || null,
          metadata: metadata ? metadata : undefined,
        },
      });
    } else {
      // Raw SQL fallback if Prisma client model delegate is missing or uninitialized
      const safeTitle = (title || '').replace(/'/g, "''");
      const safeMessage = (message || '').replace(/'/g, "''");
      const safeProductTitle = productTitle ? `'${productTitle.replace(/'/g, "''")}'` : 'NULL';
      const safeProductId = productId ? `'${productId}'` : 'NULL';
      const safeSourceStoreId = sourceStoreId ? `'${sourceStoreId}'` : 'NULL';
      const safeTargetStoreId = targetStoreId ? `'${targetStoreId}'` : 'NULL';

      await prisma.$executeRawUnsafe(`
        INSERT INTO "notifications" ("id", "recipientStoreId", "type", "title", "message", "productId", "productTitle", "sourceStoreId", "targetStoreId", "isRead", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(),
          '${recipientStoreId}',
          '${type}'::"NotificationType",
          '${safeTitle}',
          '${safeMessage}',
          ${safeProductId},
          ${safeProductTitle},
          ${safeSourceStoreId},
          ${safeTargetStoreId},
          false,
          NOW(),
          NOW()
        );
      `);
      notification = { recipientStoreId, type, title, message };
    }

    console.log(`[NotificationService] Created notification (${type}) for store ${recipientStoreId}`);
    return notification;
  } catch (error) {
    console.error(`[NotificationService] Error creating notification:`, error);
    return null;
  }
}

/**
 * Fetch notifications for a recipient store with pagination and filtering.
 */
export interface NotificationQueryOptions {
  type?: string;
  status?: 'unread' | 'read' | 'all';
  search?: string;
  storeIdFilter?: string;
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Fetch notifications for a recipient store with pagination and filtering.
 */
export async function getNotifications(recipientStoreId: string, options: NotificationQueryOptions = {}) {
  const { 
    type, 
    status = 'all', 
    search, 
    storeIdFilter, 
    page = 1,
    limit = 15 
  } = options;

  const pageNum = Math.max(1, page);
  const pageSize = Math.max(1, limit);
  const calculatedOffset = (pageNum - 1) * pageSize;

  // 1. Check store role (Master, Connected / Sub-store, Standalone)
  const currentStore = await prisma.store.findUnique({
    where: { id: recipientStoreId },
    select: { id: true, isMaster: true },
  });

  const connections = await prisma.storeConnection.findMany({
    where: {
      OR: [
        { sourceStoreId: recipientStoreId },
        { targetStoreId: recipientStoreId },
      ],
    },
  });

  const isMaster = currentStore?.isMaster || false;
  let targetStoreIds: string[] = [recipientStoreId];
  const andConditions: any[] = [];

  // Role-Based Store Visibility Rules:
  // Each store (Master, Connected Store, Standalone) sees strictly its own inbox (recipientStoreId === loggedInStore.id).
  // Master Store can optionally filter by a specific connected store using storeIdFilter.
  if (isMaster) {
    targetStoreIds = Array.from(
      new Set([
        recipientStoreId,
        ...connections.map((c) => c.sourceStoreId),
        ...connections.map((c) => c.targetStoreId),
      ])
    );

    if (storeIdFilter && storeIdFilter !== 'ALL') {
      const activeFilterId = targetStoreIds.includes(storeIdFilter) ? storeIdFilter : recipientStoreId;
      andConditions.push({ recipientStoreId: activeFilterId });
    } else if (storeIdFilter === 'ALL') {
      andConditions.push({
        OR: [
          { recipientStoreId: { in: targetStoreIds } },
          { sourceStoreId: { in: targetStoreIds } },
          { targetStoreId: { in: targetStoreIds } },
        ]
      });
    } else {
      // Default view: strictly recipientStoreId for current store
      andConditions.push({ recipientStoreId });
    }
  } else {
    // For Connected Sub-Store and Standalone stores: strictly only their recipientStoreId inbox
    andConditions.push({ recipientStoreId });
  }

  if (type && type !== 'ALL') {
    if (type === 'LOW_STOCK') {
      andConditions.push({ type: { in: ['LOW_STOCK', 'STOCKOUT_RISK'] } });
    } else {
      andConditions.push({ type: type as NotificationType });
    }
  }

  if (status === 'unread') {
    andConditions.push({ isRead: false });
  } else if (status === 'read') {
    andConditions.push({ isRead: true });
  }

  if (search && search.trim() !== '') {
    const query = search.trim();
    andConditions.push({
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { message: { contains: query, mode: 'insensitive' } },
        { productTitle: { contains: query, mode: 'insensitive' } },
        { sku: { contains: query, mode: 'insensitive' } },
      ]
    });
  }

  const whereClause: any = andConditions.length > 0 ? { AND: andConditions } : {};

  // Unread count is strictly per recipient store so badges don't bleed across stores
  const storeUnreadWhere: any = {
    recipientStoreId,
    isRead: false,
  };

  const [rawNotifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: whereClause,
      include: {
        recipientStore: {
          select: { id: true, label: true, shopDomain: true, isMaster: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: calculatedOffset,
    }),
    prisma.notification.count({ where: whereClause }),
    prisma.notification.count({
      where: storeUnreadWhere,
    }),
  ]);

  // Enrich notifications with Product Image from ProductCache if not present in metadata
  const enrichedNotifications = await Promise.all(
    rawNotifications.map(async (item: any) => {
      let imageUrl = item.metadata?.imageUrl || null;
      let sku = item.metadata?.sku || null;

      if (!imageUrl && (item.productId || item.productTitle || item.sku)) {
        const cache = await prisma.productCache.findFirst({
          where: {
            OR: [
              ...(item.productId ? [{ shopifyProductId: `gid://shopify/Product/${item.productId}` }, { shopifyProductId: item.productId }] : []),
              ...(item.productTitle ? [{ title: item.productTitle }] : []),
              ...(item.sku ? [{ sku: item.sku }] : []),
            ],
            imageUrl: { not: null },
          },
          select: { imageUrl: true, sku: true }
        });

        if (cache) {
          imageUrl = cache.imageUrl || null;
          sku = sku || cache.sku || null;
        }
      }

      return {
        ...item,
        imageUrl,
        sku,
      };
    })
  );

  // Deduplicate identical notifications before returning to UI
  const uniqueNotifications: typeof enrichedNotifications = [];
  const seenKeys = new Set<string>();

  for (const notif of enrichedNotifications) {
    const timeBucket = Math.floor(new Date(notif.createdAt).getTime() / (60 * 1000));
    const key = `${notif.recipientStoreId}_${notif.type}_${notif.title}_${notif.message}_${timeBucket}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueNotifications.push(notif);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    notifications: uniqueNotifications,
    total: uniqueNotifications.length,
    page: pageNum,
    limit: pageSize,
    totalPages,
    unreadCount,
  };
}

/**
 * Helper to get allowed store IDs based on role (Master gets network, Connected/Standalone gets own).
 */
async function getTargetStoreIds(storeId: string): Promise<string[]> {
  const currentStore = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, isMaster: true },
  });

  if (!currentStore || !currentStore.isMaster) {
    return [storeId];
  }

  const connections = await prisma.storeConnection.findMany({
    where: {
      OR: [
        { sourceStoreId: storeId },
        { targetStoreId: storeId },
      ],
    },
  });

  return Array.from(
    new Set([
      storeId,
      ...connections.map((c) => c.sourceStoreId),
      ...connections.map((c) => c.targetStoreId),
    ])
  );
}

/**
 * Mark a single notification as read strictly for the recipient store.
 */
export async function markAsRead(recipientStoreId: string, notificationId: string) {
  try {
    return await prisma.notification.updateMany({
      where: {
        id: notificationId,
        recipientStoreId,
      },
      data: {
        isRead: true,
      },
    });
  } catch (error) {
    console.error(`[NotificationService] Error marking notification read:`, error);
    throw error;
  }
}

/**
 * Mark all notifications as read strictly for the given store's recipient inbox.
 */
export async function markAllAsRead(recipientStoreId: string) {
  try {
    return await prisma.notification.updateMany({
      where: {
        recipientStoreId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });
  } catch (error) {
    console.error(`[NotificationService] Error marking all notifications read:`, error);
    throw error;
  }
}

/**
 * Delete a single notification strictly for the recipient store.
 */
export async function deleteNotification(recipientStoreId: string, notificationId: string) {
  try {
    return await prisma.notification.deleteMany({
      where: {
        id: notificationId,
        recipientStoreId,
      },
    });
  } catch (error) {
    console.error(`[NotificationService] Error deleting notification:`, error);
    throw error;
  }
}

/**
 * Delete all notifications strictly for the given store's recipient inbox.
 */
export async function deleteAllNotifications(recipientStoreId: string) {
  try {
    return await prisma.notification.deleteMany({
      where: {
        recipientStoreId,
      },
    });
  } catch (error) {
    console.error(`[NotificationService] Error deleting all notifications:`, error);
    throw error;
  }
}
