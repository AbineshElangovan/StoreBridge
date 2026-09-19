import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/shopify/authenticate';
import { prisma } from '@/lib/db/prisma';
import { getAdminClient } from '@/lib/shopify/admin';
import { setInventoryQuantity } from '@/lib/shopify/inventory';
import { fetchDefaultLocation } from '@/services/shopify/api-helpers';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { store } = await authenticate(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { action } = body; // 'ACCEPT' | 'DECLINE'

    if (!action || !['ACCEPT', 'DECLINE'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Invalid action parameter' }, { status: 400 });
    }

    // 1. Fetch notification
    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 });
    }

    if (notification.recipientStoreId !== store.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized to act on this notification' }, { status: 403 });
    }

    const metadata: any = notification.metadata || {};
    const { syncAction, payload } = metadata;

    if (action === 'DECLINE') {
      await prisma.notification.update({
        where: { id },
        data: {
          isRead: true,
          metadata: {
            ...metadata,
            syncPending: false,
            syncStatus: 'DECLINED',
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Sync request skipped for this store',
        status: 'DECLINED',
      });
    }

    // 2. Action === 'ACCEPT' -> Apply product Add / Update / Delete to Connected Store
    let successMessage = 'Product change synced successfully';

    if (syncAction === 'UPDATE' && payload) {
      const { price, quantity, sku, variantId, productId } = payload;

      // Find matching variant/product in this store's cache
      let targetProduct = await prisma.productCache.findFirst({
        where: {
          storeId: store.id,
          OR: [
            ...(sku ? [{ sku }] : []),
            ...(variantId ? [{ shopifyVariantId: variantId }] : []),
            ...(productId ? [{ shopifyProductId: productId }] : []),
          ],
        },
      });

      if (targetProduct) {
        const client = await getAdminClient(store.shopDomain);
        const formattedVarGid = targetProduct.shopifyVariantId.startsWith('gid://')
          ? targetProduct.shopifyVariantId
          : `gid://shopify/ProductVariant/${targetProduct.shopifyVariantId}`;
        const formattedProdGid = targetProduct.shopifyProductId.startsWith('gid://')
          ? targetProduct.shopifyProductId
          : `gid://shopify/Product/${targetProduct.shopifyProductId}`;

        // A. Update price on Shopify if price provided
        if (typeof price === 'number' && price >= 0) {
          await client.request(`
            mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                productVariants { id price }
                userErrors { field message }
              }
            }
          `, {
            variables: {
              productId: formattedProdGid,
              variants: [{ id: formattedVarGid, price: price.toString() }],
            },
          });
        }

        // B. Update stock on Shopify if quantity provided
        if (typeof quantity === 'number' && quantity >= 0) {
          const locationId = await fetchDefaultLocation(store.shopDomain);
          const variantMap = await prisma.variantMap.findFirst({
            where: { storeId: store.id, shopifyVariantId: targetProduct.shopifyVariantId },
          });

          let inventoryItemId = variantMap?.inventoryItemId;
          if (!inventoryItemId) {
            const vRes: any = await client.request(`
              query getVariantInventoryItem($id: ID!) {
                productVariant(id: $id) {
                  inventoryItem { id }
                }
              }
            `, { variables: { id: formattedVarGid } });
            inventoryItemId = vRes?.data?.productVariant?.inventoryItem?.id || vRes?.productVariant?.inventoryItem?.id;
          }

          if (inventoryItemId && locationId) {
            await setInventoryQuantity(store.shopDomain, inventoryItemId, locationId, quantity);
          }
        }

        // C. Update local product cache for this store
        const updateData: any = {};
        if (typeof price === 'number') {
          updateData.price = price;
          updateData.basePrice = price;
        }
        if (typeof quantity === 'number') {
          updateData.inventoryQuantity = quantity;
        }

        await prisma.productCache.update({
          where: { id: targetProduct.id },
          data: updateData,
        });

        // D. Create Activity Log
        await prisma.activityLog.create({
          data: {
            storeId: store.id,
            productId: targetProduct.shopifyProductId,
            productTitle: targetProduct.title,
            sku: targetProduct.sku || sku || 'N/A',
            eventType: 'UPDATE',
            quantity: typeof quantity === 'number' ? quantity : targetProduct.inventoryQuantity,
            amount: typeof price === 'number' ? price : targetProduct.price,
            description: `Synced Master update (Price: ₹${price ?? targetProduct.price}, Stock: ${quantity ?? targetProduct.inventoryQuantity})`,
          },
        });

        successMessage = `Product "${targetProduct.title}" updated in ${store.label || store.shopDomain}`;
      } else {
        successMessage = `Matching product not found in ${store.label || store.shopDomain}, could not apply update.`;
      }
    } else if (syncAction === 'DELETE' && payload) {
      const { productId, sku } = payload;

      let targetProduct = await prisma.productCache.findFirst({
        where: {
          storeId: store.id,
          OR: [
            ...(sku ? [{ sku }] : []),
            ...(productId ? [{ shopifyProductId: productId }, { id: productId }] : []),
          ],
        },
      });

      if (targetProduct) {
        try {
          const client = await getAdminClient(store.shopDomain);
          const formattedProdGid = targetProduct.shopifyProductId.startsWith('gid://')
            ? targetProduct.shopifyProductId
            : `gid://shopify/Product/${targetProduct.shopifyProductId}`;

          await client.request(`
            mutation deleteProduct($id: ID!) {
              productDelete(input: { id: $id }) {
                deletedProductId
                userErrors { field message }
              }
            }
          `, { variables: { id: formattedProdGid } });
        } catch (delErr: any) {
          console.warn(`[SyncAction] Shopify product delete warning for ${store.shopDomain}:`, delErr.message);
        }

        await prisma.productCache.deleteMany({
          where: { storeId: store.id, shopifyProductId: targetProduct.shopifyProductId },
        });

        await prisma.variantMap.deleteMany({
          where: { storeId: store.id, shopifyProductId: targetProduct.shopifyProductId },
        });

        await prisma.activityLog.create({
          data: {
            storeId: store.id,
            productId: targetProduct.shopifyProductId,
            productTitle: targetProduct.title,
            sku: targetProduct.sku || sku || 'N/A',
            eventType: 'DELETE',
            description: `Product deleted via Master store sync request`,
          },
        });

        successMessage = `Product "${targetProduct.title}" deleted from ${store.label || store.shopDomain}`;
      }
    } else if (syncAction === 'CREATE' && payload) {
      // Create product on Connected Store from master product payload
      const { processProductCreate } = await import('@/services/shopify/sync/create');
      if (payload.productData) {
        await processProductCreate(store.shopDomain, payload.productData);
        successMessage = `New product "${payload.productTitle || 'Product'}" created in ${store.label || store.shopDomain}`;
      }
    }

    // Update notification metadata to ACCEPTED & isRead: true
    await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        metadata: {
          ...metadata,
          syncPending: false,
          syncStatus: 'ACCEPTED',
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: successMessage,
      status: 'ACCEPTED',
    });
  } catch (err: any) {
    console.error('[Notification Sync Action Error]:', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to process sync request' }, { status: 500 });
  }
}
