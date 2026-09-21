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

  const stream = new ReadableStream({
    start(controller) {
      // 1. Initial connection message
      controller.enqueue(
        `event: connected\ndata: ${JSON.stringify({ message: "Notification SSE Connected", storeIds: targetStoreIds })}\n\n`
      );

      // 2. Poll Database for newly created notifications every 5 seconds on the server
      const pollInterval = setInterval(async () => {
        try {
          const notificationWhere: any = {
            createdAt: { gt: lastCreatedAt },
            recipientStoreId: currentStore.id,
          };

          const newNotifications = await prisma.notification.findMany({
            where: notificationWhere,
            include: {
              recipientStore: {
                select: { id: true, label: true, shopDomain: true, isMaster: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          });

          if (newNotifications.length > 0) {
            lastCreatedAt = newNotifications[newNotifications.length - 1].createdAt;

            for (const notif of newNotifications) {
              controller.enqueue(`event: new-notification\ndata: ${JSON.stringify(notif)}\n\n`);
            }
          }
        } catch (error) {
          console.error('[Notification SSE Stream Error]:', error);
        }
      }, 5000);

      // 3. Heartbeat every 30 seconds to prevent connection timeouts
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(`event: ping\ndata: {"message": "heartbeat"}\n\n`);
        } catch (e) {
          // Ignored if stream is closed
        }
      }, 30000);

      // 4. Cleanup when the client disconnects
      req.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        controller.close();
      });
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
