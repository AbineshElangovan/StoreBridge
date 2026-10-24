import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { authenticate, handleApiError } from '@/lib/shopify/authenticate';
import { cleanupExpiredActivityLogs } from '@/lib/services/activityRetention';
import { PreorderService } from '@/services/preorder/preorder-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { store } = await authenticate(req);

    // Non-blocking auto-purge of activity logs older than 90 days
    cleanupExpiredActivityLogs().catch(() => {});
    
    // 1. Fetch authorized connections for THIS store only
    const connections = await (prisma as any).storeConnection.findMany({
      where: { sourceStoreId: store.id }
    });
    const connectedStoreIds = connections.map((c: any) => c.targetStoreId);
    const visibleStoreIds = [store.id, ...connectedStoreIds];

    // 2. Fetch data ONLY for authorized stores
    const [productCaches, totalSyncs, successSyncs, latestSync, allStores] = await Promise.all([
      prisma.productCache.findMany({ 
        where: { storeId: { in: visibleStoreIds } },
        include: {
          collections: {
            include: { collection: true }
          }
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }] 
      }),
      prisma.syncLog.count({ where: { sourceStoreId: store.id } }),
      prisma.syncLog.count({ where: { sourceStoreId: store.id, status: 'SUCCESS' } }),
      prisma.syncLog.findFirst({
        where: { sourceStoreId: store.id },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.store.findMany({ 
        where: { id: { in: visibleStoreIds }, isActive: true } 
      })
    ]);

    let lastUpdated = 'Never';
    if (latestSync) {
      const diffMins = Math.floor((Date.now() - latestSync.createdAt.getTime()) / 60000);
      lastUpdated =
        diffMins < 1 ? 'Just now' : diffMins < 60 ? `${diffMins} mins ago` : `${Math.floor(diffMins / 60)} hrs ago`;
    }

    // Current store metrics
    const rawCurrentStoreProducts = productCaches.filter((p: any) => p.storeId === store.id);
    
    // Clean up stale parent products (default variants) if real variants exist
    const productsByParent = new Map();
    for (const p of rawCurrentStoreProducts) {
      if (!productsByParent.has(p.shopifyProductId)) {
        productsByParent.set(p.shopifyProductId, []);
      }
      productsByParent.get(p.shopifyProductId).push(p);
    }

    const currentStoreProducts: any[] = [];
    // Deduplicate by normalized Title + Variant Title to guarantee zero duplicate rows in UI
    const seenTitles = new Map<string, any>();
    for (const p of rawCurrentStoreProducts) {
      const siblings = productsByParent.get(p.shopifyProductId);
      if (siblings && siblings.length > 1 && !p.title.includes(' - ')) {
        continue;
      }
      const normTitle = p.title.trim().toLowerCase();
      // If duplicate title exists in this store, keep only the latest updated one
      if (!seenTitles.has(normTitle)) {
        seenTitles.set(normTitle, p);
      } else {
        const existing = seenTitles.get(normTitle);
        if (new Date(p.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
          seenTitles.set(normTitle, p);
        }
      }
    }
    for (const p of seenTitles.values()) {
      currentStoreProducts.push(p);
    }

    const totalProducts = new Set(currentStoreProducts.map((p: any) => p.shopifyProductId)).size;
    const totalInventory = currentStoreProducts.reduce((a: any, p: any) => a + p.inventoryQuantity, 0);
    const activeProducts = new Set(
      currentStoreProducts.filter((p: any) => p.inventoryQuantity > 0).map((p: any) => p.shopifyProductId)
    ).size;
    const lowStockCount = currentStoreProducts.filter((p: any) => p.inventoryQuantity <= store.lowStockThreshold).length;
    let preorderActiveCount = 0;
    try {
      const preorderConfig = await PreorderService.getConfig(store.id);
      if (preorderConfig && preorderConfig.enabled) {
        preorderActiveCount = currentStoreProducts.filter((p: any) => {
          const prodColls = (p.collections || []).flatMap((cp: any) => [
            cp.collection?.id,
            cp.collection?.shopifyCollectionId,
          ]).filter(Boolean) as string[];
          return (
            p.inventoryQuantity <= (preorderConfig.inventoryThreshold ?? 0) &&
            PreorderService.isProductTargeted(preorderConfig, p.shopifyProductId, prodColls)
          );
        }).length;
      }
    } catch (e) {
      console.warn('[Dashboard] Could not fetch preorder active count:', e);
    }

    const stats = {
      totalProducts,
      totalInventory,
      activeProducts,
      lowStock: lowStockCount,
      preorderActive: preorderActiveCount,
      lastUpdated,
    };

    const storesWithProducts = allStores.map((s: any) => {
      const storeSpecificProducts = productCaches.filter((p: any) => p.storeId === s.id);
      return {
        id: s.id,
        shopDomain: s.shopDomain,
        label: s.label || s.shopDomain,
        isActive: s.isActive,
        productCount: new Set(storeSpecificProducts.map((p: any) => p.shopifyProductId)).size,
        inventoryTotal: storeSpecificProducts.reduce((acc: any, p: any) => acc + p.inventoryQuantity, 0),
        salesValue: storeSpecificProducts.reduce((acc: any, p: any) => acc + (p.price * p.inventoryQuantity), 0),
        activeProductCount: new Set(
          storeSpecificProducts.filter((p: any) => p.inventoryQuantity > 0).map((p: any) => p.shopifyProductId)
        ).size,
      };
    });

    const failedSyncs = totalSyncs - successSyncs;
    const syncStats = { totalSyncs, successSyncs, failedSyncs };

    // Build image fallback maps across visible products and global catalog
    const allKnownImages = await prisma.productCache.findMany({
      where: { imageUrl: { not: null } },
      select: { sku: true, title: true, imageUrl: true }
    });
    const skuFallbackImages = new Map<string, string>();
    const titleFallbackImages = new Map<string, string>();
    allKnownImages.forEach((p: any) => {
      if (p.imageUrl) {
        if (p.sku && !skuFallbackImages.has(p.sku)) {
          skuFallbackImages.set(p.sku, p.imageUrl);
        }
        const t = p.title?.trim().toLowerCase();
        if (t && !titleFallbackImages.has(t)) {
          titleFallbackImages.set(t, p.imageUrl);
        }
        const baseTitle = t?.split(' - ')[0]?.trim();
        if (baseTitle && !titleFallbackImages.has(baseTitle)) {
          titleFallbackImages.set(baseTitle, p.imageUrl);
        }
      }
    });

    const enrichProduct = (p: any) => {
      let img = p.imageUrl;
      if (!img && p.sku && skuFallbackImages.has(p.sku)) {
        img = skuFallbackImages.get(p.sku);
      }
      if (!img) {
        const t = p.title?.trim().toLowerCase();
        if (t && titleFallbackImages.has(t)) {
          img = titleFallbackImages.get(t);
        } else {
          const baseTitle = t?.split(' - ')[0]?.trim();
          if (baseTitle && titleFallbackImages.has(baseTitle)) {
            img = titleFallbackImages.get(baseTitle);
          }
        }
      }
      return {
        ...p,
        imageUrl: img || null,
        inventoryQuantity: Math.max(0, p.inventoryQuantity)
      };
    };

    // Include each and every variant individually
    const lowStockProducts = currentStoreProducts
      .filter((p: any) => p.inventoryQuantity <= store.lowStockThreshold)
      .map((p: any) => enrichProduct(p))
      .sort((a: any, b: any) => a.inventoryQuantity - b.inventoryQuantity)
      .slice(0, 50);

    const recentlyAddedProducts = currentStoreProducts
      .map((p: any) => enrichProduct(p))
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);

    return NextResponse.json({
      success: true,
      currentStoreId: store.id,
      stores: storesWithProducts,
      stats,
      syncStats,
      lowStockProducts,
      recentlyAddedProducts,
      lowStockThreshold: store.lowStockThreshold,
    });
  } catch (error: any) {
    console.error('[Dashboard API] Error:', error);
    return handleApiError(error);
  }
}
