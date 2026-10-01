import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const storeIdsParam = req.nextUrl.searchParams.get('storeIds');
  const storeIds = storeIdsParam ? storeIdsParam.split(',').filter(id => id.trim() !== '') : [];

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
          // Controller might already be closed
        }
      };

      // 1. Initial connection message
      try {
        controller.enqueue(
          `event: connected\ndata: ${JSON.stringify({ message: "SSE Connected", storeIds })}\n\n`
        );
      } catch (err) {
        cleanup();
        return;
      }

      // 2. Poll Database every 6 seconds
      pollInterval = setInterval(async () => {
        if (isClosed || req.signal.aborted) {
          cleanup();
          return;
        }

        try {
          const newActivities = await prisma.activityLog.findMany({
            where: {
              ...(storeIds.length > 0 ? { storeId: { in: storeIds } } : {}),
              createdAt: { gt: lastCreatedAt }
            },
            include: {
              store: { select: { id: true, label: true, shopDomain: true, isMaster: true } }
            },
            orderBy: { createdAt: 'asc' },
            take: 20
          });

          if (newActivities.length > 0 && !isClosed) {
            lastCreatedAt = newActivities[newActivities.length - 1].createdAt;

            for (const activity of newActivities) {
              controller.enqueue(`event: new-activity\ndata: ${JSON.stringify(activity)}\n\n`);
            }
          }
        } catch (error) {
          // If sending fails or DB query fails, terminate this stream to prevent zombie polling
          cleanup();
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

      // 4. Recycle connection after 30 minutes safety cap
      maxLifetimeTimeout = setTimeout(() => {
        cleanup();
      }, 1800000);

      // 5. Cleanup on abort signal
      req.signal.addEventListener('abort', cleanup);
    }
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
