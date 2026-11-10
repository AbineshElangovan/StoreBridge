import { NextRequest, NextResponse } from 'next/server';
import { authenticate, handleApiError } from '@/lib/shopify/authenticate';
import { WishlistService } from '@/services/wishlist/wishlist-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/wishlist
 * Fetches all wishlist items for the authenticated store.
 */
export async function GET(req: NextRequest) {
  try {
    const { store } = await authenticate(req);

    const items = await WishlistService.getWishlistItems(store.id);

    return NextResponse.json(
      {
        success: true,
        items,
        count: items.length,
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

/**
 * POST /api/wishlist
 * Toggles or adds a product to the wishlist.
 */
export async function POST(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    const body = await req.json();

    const {
      action = 'toggle',
      shopifyProductId,
      shopifyVariantId,
      productTitle,
      variantTitle,
      sku,
      price,
      imageUrl,
      inventoryQuantity,
      note,
    } = body;

    if (!shopifyProductId || !productTitle) {
      return NextResponse.json(
        { success: false, error: 'shopifyProductId and productTitle are required' },
        { status: 400 }
      );
    }

    const payload = {
      shopifyProductId: String(shopifyProductId),
      shopifyVariantId: shopifyVariantId ? String(shopifyVariantId) : null,
      productTitle: String(productTitle),
      variantTitle: variantTitle ? String(variantTitle) : null,
      sku: sku ? String(sku) : null,
      price: price !== undefined ? Number(price) : 0.0,
      imageUrl: imageUrl ? String(imageUrl) : null,
      inventoryQuantity: inventoryQuantity !== undefined ? Number(inventoryQuantity) : 0,
      note: note ? String(note) : null,
    };

    if (action === 'add') {
      const item = await WishlistService.addToWishlist(store.id, store.shopDomain, payload);
      return NextResponse.json({ success: true, wishlisted: true, item });
    }

    // Default to toggle
    const result = await WishlistService.toggleWishlist(store.id, store.shopDomain, payload);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return handleApiError(err);
  }
}

/**
 * DELETE /api/wishlist
 * Removes an item from the wishlist.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    const searchParams = req.nextUrl.searchParams;
    let id = searchParams.get('id');

    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body?.id;
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Wishlist item id is required' },
        { status: 400 }
      );
    }

    const deleted = await WishlistService.removeFromWishlist(store.id, store.shopDomain, id);

    return NextResponse.json({
      success: true,
      removed: Boolean(deleted),
    });
  } catch (err: any) {
    return handleApiError(err);
  }
}

