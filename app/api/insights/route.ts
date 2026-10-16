import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { authenticate, handleApiError } from '@/lib/shopify/authenticate';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { store: currentStore, sessionStore, isMasterSession } = await authenticate(req);
    const { searchParams } = new URL(req.url);

    const storeFilter = searchParams.get('store') || 'all';
    const rangeDays = parseInt(searchParams.get('range') || '30', 10);
    const collectionFilter = searchParams.get('collection') || 'all';
    const tab = searchParams.get('tab') || 'best-sellers';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '10', 10));

    const dateThreshold = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

    // 1. Derive authorized stores server-side
    const effectiveMaster = isMasterSession
      ? (sessionStore?.isMaster ? sessionStore : (currentStore.isMaster ? currentStore : null))
      : (currentStore.isMaster ? currentStore : null);
    const isMaster = Boolean(effectiveMaster);

    const storeMap = new Map<string, any>();
    if (effectiveMaster) {
      storeMap.set(effectiveMaster.id, effectiveMaster);
      const connections = await (prisma as any).storeConnection.findMany({
        where: {
          OR: [
            { sourceStoreId: effectiveMaster.id },
            { targetStoreId: effectiveMaster.id }
          ]
        },
        include: {
          sourceStore: true,
          targetStore: true
        }
      });
      connections.forEach((c: any) => {
        if (c.sourceStore) storeMap.set(c.sourceStore.id, c.sourceStore);
        if (c.targetStore) storeMap.set(c.targetStore.id, c.targetStore);
      });
      if (!storeMap.has(currentStore.id) && currentStore.isActive) {
        storeMap.set(currentStore.id, currentStore);
      }
    } else {
      storeMap.set(currentStore.id, currentStore);
    }

    const authorizedStoreIds = Array.from(storeMap.keys());

    // Server-side Scope Enforcement for Store Selection
    let targetStoreIds: string[];
    if (isMaster) {
      targetStoreIds = (storeFilter === 'all' || !storeFilter)
        ? authorizedStoreIds
        : authorizedStoreIds.filter(id => id === storeFilter);
      if (targetStoreIds.length === 0) targetStoreIds = authorizedStoreIds;
    } else {
      // Standalone & Connected stores are strictly scoped to their own store
      targetStoreIds = [currentStore.id];
    }

    // Return store filter dropdown options based on store access
    const storeFilterOptions = (isMaster && storeMap.size > 1)
      ? [
          { id: 'all', label: 'All stores' },
          ...authorizedStoreIds.map(id => {
            const s = storeMap.get(id);
            const baseLabel = s?.label || s?.shopDomain || id;
            return {
              id: s?.id || id,
              label: s?.isMaster ? `${baseLabel} (Master)` : baseLabel
            };
          })
        ]
      : [
          {
            id: currentStore.id,
            label: currentStore.isMaster
              ? `${currentStore.label || currentStore.shopDomain} (Master)`
              : (currentStore.label || currentStore.shopDomain)
          }
        ];

    // 2. Fetch distinct collections for target stores
    const collectionsDb = await prisma.collection.findMany({
      where: { storeId: { in: targetStoreIds } },
      select: { title: true },
      distinct: ['title'],
      orderBy: { title: 'asc' }
    });
    const collectionList = ['All collections', ...collectionsDb.map(c => c.title)];

    const isCollectionFiltered = collectionFilter !== 'all' && collectionFilter !== 'All collections';

    // Find products belonging to the selected collection (via CollectionProduct relation or tags)
    let matchingProductCacheIds: string[] = [];
    let matchingTitles: string[] = [];
    let matchingSkus: string[] = [];
    let matchingProductIds: string[] = [];

    if (isCollectionFiltered) {
      const matchingCaches = await prisma.productCache.findMany({
        where: {
          storeId: { in: targetStoreIds },
          OR: [
            { collections: { some: { collection: { title: { equals: collectionFilter, mode: 'insensitive' } } } } },
            { tags: { contains: collectionFilter, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          title: true,
          sku: true,
          shopifyProductId: true
        }
      });

      matchingProductCacheIds = matchingCaches.map(c => c.id);
      matchingTitles = Array.from(new Set(matchingCaches.map(c => c.title.trim()).filter(Boolean)));
      matchingSkus = Array.from(new Set(matchingCaches.map(c => c.sku?.trim()).filter(Boolean) as string[]));
      matchingProductIds = Array.from(new Set(matchingCaches.map(c => c.shopifyProductId.trim()).filter(Boolean)));
    }

    // 3. Fetch sales activity logs for target stores
    const activityWhere: any = {
      storeId: { in: targetStoreIds },
      eventType: 'SOLD',
      createdAt: { gte: dateThreshold }
    };

    if (isCollectionFiltered) {
      const rawProductIds = matchingProductIds.map(p => p.replace('gid://shopify/Product/', ''));
      const orConditions: any[] = [
        { collection: { equals: collectionFilter, mode: 'insensitive' } }
      ];
      if (matchingTitles.length > 0) {
        orConditions.push({ productTitle: { in: matchingTitles } });
      }
      if (matchingSkus.length > 0) {
        orConditions.push({ sku: { in: matchingSkus } });
      }
      if (matchingProductIds.length > 0) {
        orConditions.push({ productId: { in: [...matchingProductIds, ...rawProductIds] } });
      }
      activityWhere.OR = orConditions;
    }

    const salesLogs = await prisma.activityLog.findMany({
      where: activityWhere,
      select: {
        storeId: true,
        sku: true,
        productId: true,
        productTitle: true,
        quantity: true,
        amount: true,
        eventType: true
      }
    });

    // Fetch last sold date per product across all time history
    const historyWhere: any = {
      storeId: { in: targetStoreIds },
      eventType: 'SOLD'
    };
    if (isCollectionFiltered) {
      const rawProductIds = matchingProductIds.map(p => p.replace('gid://shopify/Product/', ''));
      const orConditions: any[] = [
        { collection: { equals: collectionFilter, mode: 'insensitive' } }
      ];
      if (matchingTitles.length > 0) {
        orConditions.push({ productTitle: { in: matchingTitles } });
      }
      if (matchingSkus.length > 0) {
        orConditions.push({ sku: { in: matchingSkus } });
      }
      if (matchingProductIds.length > 0) {
        orConditions.push({ productId: { in: [...matchingProductIds, ...rawProductIds] } });
      }
      historyWhere.OR = orConditions;
    }

    const allSalesHistory = await prisma.activityLog.findMany({
      where: historyWhere,
      select: {
        storeId: true,
        sku: true,
        productId: true,
        productTitle: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const lastSoldMap = new Map<string, Date>();
    allSalesHistory.forEach(log => {
      const titleKey = log.productTitle?.trim();
      const skuKey = log.sku?.trim();
      if (log.storeId) {
        if (titleKey) {
          const comboKey = `${log.storeId}:${titleKey}`;
          if (!lastSoldMap.has(comboKey)) {
            lastSoldMap.set(comboKey, log.createdAt);
          }
        }
        if (skuKey) {
          const comboSkuKey = `${log.storeId}:sku:${skuKey}`;
          if (!lastSoldMap.has(comboSkuKey)) {
            lastSoldMap.set(comboSkuKey, log.createdAt);
          }
        }
      }
    });

    const isAllStores = isMaster && storeFilter === 'all';

    // Aggregate sales metrics per store and product
    const salesByTitleMap = new Map<string, { unitsSold: number; revenue: number }>();
    const salesBySkuMap = new Map<string, { unitsSold: number; revenue: number }>();

    salesLogs.forEach(log => {
      if (log.eventType === 'SOLD') {
        const qty = Math.max(0, log.quantity || 0);
        const amt = Math.max(0, log.amount || 0);
        const titleKey = log.productTitle?.trim();
        const skuKey = log.sku?.trim();

        if (titleKey && log.storeId) {
          const mapKey = isAllStores ? titleKey : `${log.storeId}:${titleKey}`;
          const existing = salesByTitleMap.get(mapKey) || { unitsSold: 0, revenue: 0 };
          salesByTitleMap.set(mapKey, {
            unitsSold: existing.unitsSold + qty,
            revenue: existing.revenue + amt
          });
        }

        if (skuKey && log.storeId) {
          const mapSkuKey = isAllStores ? skuKey : `${log.storeId}:sku:${skuKey}`;
          const existing = salesBySkuMap.get(mapSkuKey) || { unitsSold: 0, revenue: 0 };
          salesBySkuMap.set(mapSkuKey, {
            unitsSold: existing.unitsSold + qty,
            revenue: existing.revenue + amt
          });
        }
      }
    });

    // 4. Query ProductCache matching target stores
    const productWhere: any = {
      storeId: { in: targetStoreIds }
    };

    if (isCollectionFiltered) {
      productWhere.id = { in: matchingProductCacheIds };
    }

    const rawProducts = await prisma.productCache.findMany({
      where: productWhere,
      include: {
        store: {
          select: {
            id: true,
            label: true,
            shopDomain: true,
            lowStockThreshold: true
          }
        }
      }
    });

    const storeConfigMap = new Map<string, { bestSellerThreshold: number; deadStockDays: number }>();
    if (targetStoreIds.length > 0) {
      try {
        const dbConfigRows: any[] = await prisma.$queryRawUnsafe(
          `SELECT "id", "bestSellerThreshold", "deadStockDays" FROM "stores" WHERE "id" IN (${targetStoreIds.map(id => `'${id}'`).join(',')});`
        );
        dbConfigRows.forEach((r: any) => storeConfigMap.set(r.id, {
          bestSellerThreshold: r.bestSellerThreshold,
          deadStockDays: r.deadStockDays
        }));
      } catch (e) {}
    }

    // Process products and evaluate using each store's saved threshold
    const enrichedProductsMap = new Map<string, any>();

    rawProducts.forEach(p => {
      const titleKey = p.title?.trim() || p.sku?.trim();
      if (!titleKey) return;

      const pTitle = p.title?.trim();
      const pSku = p.sku?.trim();
      const mapKey = isAllStores ? titleKey : `${p.storeId}:${titleKey}`;
      const storeObj = p.store || storeMap.get(p.storeId);
      const dbConfig = storeConfigMap.get(p.storeId);

      const bestSellerThreshold = (storeObj as any)?.bestSellerThreshold ?? dbConfig?.bestSellerThreshold ?? (currentStore.bestSellerThreshold || 20);
      const deadStockDays = (storeObj as any)?.deadStockDays ?? dbConfig?.deadStockDays ?? (currentStore.deadStockDays || 90);
      const lowStockThreshold = storeObj?.lowStockThreshold ?? 10;

      const titleMapKey = isAllStores ? pTitle : (pTitle ? `${p.storeId}:${pTitle}` : null);
      const skuMapKey = isAllStores ? pSku : (pSku ? `${p.storeId}:sku:${pSku}` : null);
      const titleSales = titleMapKey ? salesByTitleMap.get(titleMapKey) : null;
      const skuSales = skuMapKey ? salesBySkuMap.get(skuMapKey) : null;
      const sales = (titleSales && titleSales.unitsSold > 0)
        ? titleSales
        : (skuSales || titleSales || { unitsSold: 0, revenue: 0 });

      const currentStock = Math.max(0, p.inventoryQuantity || 0);
      const storeName = p.store?.label || p.store?.shopDomain || 'Store';

      const lastSoldDate = (pTitle ? lastSoldMap.get(`${p.storeId}:${pTitle}`) : null)
        || (pSku ? lastSoldMap.get(`${p.storeId}:sku:${pSku}`) : null)
        || lastSoldMap.get(`${p.storeId}:${titleKey}`);
      const daysWithoutSale = lastSoldDate
        ? Math.floor((Date.now() - new Date(lastSoldDate).getTime()) / (1000 * 60 * 60 * 24))
        : Math.floor((Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24));

      const calculatedRevenue = sales.revenue > 0 ? sales.revenue : (sales.unitsSold * (p.price || 0));

      if (!enrichedProductsMap.has(mapKey)) {
        let stockHealth: 'OUT_OF_STOCK' | 'CRITICAL' | 'HEALTHY' = 'HEALTHY';
        if (currentStock === 0) {
          stockHealth = 'OUT_OF_STOCK';
        } else if (currentStock <= lowStockThreshold) {
          stockHealth = 'CRITICAL';
        }

        const isOutOfStock = currentStock === 0;
        const isBestSeller = !isOutOfStock && sales.unitsSold > bestSellerThreshold;
        const isSlowMover = !isOutOfStock && !isBestSeller && sales.unitsSold > 0;
        const isDeadStock = !isOutOfStock && sales.unitsSold === 0 && daysWithoutSale >= deadStockDays;

        enrichedProductsMap.set(mapKey, {
          id: p.id,
          title: p.title,
          sku: p.sku || 'N/A',
          imageUrl: p.imageUrl,
          price: p.price,
          unitsSold: sales.unitsSold,
          revenue: calculatedRevenue,
          currentStock,
          stockHealth,
          lowStockThreshold,
          bestSellerThreshold,
          deadStockDays,
          isBestSeller,
          isSlowMover,
          isDeadStock,
          isOutOfStock,
          lastSoldAt: lastSoldDate ? lastSoldDate.toISOString() : null,
          daysWithoutSale,
          daysUnsold: daysWithoutSale,
          storeLabels: new Set<string>([storeName]),
          storeId: p.storeId
        });
      } else {
        const existing = enrichedProductsMap.get(mapKey);
        existing.currentStock += currentStock;
        existing.storeLabels.add(storeName);

        if (existing.currentStock === 0) {
          existing.stockHealth = 'OUT_OF_STOCK';
        } else if (existing.currentStock <= lowStockThreshold) {
          existing.stockHealth = 'CRITICAL';
        } else {
          existing.stockHealth = 'HEALTHY';
        }

        existing.isOutOfStock = existing.currentStock === 0;
        existing.isBestSeller = !existing.isOutOfStock && existing.unitsSold > bestSellerThreshold;
        existing.isSlowMover = !existing.isOutOfStock && !existing.isBestSeller && existing.unitsSold > 0;
        existing.isDeadStock = !existing.isOutOfStock && existing.unitsSold === 0 && existing.daysWithoutSale >= deadStockDays;
      }
    });

    const allProducts = Array.from(enrichedProductsMap.values()).map(p => ({
      ...p,
      storeLabel: isAllStores && p.storeLabels.size > 1 
        ? 'Multi-Store'
        : Array.from(p.storeLabels)[0] || 'Store'
    }));

    // 5. Calculate Stat Cards
    let totalUnitsSold = 0;
    let totalRevenue = 0;
    let slowMoversCount = 0;
    let deadStockCount = 0;

    allProducts.forEach(p => {
      totalUnitsSold += p.unitsSold;
      totalRevenue += p.revenue;
      if (p.isSlowMover) slowMoversCount += 1;
      if (p.isDeadStock) deadStockCount += 1;
    });

    // 6. Filter & Sort data based on selected TAB
    let tabData: any[] = [];

    if (tab === 'best-sellers') {
      tabData = allProducts.filter(p => p.isBestSeller).sort((a, b) => b.unitsSold - a.unitsSold);
    } else if (tab === 'slow-movers') {
      tabData = allProducts.filter(p => p.isSlowMover).sort((a, b) => a.unitsSold - b.unitsSold);
    } else if (tab === 'dead-stock') {
      tabData = allProducts.filter(p => p.isDeadStock).sort((a, b) => b.daysUnsold - a.daysUnsold);
    } else if (tab === 'store-comparison') {
      const storeStatsMap = new Map<string, any>();
      targetStoreIds.forEach(id => {
        const storeObj = storeMap.get(id);
        if (storeObj) {
          storeStatsMap.set(id, {
            id: storeObj.id,
            storeName: storeObj.label || storeObj.shopDomain,
            domain: storeObj.shopDomain,
            isMaster: storeObj.isMaster,
            bestSellerThreshold: storeObj.bestSellerThreshold || storeConfigMap.get(storeObj.id)?.bestSellerThreshold || 20,
            deadStockDays: storeObj.deadStockDays || storeConfigMap.get(storeObj.id)?.deadStockDays || 90,
            unitsSold: 0,
            revenue: 0,
            productCount: 0,
            outOfStockCount: 0
          });
        }
      });

      rawProducts.forEach(p => {
        const stats = storeStatsMap.get(p.storeId);
        if (stats) {
          stats.productCount += 1;
          if (p.inventoryQuantity === 0) stats.outOfStockCount += 1;
        }
      });

      salesLogs.forEach(log => {
        if (log.eventType === 'SOLD') {
          const stats = storeStatsMap.get(log.storeId);
          if (stats) {
            const qty = Math.max(0, log.quantity || 0);
            stats.unitsSold += qty;
            if (log.amount && log.amount > 0) {
              stats.revenue += log.amount;
            } else {
              const titleKey = log.productTitle?.trim();
              const skuKey = log.sku?.trim();
              const matchedProd = rawProducts.find(p =>
                p.storeId === log.storeId && (
                  (titleKey && p.title?.trim() === titleKey) ||
                  (skuKey && p.sku?.trim() === skuKey)
                )
              );
              stats.revenue += qty * (matchedProd?.price || 0);
            }
          }
        }
      });

      tabData = Array.from(storeStatsMap.values()).sort((a, b) => b.revenue - a.revenue);
    }

    // 7. Server-side Pagination
    const totalCount = tabData.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedData = tabData.slice(startIndex, startIndex + limit);

    const currentStoreConfig = targetStoreIds.length === 1 ? storeConfigMap.get(targetStoreIds[0]) : null;
    const responseDeadStockDays = currentStoreConfig?.deadStockDays || (currentStore as any).deadStockDays;

    return NextResponse.json({
      success: true,
      stats: {
        unitsSold: totalUnitsSold,
        revenue: totalRevenue,
        slowMoversCount,
        deadStockCount,
        deadStockDays: responseDeadStockDays
      },
      filters: {
        stores: storeFilterOptions,
        collections: collectionList
      },
      data: paginatedData,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages
      }
    });

  } catch (error: any) {
    console.error('[Insights API] Error:', error);
    return handleApiError(error);
  }
}
