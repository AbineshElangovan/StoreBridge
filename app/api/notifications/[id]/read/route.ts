import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/shopify/authenticate';
import { markAsRead, deleteNotification } from '@/services/notification-service';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { store } = await authenticate(req);
    const { id } = await params;

    await markAsRead(store.id, id);

    return NextResponse.json({ success: true, message: 'Notification marked as read' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { store } = await authenticate(req);
    const { id } = await params;

    await deleteNotification(store.id, id);

    return NextResponse.json({ success: true, message: 'Notification deleted' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
