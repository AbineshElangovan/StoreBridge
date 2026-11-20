import { NextRequest, NextResponse } from "next/server";
import { authenticate, handleApiError } from "@/lib/shopify/authenticate";
import { prisma } from "@/lib/db/prisma";
import { syncStoreProducts } from "@/services/shopify";
import { normalizeTagOrCollection, findCanonicalGroupKey, isCategoryMatch } from "@/lib/utils/categoryNormalization";
import { PreorderService } from "@/services/preorder/preorder-service";
import { WishlistService } from "@/services/wishlist/wishlist-service";

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

    const skuFallbackCollections: { [sku: string]: string[] } = {};
    const prodIdFallbackCollections: { [prodId: string]: string[] } = {};
    const titleFallbackCollections: { [title: string]: string[] } = {};
    const skuFallbackImages: { [sku: string]: string } = {};
    const titleFallbackImages: { [title: string]: string } = {};
    
    // Index collections and images across all products (both local products and cross-store products)
    const allKnownProducts = [...products, ...crossStoreProducts];
    allKnownProducts.forEach(p => {
      if (p.imageUrl) {
        if (p.sku) {
          const rawSku = p.sku.trim();
          const lowerSku = rawSku.toLowerCase();
          skuFallbackImages[rawSku] = p.imageUrl;
          skuFallbackImages[lowerSku] = p.imageUrl;

          // Also index base SKU without trailing sequence (e.g. STB-VIS-BLUE-M from STB-VIS-BLUE-M-0036)
          const baseSku = lowerSku.replace(/-\d+$/, '').trim();
          if (baseSku && !skuFallbackImages[baseSku]) {
            skuFallbackImages[baseSku] = p.imageUrl;
          }
        }
        const t = p.title?.trim().toLowerCase();
        if (t && !titleFallbackImages[t]) {
          titleFallbackImages[t] = p.imageUrl;
        }
        const baseTitle = t?.split(' - ')[0]?.trim();
        if (baseTitle && !titleFallbackImages[baseTitle]) {
          titleFallbackImages[baseTitle] = p.imageUrl;
        }
        const cleanTitle = (baseTitle || t)?.replace(/[^a-z0-9]/g, '');
        if (cleanTitle && !titleFallbackImages[cleanTitle]) {
          titleFallbackImages[cleanTitle] = p.imageUrl;
        }
      }

      // Collect true collection titles indexed by SKU, clean Shopify Product ID, and base Product Title
      if (p.collections && p.collections.length > 0) {
        const titles = p.collections.map((cp: any) => cp.collection?.title).filter(Boolean);

        if (p.sku) {
          if (!skuFallbackCollections[p.sku]) skuFallbackCollections[p.sku] = [];
          titles.forEach(t => { if (!skuFallbackCollections[p.sku!].includes(t)) skuFallbackCollections[p.sku!].push(t); });
        }

        const cleanId = p.shopifyProductId?.replace(/^gid:\/\/shopify\/Product\//i, '').split('/').pop();
        if (cleanId) {
          if (!prodIdFallbackCollections[cleanId]) prodIdFallbackCollections[cleanId] = [];
          titles.forEach(t => { if (!prodIdFallbackCollections[cleanId].includes(t)) prodIdFallbackCollections[cleanId].push(t); });
        }

        const baseTitle = p.title?.split(' - ')[0]?.trim().toLowerCase();
        if (baseTitle) {
          if (!titleFallbackCollections[baseTitle]) titleFallbackCollections[baseTitle] = [];
          titles.forEach(t => { if (!titleFallbackCollections[baseTitle].includes(t)) titleFallbackCollections[baseTitle].push(t); });
        }
      }
    });

    const resolveProductImage = (p: any): string[] => {
      if (p.sku && skuImages[p.sku]?.length > 0) return skuImages[p.sku];
      if (p.imageUrl) return [p.imageUrl];
      
      const s = p.sku?.trim();
      if (s) {
        if (skuFallbackImages[s]) return [skuFallbackImages[s]];
        const lowerS = s.toLowerCase();
        if (skuFallbackImages[lowerS]) return [skuFallbackImages[lowerS]];
        const baseSku = lowerS.replace(/-\d+$/, '').trim();
        if (baseSku && skuFallbackImages[baseSku]) return [skuFallbackImages[baseSku]];
      }

      const t = p.title?.trim().toLowerCase();
      if (t && titleFallbackImages[t]) return [titleFallbackImages[t]];
      
      const baseTitle = t?.split(' - ')[0]?.trim();
      if (baseTitle && titleFallbackImages[baseTitle]) return [titleFallbackImages[baseTitle]];

      const cleanTitle = (baseTitle || t)?.replace(/[^a-z0-9]/g, '');
      if (cleanTitle && titleFallbackImages[cleanTitle]) return [titleFallbackImages[cleanTitle]];

      // Fuzzy keyword match across all known cross-store products
      const searchTarget = (baseTitle || t || '').replace(/[^a-z0-9\s]/g, ' ');
      const words = searchTarget.split(/\s+/).filter((w: string) => w.length >= 3 && !['and', 'the', 'with', 'for'].includes(w));
      if (words.length > 0) {
        const matchedProduct = allKnownProducts.find(kp => {
          if (!kp.imageUrl) return false;
          const kTitle = (kp.title || '').toLowerCase();
          return words.every((w: string) => kTitle.includes(w));
        });
        if (matchedProduct?.imageUrl) {
          return [matchedProduct.imageUrl];
        }
      }

      return [];
    };

    // Deduplicate by normalized Title + Variant Title to guarantee zero duplicate rows in UI
    const dedupedProducts: typeof products = [];
    const seenTitles = new Map<string, any>();
    for (const p of products) {
      const baseTitle = p.title.trim().toLowerCase();
      const normKey = (p.sku || p.shopifyVariantId || '') + '|||' + baseTitle;
      
      // If product has no variant suffix, also check if same title already exists in another record
      if (!p.title.includes(' - ')) {
        const existingEntry = Array.from(seenTitles.entries()).find(([k, v]) => {
          return !v.title.includes(' - ') && v.title.trim().toLowerCase() === baseTitle;
        });

        if (existingEntry) {
          const [oldKey, oldP] = existingEntry;
          const oldHasColl = oldP.collections && oldP.collections.length > 0;
          const newHasColl = p.collections && p.collections.length > 0;

          if (!oldHasColl && newHasColl) {
            // Replace uncategorized duplicate with categorized product
            seenTitles.delete(oldKey);
            seenTitles.set(normKey, p);
            continue;
          } else if (oldHasColl && !newHasColl) {
            // Keep the categorized one, skip the uncategorized duplicate
            continue;
          }
        }
      }

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

        isPreorderAvailable = isPreorderTargeted && p.inventoryQuantity <= 0;
        preorderStatus = isPreorderAvailable ? 'Pre-order' : null;
      }

      const resolvedImgs = resolveProductImage(p);
      if (!p.imageUrl && resolvedImgs.length > 0 && p.shopifyVariantId) {
        prisma.productCache.updateMany({
          where: { storeId: store.id, shopifyVariantId: p.shopifyVariantId },
          data: { imageUrl: resolvedImgs[0] },
        }).catch(() => {});
      }

      const item = {
        id: p.id,
        shopifyProductId: p.shopifyProductId,
        shopifyVariantId: p.shopifyVariantId,
        imageUrls: resolvedImgs,
        title: displayTitle,
        sku: (p.sku && p.sku !== 'N/A') ? p.sku : (p.id ? `STB-SKU-${p.id.replace(/[^0-9]/g, '').slice(-4).padStart(4, '0')}` : 'STB-SKU-0001'),
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

      // 1. Resolve collection-based categories first (strictly real collections)
      let resolvedCollections: string[] = [];

      // A. Direct store product collections
      if (p.collections && p.collections.length > 0) {
        resolvedCollections = p.collections
          .map((cp: any) => cp.collection?.title)
          .filter(Boolean);
      }

      // B. Cross-store & sibling collection fallback for this SKU
      if (
        resolvedCollections.length === 0 &&
        p.sku &&
        skuFallbackCollections[p.sku] &&
        skuFallbackCollections[p.sku].length > 0
      ) {
        resolvedCollections = [...skuFallbackCollections[p.sku]];
      }

      // C. Fallback by parent product ID (all variants of the same product inherit its collection)
      const cleanProdId = p.shopifyProductId?.replace(/^gid:\/\/shopify\/Product\//i, '').split('/').pop();
      if (
        resolvedCollections.length === 0 &&
        cleanProdId &&
        prodIdFallbackCollections[cleanProdId] &&
        prodIdFallbackCollections[cleanProdId].length > 0
      ) {
        resolvedCollections = [...prodIdFallbackCollections[cleanProdId]];
      }

      // D. Fallback by base product title (e.g. "Baggy pant" -> "PANTS")
      const baseProductTitle = p.title?.split(' - ')[0]?.trim().toLowerCase();
      if (
        resolvedCollections.length === 0 &&
        baseProductTitle &&
        titleFallbackCollections[baseProductTitle] &&
        titleFallbackCollections[baseProductTitle].length > 0
      ) {
        resolvedCollections = [...titleFallbackCollections[baseProductTitle]];
      }

      // E. Keyword-based fallback: match product title keywords against all existing known groups
      // This catches "Baggy Denim pant" -> PANTS, "Premium Running Shoes" -> SHOES, etc.
      if (resolvedCollections.length === 0 && baseProductTitle) {
        const allExistingCollectionTitles = new Set<string>();
        allKnownProducts.forEach((kp: any) => {
          if (kp.collections) {
            kp.collections.forEach((cp: any) => {
              if (cp.collection?.title) allExistingCollectionTitles.add(cp.collection.title);
            });
          }
        });

        // Try to find a known collection title whose keywords appear in the product title
        for (const knownCollTitle of allExistingCollectionTitles) {
          const collWords = knownCollTitle.toLowerCase().replace(/[-_\s]+/g, ' ').split(' ').filter((w: string) => w.length >= 3);
          const matches = collWords.some((word: string) => baseProductTitle.includes(word));
          if (matches && !['home', 'page', 'all', 'catalog', 'frontpage'].includes(knownCollTitle.toLowerCase())) {
            resolvedCollections.push(knownCollTitle);
          }
        }
      }

      // 2. Determine final category titles:
      // - Include resolved collections (excluding generic Shopify system collections like 'Home page', 'All').
      // - Also incorporate product tags dynamically so products tagged 'mens accessories', 'Accessories', etc. are included.
      let candidateCategories: string[] = [];
      if (resolvedCollections.length > 0) {
        candidateCategories = resolvedCollections.filter(
          (c) => !['home page', 'frontpage', 'all', 'all products', 'catalog'].includes(c.toLowerCase().trim())
        );
        if (candidateCategories.length === 0 && resolvedCollections.length > 0) {
          candidateCategories = [...resolvedCollections];
        }
      }

      // Also incorporate tags
      if (p.tags) {
        const tagList = p.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
        for (const tag of tagList) {
          if (!candidateCategories.some(c => isCategoryMatch(c, tag))) {
            candidateCategories.push(tag);
          }
        }
      }

      if (candidateCategories.length === 0) {
        candidateCategories = ['Uncategorized'];
      }

      // 3. Normalize and canonicalize category titles to merge singular/plural and duplicate stems
      const targetGroupKeys: string[] = [];
      for (const rawCat of candidateCategories) {
        if (!rawCat) continue;
        const existingKeys = Object.keys(groupedProducts);
        // Find existing matching group (e.g. "T-SHIRTS" matches "T-SHIRT", "ACCESSORIES" matches "MENS ACCESSORIES")
        const canonicalKey = findCanonicalGroupKey(rawCat, existingKeys);

        // Also check against keys already selected for this product
        const alreadySelected = targetGroupKeys.some(k => isCategoryMatch(k, canonicalKey));
        if (!alreadySelected) {
          targetGroupKeys.push(canonicalKey);
        }
      }

      // Ensure every product has at least one valid group
      if (targetGroupKeys.length === 0) {
        targetGroupKeys.push('Uncategorized');
      }

      targetGroupKeys.forEach((groupKey) => {
        if (!groupedProducts[groupKey]) {
          groupedProducts[groupKey] = [];
        }
        
        // Show each variant in its canonical collection group
        groupedProducts[groupKey].push(item);
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
            p.inventoryQuantity <= 0
          );
        }).length
      : 0;

    let wishlistCount = 0;
    try {
      if (isStandalone) {
        wishlistCount = await WishlistService.getWishlistCount(store.id);
      }
    } catch (err) {
      console.warn("[Products API] Could not fetch wishlist count:", err);
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalProducts,
        totalInventory,
        activeProducts,
        lowStock,
        preorderActive: preorderActiveCount,
        wishlistCount,
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
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  } catch (err: any) {
    console.error("[Products API] Error:", err);
    return handleApiError(err);
  }
}
