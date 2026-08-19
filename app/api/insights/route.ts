import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { authenticate, handleApiError } from '@/lib/shopify/authenticate';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { store: currentStore } = await authenticate(req);
    const { searchParams } = new URL(req.url);

    const storeFilter = searchParams.get('store') || 'all';
    const rangeDays = parseInt(searchParams.get('range') || '30', 10);
    const collectionFilter = searchParams.get('collection') || 'all';
    const tab = searchParams.get('tab') || 'best-sellers';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '15', 10));

    const dateThreshold = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

    // 1. Fetch connected stores for scope filtering
    const connections = await (prisma as any).storeConnection.findMany({
      where: {
        OR: [
          { sourceStoreId: currentStore.id },
          { targetStoreId: currentStore.id }
        ]
      },
      include: {
        sourceStore: true,
        targetStore: true
      }
    });

    const storeMap = new Map<string, any>();
    storeMap.set(currentStore.id, currentStore);
    connections.forEach((c: any) => {
      if (c.sourceStore) storeMap.set(c.sourceStore.id, c.sourceStore);
      if (c.targetStore) storeMap.set(c.targetStore.id, c.targetStore);
    });

    const authorizedStoreIds = Array.from(storeMap.keys());
    const targetStoreIds = storeFilter === 'all'
      ? authorizedStoreIds
      : authorizedStoreIds.filter(id => id === storeFilter);

    // 2. Fetch distinct collections for filter dropdown
    const collectionsDb = await prisma.collection.findMany({
      where: { storeId: { in: authorizedStoreIds } },
      select: { title: true },
      distinct: ['title']
    });
    const collectionList = ['All collections', ...collectionsDb.map(c => c.title)];

    // 3. Fetch sales activity logs in date range for authorized stores
    const activityWhere: any = {
      storeId: { in: targetStoreIds },
      eventType: 'SOLD',
      createdAt: { gte: dateThreshold }
    };

    if (collectionFilter !== 'all') {
      activityWhere.collection = collectionFilter;
    }

    const salesLogs = await prisma.activityLog.findMany({
      where: activityWhere,
      select: {
        storeId: true,
        sku: true,
        productTitle: true,
        quantity: true,
        amount: true,
        eventType: true
      }
    });

    // Also fetch last sold date per product across all time history
    const allSalesHistory = await prisma.activityLog.findMany({
      where: {
        storeId: { in: targetStoreIds },
        eventType: 'SOLD'
      },
      select: {
        sku: true,
        productTitle: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const lastSoldMap = new Map<string, Date>();
    allSalesHistory.forEach(log => {
      const key = log.productTitle?.trim() || log.sku?.trim();
      if (key && !lastSoldMap.has(key)) {
        lastSoldMap.set(key, log.createdAt);
      }
    });

    // Aggregate sales metrics by Product Title to deduplicate auto-generated store SKU variants
    const salesByTitle = new Map<string, { unitsSold: number; revenue: number }>();

    salesLogs.forEach(log => {
      if (log.eventType === 'SOLD') {
        const qty = Math.max(0, log.quantity || 0);
        const amt = Math.max(0, log.amount || 0);

        if (qty > 0 || amt > 0) {
          const key = log.productTitle?.trim() || log.sku?.trim();
          if (key) {
            const existing = salesByTitle.get(key) || { unitsSold: 0, revenue: 0 };
            salesByTitle.set(key, {
              unitsSold: existing.unitsSold + qty,
              revenue: existing.revenue + amt
            });
          }
        }
      }
    });

    // 4. Fetch products from ProductCache matching target stores
    const productWhere: any = {
      storeId: { in: targetStoreIds }
    };

    if (collectionFilter !== 'all') {
      const collectionRecords = await prisma.collection.findMany({
        where: {
          storeId: { in: targetStoreIds },
          title: collectionFilter
        },
        include: {
          products: {
            select: { productCacheId: true }
          }
        }
      });
      const cacheIds = collectionRecords.flatMap(c => c.products.map(p => p.productCacheId));
      productWhere.id = { in: cacheIds };
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

    // Deduplicate and process products by Product Title
    const enrichedProductsMap = new Map<string, any>();

    rawProducts.forEach(p => {
      const key = p.title?.trim() || p.sku?.trim();
      if (!key) return;

      const sales = salesByTitle.get(key) || { unitsSold: 0, revenue: 0 };
      const currentStock = Math.max(0, p.inventoryQuantity || 0);
      const lowStockThreshold = p.store?.lowStockThreshold || 10;

      const lastSoldDate = lastSoldMap.get(key);
      const daysUnsold = lastSoldDate
        ? Math.floor((Date.now() - new Date(lastSoldDate).getTime()) / (1000 * 60 * 60 * 24))
        : Math.floor((Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24));

      const calculatedRevenue = sales.revenue > 0 ? sales.revenue : (sales.unitsSold * (p.price || 0));

      if (!enrichedProductsMap.has(key)) {
        let stockHealth: 'OUT_OF_STOCK' | 'CRITICAL' | 'HEALTHY' = 'HEALTHY';
        if (currentStock === 0) {
          stockHealth = 'OUT_OF_STOCK';
        } else if (currentStock <= lowStockThreshold) {
          stockHealth = 'CRITICAL';
        }

        enrichedProductsMap.set(key, {
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
          lastSoldAt: lastSoldDate ? lastSoldDate.toISOString() : null,
          daysUnsold,
          storeLabel: p.store?.label || p.store?.shopDomain || 'Store',
          storeId: p.storeId
        });
      } else {
        const existing = enrichedProductsMap.get(key);
        existing.currentStock += currentStock;
        // recalculate combined stock health
        if (existing.currentStock === 0) {
          existing.stockHealth = 'OUT_OF_STOCK';
        } else if (existing.currentStock <= lowStockThreshold) {
          existing.stockHealth = 'CRITICAL';
        } else {
          existing.stockHealth = 'HEALTHY';
        }
      }
    });

    const allProducts = Array.from(enrichedProductsMap.values());

    // Calculate total Units Sold and Total Revenue for stat cards
    let totalUnitsSold = 0;
    let totalRevenue = 0;

    allProducts.forEach(p => {
      totalUnitsSold += p.unitsSold;
      totalRevenue += p.revenue;
    });

    // 5. Calculate Stat Card Counts
    const slowMoversCount = allProducts.filter(p => p.currentStock > 0 && p.unitsSold > 0 && p.unitsSold < 20).length;
    const deadStockCount = allProducts.filter(p => p.currentStock > 0 && p.unitsSold === 0).length;

    // 6. Filter & Sort data based on selected TAB
    let tabData: any[] = [];

    if (tab === 'best-sellers') {
      tabData = allProducts.filter(p => p.unitsSold >= 20).sort((a, b) => b.unitsSold - a.unitsSold);
    } else if (tab === 'slow-movers') {
      tabData = allProducts.filter(p => p.currentStock > 0 && p.unitsSold > 0 && p.unitsSold < 20)
        .sort((a, b) => a.unitsSold - b.unitsSold);
    } else if (tab === 'dead-stock') {
      tabData = allProducts.filter(p => p.currentStock > 0 && p.unitsSold === 0)
        .sort((a, b) => b.daysUnsold - a.daysUnsold);
    } else if (tab === 'store-comparison') {
      // Aggregate by store
      const storeStatsMap = new Map<string, any>();
      targetStoreIds.forEach(id => {
        const storeObj = storeMap.get(id);
        if (storeObj) {
          storeStatsMap.set(id, {
            id: storeObj.id,
            storeName: storeObj.label || storeObj.shopDomain,
            domain: storeObj.shopDomain,
            isMaster: storeObj.isMaster,
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
            stats.unitsSold += Math.max(0, log.quantity || 0);
            stats.revenue += Math.max(0, log.amount || 0);
          }
        }
      });

      tabData = Array.from(storeStatsMap.values()).sort((a, b) => b.revenue - a.revenue);
    }

    // 7. Server-side Pagination (15 records per page)
    const totalCount = tabData.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedData = tabData.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      stats: {
        unitsSold: totalUnitsSold,
        revenue: totalRevenue,
        slowMoversCount,
        deadStockCount
      },
      filters: {
        stores: [
          { id: 'all', label: 'All stores' },
          ...authorizedStoreIds.map(id => {
            const s = storeMap.get(id);
            return { id: s?.id || id, label: s?.label || s?.shopDomain || id };
          })
        ],
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
