import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  let shop = req.nextUrl.searchParams.get('shop') || req.headers.get('x-shopify-shop-domain');
  if (!shop && req.headers.get('referer')) {
    try {
      const refererUrl = new URL(req.headers.get('referer')!);
      shop = refererUrl.searchParams.get('shop');
    } catch (e) { }
  }

  let currentStore: any = null;
  if (shop) {
    const clean = shop.trim().toLowerCase();
    const prefix = clean.split('.')[0].replace(/^https?:\/\//, '');
    currentStore = await prisma.store.findFirst({
      where: {
        isActive: true,
        OR: [
          { shopDomain: clean },
          { shopDomain: { contains: prefix, mode: 'insensitive' } },
          { label: { contains: prefix, mode: 'insensitive' } },
          { id: clean },
        ],
      },
    });
  }

  if (!currentStore) {
    currentStore = await prisma.store.findFirst({
      where: { isMaster: true, isActive: true },
    });
  }

  const isMasterStore = currentStore?.isMaster || false;
  let targetStoreIds: string[] = currentStore ? [currentStore.id] : [];

  if (currentStore) {
    const connections = await prisma.storeConnection.findMany({
      where: {
        OR: [
          { sourceStoreId: currentStore.id },
          { targetStoreId: currentStore.id },
        ],
      },
    });

    if (isMasterStore) {
      targetStoreIds = Array.from(
        new Set([
          currentStore.id,
          ...connections.map((c) => c.sourceStoreId),
          ...connections.map((c) => c.targetStoreId),
        ])
      );
    } else {
      targetStoreIds = [currentStore.id];
    }
  }

  let lastCreatedAt = new Date();
  let isClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      let pollInterval: NodeJS.Timeout | null = null;
      let heartbeatInterval: NodeJS.Timeout | null = null;
      let maxLifetimeTimeout: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        if (pollInterval) clearInterval(pollInterval);
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        if (maxLifetimeTimeout) clearTimeout(maxLifetimeTimeout);
        try {
          controller.close();
        } catch (e) {
          // Ignored
        }
      };

      // 1. Initial connection message
      try {
        controller.enqueue(
          `event: connected\ndata: ${JSON.stringify({ message: "Notification SSE Connected", storeIds: targetStoreIds })}\n\n`
        );
      } catch (err) {
        cleanup();
        return;
      }

      // 2. Poll Database for newly created notifications every 6 seconds
      pollInterval = setInterval(async () => {
        if (isClosed || req.signal.aborted || !currentStore) {
          cleanup();
          return;
        }

        try {
          const notificationWhere: any = {
            createdAt: { gt: lastCreatedAt },
            ...(isMasterStore
              ? { recipientStoreId: { in: targetStoreIds } }
              : { recipientStoreId: currentStore.id }),
          };

          const newNotifications = await prisma.notification.findMany({
            where: notificationWhere,
            include: {
              recipientStore: {
                select: { id: true, label: true, shopDomain: true, isMaster: true },
              },
            },
            orderBy: { createdAt: 'asc' },
            take: 20
          });

          if (newNotifications.length > 0 && !isClosed) {
            lastCreatedAt = newNotifications[newNotifications.length - 1].createdAt;

            for (const notif of newNotifications) {
              controller.enqueue(`event: new-notification\ndata: ${JSON.stringify(notif)}\n\n`);
            }
          }
        } catch (error) {
          console.error('[NotificationStream] Transient poll error:', error);
          // Do not call cleanup() on transient DB poll error, keep connection alive
        }
      }, 6000);

      // 3. Heartbeat every 25 seconds
      heartbeatInterval = setInterval(() => {
        if (isClosed || req.signal.aborted) {
          cleanup();
          return;
        }
        try {
          controller.enqueue(`event: ping\ndata: {"message": "heartbeat"}\n\n`);
        } catch (e) {
          cleanup();
        }
      }, 25000);

      // 4. Recycle connection after 30 minutes safety cap so memory is freed
      maxLifetimeTimeout = setTimeout(() => {
        cleanup();
      }, 1800000);

      // 5. Cleanup when the client disconnects
      req.signal.addEventListener('abort', cleanup);
    },
    cancel() {
      // Called when the consumer cancels the stream
      isClosed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
