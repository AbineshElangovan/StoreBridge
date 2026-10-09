import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { PreorderService } from '@/services/preorder/preorder-service';
import { NotifyMeService } from '@/services/notify-me/notify-me-service';

export const dynamic = 'force-dynamic';

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Shopify-Shop-Domain, X-Tunnel-Skip-Anti-Phishing-Page, Accept',
  };
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin');
  try {
    const searchParams = req.nextUrl.searchParams;
    let shop = searchParams.get('shop') || req.headers.get('x-shopify-shop-domain');
    const productId = searchParams.get('productId');
    const variantId = searchParams.get('variantId');

    if (!shop && origin) {
      try {
        shop = new URL(origin).hostname;
      } catch (e) {}
    }

    if (!shop) {
      return NextResponse.json(
        { success: false, error: 'Shop domain parameter is required' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const cleanShop = shop.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];

    const store = await prisma.store.findFirst({
      where: {
        isActive: true,
        OR: [
          { shopDomain: cleanShop },
          { shopDomain: { contains: cleanShop.split('.')[0], mode: 'insensitive' } },
        ],
      },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: 'Store not found or inactive' },
        { status: 404, headers: corsHeaders(origin) }
      );
    }

    const cleanPid = productId
      ? (productId.startsWith('gid://') ? productId : `gid://shopify/Product/${productId}`)
      : null;
    const cleanVid = variantId
      ? (variantId.startsWith('gid://') ? variantId : `gid://shopify/ProductVariant/${variantId}`)
      : null;
    const cleanVidNum = variantId
      ? variantId.replace(/^gid:\/\/shopify\/ProductVariant\//, '')
      : null;

    let resolvedProductId = cleanPid || productId;
    let variantsInventory: Record<string, number> = {};

    try {
      let cachedVariants: Array<{ shopifyProductId: string | null; shopifyVariantId: string | null; inventoryQuantity: number }> = [];

      if (cleanPid) {
        cachedVariants = await prisma.productCache.findMany({
          where: {
            storeId: store.id,
            OR: [
              { shopifyProductId: cleanPid },
              { shopifyProductId: productId! },
              { shopifyProductId: productId!.replace(/^gid:\/\/shopify\/Product\//, '') },
            ],
          },
          select: {
            shopifyProductId: true,
            shopifyVariantId: true,
            inventoryQuantity: true,
          },
        });
      }

      // If no variants found by productId, or productId wasn't provided, search by variantId
      if (cachedVariants.length === 0 && (cleanVid || cleanVidNum)) {
        const matchedVariant = await prisma.productCache.findFirst({
          where: {
            storeId: store.id,
            OR: [
              ...(cleanVid ? [{ shopifyVariantId: cleanVid }] : []),
              ...(cleanVidNum ? [{ shopifyVariantId: cleanVidNum }] : []),
              ...(cleanVidNum ? [{ shopifyVariantId: `gid://shopify/ProductVariant/${cleanVidNum}` }] : []),
            ],
          },
          select: {
            shopifyProductId: true,
          },
        });

        if (matchedVariant?.shopifyProductId) {
          resolvedProductId = matchedVariant.shopifyProductId;
          cachedVariants = await prisma.productCache.findMany({
            where: {
              storeId: store.id,
              shopifyProductId: matchedVariant.shopifyProductId,
            },
            select: {
              shopifyProductId: true,
              shopifyVariantId: true,
              inventoryQuantity: true,
            },
          });
        }
      }

      for (const cv of cachedVariants) {
        if (cv.shopifyVariantId) {
          const numId = cv.shopifyVariantId.replace(/^gid:\/\/shopify\/ProductVariant\//, '');
          variantsInventory[numId] = cv.inventoryQuantity;
          variantsInventory[cv.shopifyVariantId] = cv.inventoryQuantity;
        }
      }
    } catch (e) {
      console.warn('[Storefront:Config] Error reading variant stock cache:', e);
    }

    const [preorderConfig, notifyMeSetting] = await Promise.all([
      PreorderService.getConfig(store.id, resolvedProductId, variantId),
      NotifyMeService.getSettings(store.id),
    ]);

    let productCollectionIds: string[] = [];
    if (resolvedProductId || productId) {
      try {
        const pid = resolvedProductId || productId;
        const cleanPidNum = pid?.replace(/^gid:\/\/shopify\/Product\//, '');
        const productCaches = await prisma.productCache.findMany({
          where: {
            storeId: store.id,
            OR: [
              ...(pid ? [{ shopifyProductId: pid }] : []),
              ...(cleanPidNum ? [{ shopifyProductId: cleanPidNum }] : []),
              ...(cleanPidNum ? [{ shopifyProductId: `gid://shopify/Product/${cleanPidNum}` }] : []),
            ],
          },
          select: {
            collections: {
              select: {
                collection: {
                  select: { id: true, shopifyCollectionId: true, title: true }
                }
              }
            }
          }
        });
        for (const pc of productCaches) {
          for (const cp of pc.collections) {
            if (cp.collection.id) productCollectionIds.push(cp.collection.id);
            if (cp.collection.shopifyCollectionId) productCollectionIds.push(cp.collection.shopifyCollectionId);
          }
        }
      } catch (e) {
        console.warn('[Storefront:Config] Error reading product collections:', e);
      }
    }

    const isTargeted = PreorderService.isProductTargeted(
      preorderConfig,
      resolvedProductId || productId,
      productCollectionIds
    );

    console.log('[Storefront:Config:Debug] storeId:', store.id, 'shopDomain:', store.shopDomain, 'isTargeted:', isTargeted, 'selectionMode:', (preorderConfig as any).selectionMode, 'variantsInventory:', variantsInventory);

    const discountType = (preorderConfig as any).discountType || 'none';
    const discountValue = Number((preorderConfig as any).discountValue) || 0;
    const discountCode = PreorderService.getDiscountCode(discountType, discountValue);

    return NextResponse.json(
      {
        success: true,
        variantsInventory,
        preorder: {
          enabled: preorderConfig.enabled,
          isTargeted,
          selectionMode: (preorderConfig as any).selectionMode || 'ALL_PRODUCTS',
          inventoryThreshold: preorderConfig.inventoryThreshold,
          customerMessage: preorderConfig.customerMessage,
          shippingMessage: preorderConfig.shippingMessage,
          fulfillmentMessage: preorderConfig.fulfillmentMessage,
          maxQuantity: preorderConfig.maxQuantity,
          discountType,
          discountValue,
          discountCode,
          pricing: PreorderService.calculatePrice(
            parseFloat(searchParams.get('price') || searchParams.get('variantPrice') || '0'),
            discountType,
            discountValue
          ),
        },
        notifyMe: {
          enabled: notifyMeSetting.enabled,
          notifyEmail: notifyMeSetting.notifyEmail,
          notifyWhatsApp: notifyMeSetting.notifyWhatsApp,
          popupMessage: notifyMeSetting.popupMessage,
          buttonText: notifyMeSetting.buttonText,
          successMessage: notifyMeSetting.successMessage,
        },
      },
      { headers: corsHeaders(origin) }
    );
  } catch (error: any) {
    console.error('[Storefront:Config:Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load storefront configuration' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
