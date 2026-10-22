import { NextRequest, NextResponse } from 'next/server';
import { authenticate, handleApiError } from '@/lib/shopify/authenticate';
import { BackInStockService } from '@/services/back-in-stock/back-in-stock-service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ActionSchema = z.object({
  action: z.enum(['retry', 'sendNow']),
  jobId: z.string().optional(),
  itemId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    const searchParams = req.nextUrl.searchParams;

    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const status = (searchParams.get('status') || 'ALL') as any;
    const channel = (searchParams.get('channel') || 'ALL') as any;
    const batch = (searchParams.get('batch') || 'ALL') as any;
    const search = searchParams.get('search') || undefined;
    const productId = searchParams.get('productId') || undefined;
    const variantId = searchParams.get('variantId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const history = await BackInStockService.getNotificationHistory(store.id, {
      page,
      pageSize,
      status,
      channel,
      batch,
      search,
      productId,
      variantId,
      startDate,
      endDate,
    });

    return NextResponse.json({
      success: true,
      data: history.data,
      stats: history.stats,
      pagination: history.pagination,
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    const body = await req.json();

    const parsed = ActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const targetId = parsed.data.itemId || parsed.data.jobId;
    if (!targetId) {
      return NextResponse.json(
        { success: false, error: 'Target item ID is required' },
        { status: 400 }
      );
    }

    const result = await BackInStockService.sendManualNotification(store.id, targetId);

    return NextResponse.json({
      success: true,
      message: parsed.data.action === 'sendNow' ? 'Restock notification dispatched' : 'Notification retry initiated',
      result,
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}
