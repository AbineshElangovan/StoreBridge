import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { authenticate, handleApiError } from '@/lib/shopify/authenticate';

export async function PUT(req: NextRequest) {
  try {
    const { store: requestStore } = await authenticate(req);
    const body = await req.json();
    const { storeId } = body;

    if (!storeId) {
      return NextResponse.json({ success: false, error: 'storeId is required' }, { status: 400 });
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId }
    });

    if (!store) {
      return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Find all connected stores before deleting connections
      const relatedConnections = await tx.storeConnection.findMany({
        where: {
          OR: [
            { sourceStoreId: storeId },
            { targetStoreId: storeId }
          ]
        }
      });
      const otherStoreIds = relatedConnections.map((c: any) =>
        c.sourceStoreId === storeId ? c.targetStoreId : c.sourceStoreId
      );

      // Delete all connections where this store is either source or target
      await tx.storeConnection.deleteMany({
        where: {
          OR: [
            { sourceStoreId: storeId },
            { targetStoreId: storeId }
          ]
        }
      });

      // Update the store to no longer be master
      await tx.store.update({
        where: { id: storeId },
        data: { isMaster: false }
      });

      // If any previously connected stores have no remaining connections, ensure isMaster is false
      for (const otherId of otherStoreIds) {
        const remaining = await tx.storeConnection.count({
          where: {
            OR: [
              { sourceStoreId: otherId },
              { targetStoreId: otherId }
            ]
          }
        });
        if (remaining === 0) {
          await tx.store.update({
            where: { id: otherId },
            data: { isMaster: false }
          });
        }
      }
    });

    return NextResponse.json({ success: true, message: 'Store is now standalone.' });
  } catch (error: any) {
    console.error('[Standalone API] PUT error:', error);
    return handleApiError(error);
  }
}
