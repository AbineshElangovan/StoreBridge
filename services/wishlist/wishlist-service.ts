import { prisma } from '@/lib/db/prisma';
import { logUserActivity } from '@/lib/activity/user-activity';

export interface AddWishlistItemInput {
  shopifyProductId: string;
  shopifyVariantId?: string | null;
  productTitle: string;
  variantTitle?: string | null;
  sku?: string | null;
  price?: number;
  imageUrl?: string | null;
  inventoryQuantity?: number;
  note?: string | null;
}

export class WishlistService {
  /**
   * Retrieves all wishlist items for a given store.
   */
  static async getWishlistItems(storeId: string) {
    if (!storeId) throw new Error('storeId is required');

    const items = await prisma.wishlistItem.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });

    return items;
  }

  /**
   * Gets the total count of wishlist items for a given store.
   */
  static async getWishlistCount(storeId: string): Promise<number> {
    if (!storeId) return 0;
    try {
      return await prisma.wishlistItem.count({
        where: { storeId },
      });
    } catch (err) {
      console.error('[WishlistService:getWishlistCount]', err);
      return 0;
    }
  }

  /**
   * Automatically deletes wishlist entries when a product is deleted from the catalog.
   */
  static async deleteByProduct(storeId: string, shopifyProductId: string) {
    if (!storeId || !shopifyProductId) return;
    const cleanId = String(shopifyProductId).replace(/^gid:\/\/shopify\/Product\//i, '');
    try {
      await prisma.wishlistItem.deleteMany({
        where: {
          storeId,
          OR: [
            { shopifyProductId: cleanId },
            { shopifyProductId: `gid://shopify/Product/${cleanId}` },
            { shopifyProductId: shopifyProductId },
          ],
        },
      });
    } catch (err) {
      console.warn('[WishlistService:deleteByProduct] error:', err);
    }
  }

  /**
   * Adds or updates an item in the wishlist.
   */
  static async addToWishlist(
    storeId: string,
    shopDomain: string,
    data: AddWishlistItemInput,
    userContext?: { userId?: string; userName?: string; userEmail?: string }
  ) {
    if (!storeId) throw new Error('storeId is required');
    if (!data.shopifyProductId) throw new Error('shopifyProductId is required');

    const cleanProductId = String(data.shopifyProductId).replace(/^gid:\/\/shopify\/Product\//i, '');
    const cleanVariantId = data.shopifyVariantId
      ? String(data.shopifyVariantId).replace(/^gid:\/\/shopify\/ProductVariant\//i, '')
      : null;

    const existing = await prisma.wishlistItem.findFirst({
      where: {
        storeId,
        shopifyProductId: cleanProductId,
        shopifyVariantId: cleanVariantId,
      },
    });

    const item = existing
      ? await prisma.wishlistItem.update({
          where: { id: existing.id },
          data: {
            productTitle: data.productTitle,
            variantTitle: data.variantTitle ?? existing.variantTitle,
            sku: data.sku ?? existing.sku,
            price: data.price !== undefined ? data.price : existing.price,
            imageUrl: data.imageUrl ?? existing.imageUrl,
            inventoryQuantity:
              data.inventoryQuantity !== undefined ? data.inventoryQuantity : existing.inventoryQuantity,
            note: data.note ?? existing.note,
          },
        })
      : await prisma.wishlistItem.create({
          data: {
            storeId,
            shopifyProductId: cleanProductId,
            shopifyVariantId: cleanVariantId,
            productTitle: data.productTitle,
            variantTitle: data.variantTitle || null,
            sku: data.sku || null,
            price: Number(data.price) || 0.0,
            imageUrl: data.imageUrl || null,
            inventoryQuantity: Number(data.inventoryQuantity) || 0,
            note: data.note || null,
          },
        });

    // Log user activity
    logUserActivity({
      storeId,
      shopDomain,
      action: 'WISHLIST_ADD',
      description: `Added "${data.productTitle}" to wishlist`,
      entityType: 'WISHLIST_ITEM',
      entityId: item.id,
      metadata: {
        productId: cleanProductId,
        productTitle: data.productTitle,
        variantId: cleanVariantId,
        sku: data.sku,
        price: data.price,
      },
    }).catch(() => {});

    return item;
  }

  /**
   * Removes an item from the wishlist by its ID.
   */
  static async removeFromWishlist(
    storeId: string,
    shopDomain: string,
    id: string,
    userContext?: { userId?: string; userName?: string; userEmail?: string }
  ) {
    if (!storeId || !id) throw new Error('storeId and id are required');

    const existing = await prisma.wishlistItem.findFirst({
      where: { id, storeId },
    });

    if (!existing) return null;

    const deleted = await prisma.wishlistItem.delete({
      where: { id },
    });

    // Log user activity
    logUserActivity({
      storeId,
      shopDomain,
      action: 'WISHLIST_REMOVE',
      description: `Removed "${existing.productTitle}" from wishlist`,
      entityType: 'WISHLIST_ITEM',
      entityId: id,
      metadata: {
        productId: existing.shopifyProductId,
        productTitle: existing.productTitle,
        variantId: existing.shopifyVariantId,
      },
    }).catch(() => {});

    return deleted;
  }

  /**
   * Toggles an item in the wishlist: removes if exists, adds if not.
   */
  static async toggleWishlist(
    storeId: string,
    shopDomain: string,
    data: AddWishlistItemInput,
    userContext?: { userId?: string; userName?: string; userEmail?: string }
  ) {
    if (!storeId) throw new Error('storeId is required');
    if (!data.shopifyProductId) throw new Error('shopifyProductId is required');

    const cleanProductId = String(data.shopifyProductId).replace(/^gid:\/\/shopify\/Product\//i, '');
    const cleanVariantId = data.shopifyVariantId
      ? String(data.shopifyVariantId).replace(/^gid:\/\/shopify\/ProductVariant\//i, '')
      : null;

    const existing = await prisma.wishlistItem.findFirst({
      where: {
        storeId,
        shopifyProductId: cleanProductId,
        shopifyVariantId: cleanVariantId,
      },
    });

    if (existing) {
      await this.removeFromWishlist(storeId, shopDomain, existing.id, userContext);
      return { wishlisted: false, item: null };
    } else {
      const item = await this.addToWishlist(storeId, shopDomain, data, userContext);
      return { wishlisted: true, item };
    }
  }

  /**
   * Checks whether specific product IDs (or variants) are currently wishlisted in the store.
   */
  static async checkWishlistStatus(
    storeId: string,
    productIds: string[]
  ): Promise<Record<string, { isWishlisted: boolean; wishlistItemId?: string }>> {
    if (!storeId || !productIds.length) return {};

    const cleanIds = productIds.map((id) =>
      String(id).replace(/^gid:\/\/shopify\/Product\//i, '')
    );

    const items = await prisma.wishlistItem.findMany({
      where: {
        storeId,
        shopifyProductId: { in: cleanIds },
      },
      select: {
        id: true,
        shopifyProductId: true,
        shopifyVariantId: true,
      },
    });

    const statusMap: Record<string, { isWishlisted: boolean; wishlistItemId?: string }> = {};

    cleanIds.forEach((pid) => {
      const found = items.find((i: any) => i.shopifyProductId === pid);
      statusMap[pid] = {
        isWishlisted: Boolean(found),
        wishlistItemId: found?.id,
      };
    });

    return statusMap;
  }
}

