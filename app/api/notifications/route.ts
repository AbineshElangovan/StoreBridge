import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/shopify/authenticate';
import { getNotifications, markAllAsRead, deleteAllNotifications, deleteNotification } from '@/services/notification-service';
import { cleanupExpiredActivityLogs } from '@/lib/services/activityRetention';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    cleanupExpiredActivityLogs().catch(() => {});
    const searchParams = req.nextUrl.searchParams;

    const type = searchParams.get('type') || undefined;
    const status = (searchParams.get('status') as 'unread' | 'read' | 'all') || 'all';
    const search = searchParams.get('search') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const storeIdFilter = searchParams.get('storeId') || undefined;

    let result = await getNotifications(store.id, {
      type,
      status,
      search,
      storeIdFilter,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 401 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    const body = await req.json();

    if (body.action === 'markAllRead') {
      await markAllAsRead(store.id);
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    const id = req.nextUrl.searchParams.get('id');

    if (id) {
      // Delete single notification
      await deleteNotification(store.id, id);
      return NextResponse.json({ success: true, message: 'Notification deleted successfully' });
    }

    // Delete all notifications
    await deleteAllNotifications(store.id);
    return NextResponse.json({ success: true, message: 'All notifications deleted successfully' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    const body = await req.json().catch(() => ({}));

    if (body.action === 'seed') {
      const { createNotification } = await import('@/services/notification-service');
      const sampleNotifications = [
        {
          type: 'LOW_STOCK' as const,
          title: 'Low Stock Alert',
          message: 'Classic Oxford Shoes has 2 units remaining (Threshold: 15)',
          productTitle: 'Classic Oxford Shoes',
        },
        {
          type: 'INVENTORY_UPDATE' as const,
          title: 'Product Sold',
          message: 'Product Sold: Leather Jacket - 1 item(s) sold (New stock: 8)',
          productTitle: 'Leather Jacket',
        },
        {
          type: 'PRODUCT_UPDATED' as const,
          title: 'Product Created',
          message: 'Product Silk Scarf was created successfully',
          productTitle: 'Silk Scarf',
        },
        {
          type: 'SYNC_UPDATE' as const,
          title: 'Sync Completed',
          message: 'Bulk inventory sync completed successfully across connected stores',
        },
      ];

      for (const item of sampleNotifications) {
        await createNotification({
          recipientStoreId: store.id,
          type: item.type,
          title: item.title,
          message: item.message,
          productTitle: item.productTitle,
        });
      }

      return NextResponse.json({ success: true, message: 'Sample notifications generated' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
