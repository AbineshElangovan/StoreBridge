import { NextRequest, NextResponse } from 'next/server';
import { authenticate, handleApiError } from '@/lib/shopify/authenticate';
import { WishlistService } from '@/services/wishlist/wishlist-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/wishlist/check?productIds=123,456
 * Returns status map for given product IDs.
 */
export async function GET(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    const searchParams = req.nextUrl.searchParams;
    const rawIds = searchParams.get('productIds') || searchParams.get('productId') || '';
    const productIds = rawIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (!productIds.length) {
      return NextResponse.json({ success: true, statusMap: {} });
    }

    const statusMap = await WishlistService.checkWishlistStatus(store.id, productIds);

    return NextResponse.json(
      {
        success: true,
        statusMap,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err: any) {
    return handleApiError(err);
  }
}

