import { NextRequest, NextResponse } from "next/server";
import { authenticate, handleApiError } from "@/lib/shopify/authenticate";
import { prisma } from "@/lib/db/prisma";
import {
  attachImageUrlToProduct,
  uploadPhotoToProduct,
  deleteProductMedia,
} from "@/lib/shopify/media-service";

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { store } = await authenticate(req);
    const { id: rawIdParam } = await params;
    const rawId = Array.isArray(rawIdParam) ? rawIdParam.join('/') : (rawIdParam || '');
    const decodedId = decodeURIComponent(rawId).trim();

    const cleanNumericId = decodedId
      .replace(/^gid:\/\/shopify\/Product\//i, '')
      .replace(/^gid%3a%2f%2fshopify%2fproduct%2f/i, '')
      .split('/')
      .pop() || decodedId;

    // 1. Find product in store catalog
    const product = await prisma.productCache.findFirst({
      where: {
        storeId: store.id,
        OR: [
          { id: decodedId },
          { shopifyProductId: decodedId },
          { shopifyProductId: cleanNumericId },
          { shopifyProductId: `gid://shopify/Product/${cleanNumericId}` },
          { shopifyProductId: { endsWith: cleanNumericId } },
          { sku: decodedId },
        ],
      },
      include: { store: true },
    });

    if (!product) {
      return NextResponse.json({ success: false, error: "Product not found in this store." }, { status: 404 });
    }

    const shopDomain = product.store.shopDomain;
    const shopifyProductId = product.shopifyProductId.startsWith('gid://')
      ? product.shopifyProductId
      : `gid://shopify/Product/${product.shopifyProductId}`;

    const contentType = req.headers.get("content-type") || "";

    // 2. Handle Photo Upload (multipart/form-data)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const altText = (formData.get("altText") as string) || product.title;

      if (!file) {
        return NextResponse.json({ success: false, error: "No image file provided in form data." }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const result = await uploadPhotoToProduct({
        shopDomain,
        shopifyProductId,
        fileBuffer: buffer,
        filename: file.name,
        mimeType: file.type || "image/jpeg",
        altText,
        replaceExisting: true,
      });

      if (!result.success || !result.imageUrl) {
        return NextResponse.json({ success: false, error: result.error || "Upload failed." }, { status: 400 });
      }

      // 3. Update store product cache for all variants of this product
      await prisma.productCache.updateMany({
        where: {
          storeId: store.id,
          shopifyProductId: product.shopifyProductId,
        },
        data: {
          imageUrl: result.imageUrl,
        },
      });

      // 4. Synchronize image replacement to connected stores
      try {
        const connections = await prisma.storeConnection.findMany({
          where: {
            OR: [
              { sourceStoreId: store.id },
              { targetStoreId: store.id },
            ],
          },
        });

        const connectedStoreIds = connections.map((c) =>
          c.sourceStoreId === store.id ? c.targetStoreId : c.sourceStoreId
        );

        if (connectedStoreIds.length > 0) {
          const matchingConnectedProducts = await prisma.productCache.findMany({
            where: {
              storeId: { in: connectedStoreIds },
              OR: [
                ...(product.sku ? [{ sku: product.sku }] : []),
                { title: product.title },
              ],
            },
            include: { store: true },
          });

          if (matchingConnectedProducts.length > 0) {
            await prisma.productCache.updateMany({
              where: {
                id: { in: matchingConnectedProducts.map((p) => p.id) },
              },
              data: {
                imageUrl: result.imageUrl,
              },
            });

            if (store.isMaster) {
              const uniqueTargets = new Map<string, { shopDomain: string; shopifyProductId: string; title: string }>();
              for (const cp of matchingConnectedProducts) {
                if (cp.shopifyProductId && cp.store?.shopDomain && !cp.shopifyProductId.startsWith('local-')) {
                  uniqueTargets.set(`${cp.store.shopDomain}:${cp.shopifyProductId}`, {
                    shopDomain: cp.store.shopDomain,
                    shopifyProductId: cp.shopifyProductId,
                    title: cp.title,
                  });
                }
              }

              for (const target of uniqueTargets.values()) {
                try {
                  await attachImageUrlToProduct({
                    shopDomain: target.shopDomain,
                    shopifyProductId: target.shopifyProductId,
                    imageUrl: result.imageUrl,
                    altText: target.title,
                    replaceExisting: true,
                  });
                } catch (connErr) {
                  console.warn(`[MediaAPI] Failed to replicate image to connected store ${target.shopDomain}:`, connErr);
                }
              }
            }
          }
        }
      } catch (syncErr) {
        console.warn("[MediaAPI] Connected store sync warning:", syncErr);
      }

      // Log activity
      try {
        if (prisma.activityLog) {
          await prisma.activityLog.create({
            data: {
              storeId: store.id,
              eventType: 'UPDATE',
              productTitle: product.title,
              sku: product.sku,
              imageUrl: result.imageUrl,
              description: `Uploaded product photo${result.wasOptimized ? ' (optimized to 4K)' : ''} to Shopify.`,
            },
          });
        }
      } catch (logErr) {
        console.warn("[MediaAPI] Failed to log activity:", logErr);
      }

      return NextResponse.json({
        success: true,
        mediaId: result.mediaId,
        imageUrl: result.imageUrl,
        status: result.status,
        wasOptimized: result.wasOptimized,
        originalSize: result.originalSize,
        optimizedSize: result.optimizedSize,
      });
    }

    // 3. Handle Image URL (application/json)
    const body = await req.json();
    const { imageUrl, altText } = body;

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ success: false, error: "Valid imageUrl string is required." }, { status: 400 });
    }

    const result = await attachImageUrlToProduct({
      shopDomain,
      shopifyProductId,
      imageUrl,
      altText: altText || product.title,
      replaceExisting: true,
    });

    if (!result.success || !result.imageUrl) {
      return NextResponse.json({ success: false, error: result.error || "Failed to attach image URL." }, { status: 400 });
    }

    // Update store product cache for all variants of this product
    await prisma.productCache.updateMany({
      where: {
        storeId: store.id,
        shopifyProductId: product.shopifyProductId,
      },
      data: {
        imageUrl: result.imageUrl,
      },
    });

    // Synchronize image replacement to connected stores
    try {
      const connections = await prisma.storeConnection.findMany({
        where: {
          OR: [
            { sourceStoreId: store.id },
            { targetStoreId: store.id },
          ],
        },
      });

      const connectedStoreIds = connections.map((c) =>
        c.sourceStoreId === store.id ? c.targetStoreId : c.sourceStoreId
      );

      if (connectedStoreIds.length > 0) {
        const matchingConnectedProducts = await prisma.productCache.findMany({
          where: {
            storeId: { in: connectedStoreIds },
            OR: [
              ...(product.sku ? [{ sku: product.sku }] : []),
              { title: product.title },
            ],
          },
          include: { store: true },
        });

        if (matchingConnectedProducts.length > 0) {
          await prisma.productCache.updateMany({
            where: {
              id: { in: matchingConnectedProducts.map((p) => p.id) },
            },
            data: {
              imageUrl: result.imageUrl,
            },
          });

          if (store.isMaster) {
            const uniqueTargets = new Map<string, { shopDomain: string; shopifyProductId: string; title: string }>();
            for (const cp of matchingConnectedProducts) {
              if (cp.shopifyProductId && cp.store?.shopDomain && !cp.shopifyProductId.startsWith('local-')) {
                uniqueTargets.set(`${cp.store.shopDomain}:${cp.shopifyProductId}`, {
                  shopDomain: cp.store.shopDomain,
                  shopifyProductId: cp.shopifyProductId,
                  title: cp.title,
                });
              }
            }

            for (const target of uniqueTargets.values()) {
              try {
                await attachImageUrlToProduct({
                  shopDomain: target.shopDomain,
                  shopifyProductId: target.shopifyProductId,
                  imageUrl: result.imageUrl,
                  altText: target.title,
                  replaceExisting: true,
                });
              } catch (connErr) {
                console.warn(`[MediaAPI] Failed to replicate image to connected store ${target.shopDomain}:`, connErr);
              }
            }
          }
        }
      }
    } catch (syncErr) {
      console.warn("[MediaAPI] Connected store sync warning:", syncErr);
    }

    // Log activity
    try {
      if (prisma.activityLog) {
        await prisma.activityLog.create({
          data: {
            storeId: store.id,
            eventType: 'UPDATE',
            productTitle: product.title,
            sku: product.sku,
            imageUrl: result.imageUrl,
            description: `Attached product image URL to Shopify.`,
          },
        });
      }
    } catch (logErr) {
      console.warn("[MediaAPI] Failed to log activity:", logErr);
    }

    return NextResponse.json({
      success: true,
      mediaId: result.mediaId,
      imageUrl: result.imageUrl,
      status: result.status,
    });

  } catch (err: any) {
    console.error("[MediaAPI] Error:", err);
    return handleApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { store } = await authenticate(req);
    const { id: rawIdParam } = await params;
    const rawId = Array.isArray(rawIdParam) ? rawIdParam.join('/') : (rawIdParam || '');
    const decodedId = decodeURIComponent(rawId).trim();

    const cleanNumericId = decodedId
      .replace(/^gid:\/\/shopify\/Product\//i, '')
      .replace(/^gid%3a%2f%2fshopify%2fproduct%2f/i, '')
      .split('/')
      .pop() || decodedId;

    const product = await prisma.productCache.findFirst({
      where: {
        storeId: store.id,
        OR: [
          { id: decodedId },
          { shopifyProductId: decodedId },
          { shopifyProductId: cleanNumericId },
          { shopifyProductId: `gid://shopify/Product/${cleanNumericId}` },
          { shopifyProductId: { endsWith: cleanNumericId } },
          { sku: decodedId },
        ],
      },
      include: { store: true },
    });

    if (!product) {
      return NextResponse.json({ success: false, error: "Product not found in this store." }, { status: 404 });
    }

    const shopDomain = product.store.shopDomain;
    const shopifyProductId = product.shopifyProductId.startsWith('gid://')
      ? product.shopifyProductId
      : `gid://shopify/Product/${product.shopifyProductId}`;

    const delResult = await deleteProductMedia({
      shopDomain,
      shopifyProductId,
    });

    if (!delResult.success) {
      return NextResponse.json({ success: false, error: delResult.error || "Failed to remove image in Shopify." }, { status: 400 });
    }

    // Reset imageUrl in cache for this product
    await prisma.productCache.updateMany({
      where: {
        storeId: store.id,
        shopifyProductId: product.shopifyProductId,
      },
      data: {
        imageUrl: null,
      },
    });

    // Synchronize removal to connected stores
    try {
      const connections = await prisma.storeConnection.findMany({
        where: {
          OR: [
            { sourceStoreId: store.id },
            { targetStoreId: store.id },
          ],
        },
      });

      const connectedStoreIds = connections.map((c) =>
        c.sourceStoreId === store.id ? c.targetStoreId : c.sourceStoreId
      );

      if (connectedStoreIds.length > 0) {
        const matchingConnectedProducts = await prisma.productCache.findMany({
          where: {
            storeId: { in: connectedStoreIds },
            OR: [
              ...(product.sku ? [{ sku: product.sku }] : []),
              { title: product.title },
            ],
          },
          include: { store: true },
        });

        if (matchingConnectedProducts.length > 0) {
          await prisma.productCache.updateMany({
            where: {
              id: { in: matchingConnectedProducts.map((p) => p.id) },
            },
            data: {
              imageUrl: null,
            },
          });

          if (store.isMaster) {
            const uniqueTargets = new Map<string, { shopDomain: string; shopifyProductId: string }>();
            for (const cp of matchingConnectedProducts) {
              if (cp.shopifyProductId && cp.store?.shopDomain && !cp.shopifyProductId.startsWith('local-')) {
                uniqueTargets.set(`${cp.store.shopDomain}:${cp.shopifyProductId}`, {
                  shopDomain: cp.store.shopDomain,
                  shopifyProductId: cp.shopifyProductId,
                });
              }
            }

            for (const target of uniqueTargets.values()) {
              try {
                await deleteProductMedia({
                  shopDomain: target.shopDomain,
                  shopifyProductId: target.shopifyProductId,
                });
              } catch (delErr) {
                console.warn(`[MediaAPI] Failed to delete media in connected store ${target.shopDomain}:`, delErr);
              }
            }
          }
        }
      }
    } catch (syncErr) {
      console.warn("[MediaAPI] Connected store delete sync warning:", syncErr);
    }

    try {
      if (prisma.activityLog) {
        await prisma.activityLog.create({
          data: {
            storeId: store.id,
            eventType: 'UPDATE',
            productTitle: product.title,
            sku: product.sku,
            description: `Removed product image from Shopify.`,
          },
        });
      }
    } catch (logErr) {
      console.warn("[MediaAPI] Failed to log delete activity:", logErr);
    }

    return NextResponse.json({ success: true, message: "Product image removed successfully." });

  } catch (err: any) {
    console.error("[MediaAPI] Delete error:", err);
    return handleApiError(err);
  }
}
