import { NextRequest, NextResponse } from 'next/server';
import { authenticate, handleApiError } from '@/lib/shopify/authenticate';
import { BackInStockService } from '@/services/back-in-stock/back-in-stock-service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const RetryJobSchema = z.object({
  action: z.literal('retry'),
  jobId: z.string().uuid(),
});

export async function GET(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    const searchParams = req.nextUrl.searchParams;

    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '15', 10);
    const status = (searchParams.get('status') || 'ALL') as any;
    const channel = (searchParams.get('channel') || 'ALL') as any;
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

    const parsed = RetryJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await BackInStockService.retryJob(store.id, parsed.data.jobId);

    return NextResponse.json({
      success: true,
      message: 'Notification retry initiated',
      result,
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}
