import { NextRequest, NextResponse } from "next/server";
import { authenticate, handleApiError } from "@/lib/shopify/authenticate";
import { prisma } from "@/lib/db/prisma";
import { syncStoreProducts } from "@/services/shopify";
import { normalizeTagOrCollection } from "@/lib/utils/categoryNormalization";
import { PreorderService } from "@/services/preorder/preorder-service";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { store, isStandalone } = await authenticate(req);

    // If standalone, load pre-order configuration to calculate eligibility
    let preorderConfig: any = null;
    if (isStandalone) {
      try {
        preorderConfig = await PreorderService.getConfig(store.id);
      } catch (err) {
        console.warn("[Products API] Could not load PreorderConfig:", err);
      }
    }
    
    // Fetch store-specific products with collections
    const products = await prisma.productCache.findMany({
      where: { storeId: store.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        store: true,
        collections: {
          include: {
            collection: true,
          }
        }
      }
    });

    const uniqueProducts = new Set(products.map(p => p.shopifyProductId)).size;
    const totalProducts = uniqueProducts;
    const totalInventory = products.reduce((sum, p) => sum + p.inventoryQuantity, 0);
    const activeProducts = products.filter((p) => p.inventoryQuantity > 0).length;
    const lowStock = products.filter((p) => p.inventoryQuantity <= store.lowStockThreshold).length;

    // Group products by collection
    const groupedProducts: { [collectionTitle: string]: any[] } = {};

    const skuImages: { [sku: string]: string[] } = {};
    products.forEach((p) => {
      if (p.sku && p.imageUrl) {
        if (!skuImages[p.sku]) skuImages[p.sku] = [];
        if (!skuImages[p.sku].includes(p.imageUrl)) {
          skuImages[p.sku].push(p.imageUrl);
        }
      }
    });

    // Cross-store collection and image fallback logic
    const currentSkus = products.map(p => p.sku).filter(Boolean) as string[];
    
    const connections = await (prisma as any).storeConnection.findMany({
      where: {
        OR: [
          { sourceStoreId: store.id },
          { targetStoreId: store.id },
        ],
      },
    });
    const authorizedStoreIds = [
      store.id,
      ...connections.map((c: any) => c.sourceStoreId === store.id ? c.targetStoreId : c.sourceStoreId),
    ];

    // Look ONLY across authorized connected stores for fallback images/collections
    const crossStoreProducts = await prisma.productCache.findMany({
      where: {
        storeId: { in: authorizedStoreIds },
        OR: [
          { sku: { in: currentSkus } },
          { collections: { some: {} } },
          { tags: { not: null } },
          { imageUrl: { not: null } },
        ],
      },
      include: { collections: { include: { collection: true } } },
    });

    const skuCategories: { [sku: string]: string[] } = {};
    const skuFallbackImages: { [sku: string]: string } = {};
    const titleFallbackImages: { [title: string]: string } = {};
    
    crossStoreProducts.forEach(p => {
      if (p.imageUrl) {
        if (p.sku && !skuFallbackImages[p.sku]) {
          skuFallbackImages[p.sku] = p.imageUrl;
        }
        const t = p.title?.trim().toLowerCase();
        if (t && !titleFallbackImages[t]) {
          titleFallbackImages[t] = p.imageUrl;
        }
        const baseTitle = t?.split(' - ')[0]?.trim();
        if (baseTitle && !titleFallbackImages[baseTitle]) {
          titleFallbackImages[baseTitle] = p.imageUrl;
        }
      }

      if (p.sku) {
        if (!skuCategories[p.sku]) skuCategories[p.sku] = [];
        
        if (p.collections) {
          p.collections.forEach(cp => {
             if (!skuCategories[p.sku!].includes(cp.collection.title)) {
               skuCategories[p.sku!].push(cp.collection.title);
             }
          });
        }
        
        if (p.tags) {
          const tagList = p.tags.split(',').map((t: string) => t.trim().toUpperCase()).filter(Boolean);
          
          tagList.forEach(tag => {
            // Case-insensitive deduplication
            const existing = skuCategories[p.sku!].map(c => c.toUpperCase());
            if (!existing.includes(tag)) {
              skuCategories[p.sku!].push(tag);
            }
          });
        }
      }
    });

    const resolveProductImage = (p: any): string[] => {
      if (p.sku && skuImages[p.sku]?.length > 0) return skuImages[p.sku];
      if (p.imageUrl) return [p.imageUrl];
      if (p.sku && skuFallbackImages[p.sku]) return [skuFallbackImages[p.sku]];
      const t = p.title?.trim().toLowerCase();
      if (t && titleFallbackImages[t]) return [titleFallbackImages[t]];
      const baseTitle = t?.split(' - ')[0]?.trim();
      if (baseTitle && titleFallbackImages[baseTitle]) return [titleFallbackImages[baseTitle]];
      return [];
    };

    // Deduplicate by normalized Title + Variant Title to guarantee zero duplicate rows in UI
    const dedupedProducts: typeof products = [];
    const seenTitles = new Map<string, any>();
    for (const p of products) {
      const normKey = (p.sku || p.shopifyVariantId || '') + '|||' + p.title.trim().toLowerCase();
      if (!seenTitles.has(normKey)) {
        seenTitles.set(normKey, p);
      } else {
        const existing = seenTitles.get(normKey);
        if (new Date(p.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
          seenTitles.set(normKey, p);
        }
      }
    }
    for (const p of seenTitles.values()) {
      dedupedProducts.push(p);
    }

    dedupedProducts.forEach((p) => {
      let displayTitle = p.title;
      // If product title was stored as a bare variant string without product name, resolve full title
      if (!displayTitle.includes(" - ")) {
        const matchingWithBase = crossStoreProducts.find(
          cp => (cp.shopifyProductId === p.shopifyProductId || (cp.sku && cp.sku === p.sku)) && cp.title && cp.title.includes(" - ")
        );
        if (matchingWithBase) {
          const base = matchingWithBase.title.split(" - ")[0].trim();
          displayTitle = `${base} - ${p.title}`;
        }
      }

      let isPreorderTargeted = false;
      let isPreorderAvailable = false;
      let preorderStatus: string | null = null;

      if (isStandalone && preorderConfig && preorderConfig.enabled) {
        const prodColls = (p.collections || []).flatMap((cp: any) => [
          cp.collection?.id,
          cp.collection?.shopifyCollectionId,
        ]).filter(Boolean) as string[];

        isPreorderTargeted = PreorderService.isProductTargeted(
          preorderConfig,
          p.shopifyProductId,
          prodColls
        );

        const threshold = preorderConfig.inventoryThreshold ?? 0;
        isPreorderAvailable = isPreorderTargeted && p.inventoryQuantity <= threshold;
        preorderStatus = isPreorderAvailable
          ? 'Pre-order Active'
          : isPreorderTargeted
          ? 'Pre-order Ready'
          : null;
      }

      const item = {
        id: p.id,
        shopifyProductId: p.shopifyProductId,
        imageUrls: resolveProductImage(p),
        title: displayTitle,
        sku: p.sku || 'N/A',
        store: p.store.label || p.store.shopDomain,
        price: p.price,
        priceText: (p.price).toFixed(2),
        inventoryQuantity: Math.max(0, p.inventoryQuantity),
        stockLevel:
          p.inventoryQuantity <= 0
            ? 'Out of Stock'
            : p.inventoryQuantity <= 5
            ? 'Critical'
            : p.inventoryQuantity <= store.lowStockThreshold
            ? 'Low'
            : 'Healthy',
        status: p.inventoryQuantity > 0 ? 'Active' : 'Inactive',
        isPreorderTargeted,
        isPreorderAvailable,
        preorderStatus,
        updatedDate: p.updatedAt.toISOString(),
        updatedTime: p.updatedAt.toISOString(),
      };

      let rawCategories: string[] = [];
      
      if (p.collections && p.collections.length > 0) {
        rawCategories = rawCategories.concat(p.collections.map(cp => cp.collection.title));
      }
      if (p.sku && skuCategories[p.sku] && skuCategories[p.sku].length > 0) {
        rawCategories = rawCategories.concat(skuCategories[p.sku]);
      }
      if (p.tags) {
        const tagList = p.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
        rawCategories = rawCategories.concat(tagList);
      }
      
      let categoryTitles: string[] = [];
      
      for (let rawCat of rawCategories) {
        if (!rawCat) continue;
        const finalCat = normalizeTagOrCollection(rawCat);
        if (finalCat && !categoryTitles.includes(finalCat)) {
          categoryTitles.push(finalCat);
        }
      }

      // Deduplicate category titles to prevent pushing the same item multiple times
      categoryTitles = Array.from(new Set(categoryTitles));
      if (categoryTitles.length === 0) {
        categoryTitles = ['Uncategorized'];
      }

      categoryTitles.forEach((title) => {
        if (!groupedProducts[title]) {
          groupedProducts[title] = [];
        }
        
        // Show each and every variant individually without collapsing or summing quantities
        groupedProducts[title].push(item);
      });
    });

    const preorderActiveCount = isStandalone
      ? dedupedProducts.filter(p => {
          const prodColls = (p.collections || []).flatMap((cp: any) => [
            cp.collection?.id,
            cp.collection?.shopifyCollectionId,
          ]).filter(Boolean) as string[];
          return (
            preorderConfig?.enabled &&
            PreorderService.isProductTargeted(preorderConfig, p.shopifyProductId, prodColls) &&
            p.inventoryQuantity <= (preorderConfig.inventoryThreshold ?? 0)
          );
        }).length
      : 0;

    return NextResponse.json({
      success: true,
      stats: {
        totalProducts,
        totalInventory,
        activeProducts,
        lowStock,
        preorderActive: preorderActiveCount,
      },
      lowStockThreshold: store.lowStockThreshold,
      isStandalone,
      preorderConfig: isStandalone && preorderConfig ? {
        enabled: preorderConfig.enabled,
        selectionMode: preorderConfig.selectionMode,
        inventoryThreshold: preorderConfig.inventoryThreshold,
        discountType: preorderConfig.discountType,
        discountValue: preorderConfig.discountValue,
      } : null,
      groupedProducts,
    });
  } catch (err: any) {
    console.error("[Products API] Error:", err);
    return handleApiError(err);
  }
}
