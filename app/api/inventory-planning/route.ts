import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { authenticate } from '@/lib/shopify/authenticate';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { store: currentStore } = await authenticate(req);
    const searchParams = req.nextUrl.searchParams;

    const selectedStore = searchParams.get('store') || 'all';
    const selectedCollection = searchParams.get('collection') || 'All collections';
    const searchQuery = (searchParams.get('product') || '').trim().toLowerCase();
    const forecastDaysParam = searchParams.get('forecastDays');
    const overrideForecastDays = forecastDaysParam ? parseInt(forecastDaysParam, 10) : null;
    const replenishDaysParam = searchParams.get('replenishDays');
    const overrideReplenishDays = replenishDaysParam ? parseInt(replenishDaysParam, 10) : null;
    const activeTab = searchParams.get('tab') || 'stock-risk';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '15', 10));

    // Get authorized stores for current user context
    const storeMap = new Map<string, any>();
    storeMap.set(currentStore.id, currentStore);

    if (currentStore.isMaster) {
      const connections = await (prisma as any).storeConnection.findMany({
        where: { sourceStoreId: currentStore.id },
        include: { targetStore: true }
      });
      connections.forEach((c: any) => {
        if (c.targetStore) {
          storeMap.set(c.targetStore.id, c.targetStore);
        }
      });
    }

    const isAllStores = selectedStore === 'all' && currentStore.isMaster;
    let targetStoreIds: string[] = [];

    if (isAllStores) {
      targetStoreIds = Array.from(storeMap.keys());
    } else {
      const targetId = selectedStore === 'all' ? currentStore.id : selectedStore;
      if (!storeMap.has(targetId)) {
        return NextResponse.json({
          success: false,
          error: "Unauthorized store access"
        }, { status: 403 });
      }
      targetStoreIds = [targetId];
    }

    // Query DB configuration for stores
    const storeConfigMap = new Map<string, {
      forecastPeriodDays: number;
      salesHistoryPeriodDays: number;
      supplierLeadTimeDays: number;
      safetyStockDays: number;
    }>();

    if (targetStoreIds.length > 0) {
      try {
        const dbConfigRows: any[] = await prisma.$queryRawUnsafe(
          `SELECT "id", "forecastPeriodDays", "salesHistoryPeriodDays", "supplierLeadTimeDays", "safetyStockDays" FROM "stores" WHERE "id" IN (${targetStoreIds.map(id => `'${id}'`).join(',')});`
        );
        dbConfigRows.forEach((r: any) => storeConfigMap.set(r.id, {
          forecastPeriodDays: r.forecastPeriodDays ?? 7,
          salesHistoryPeriodDays: r.salesHistoryPeriodDays ?? 30,
          supplierLeadTimeDays: r.supplierLeadTimeDays ?? 7,
          safetyStockDays: r.safetyStockDays ?? 3
        }));
      } catch (e) {
        // Raw query fallback
      }
    }

    // Query sales history from ActivityLog per store over their salesHistoryPeriodDays
    const storeSalesMap = new Map<string, Map<string, number>>(); // storeId -> (titleKey -> unitsSold)

    for (const storeId of targetStoreIds) {
      const cfg = storeConfigMap.get(storeId) || {
        forecastPeriodDays: (currentStore as any).forecastPeriodDays ?? 7,
        salesHistoryPeriodDays: (currentStore as any).salesHistoryPeriodDays ?? 30,
        supplierLeadTimeDays: (currentStore as any).supplierLeadTimeDays ?? 7,
        safetyStockDays: (currentStore as any).safetyStockDays ?? 3
      };

      const historyDays = cfg.salesHistoryPeriodDays || 30;
      const historyCutoff = new Date(Date.now() - historyDays * 24 * 60 * 60 * 1000);

      const salesLogs = await prisma.activityLog.findMany({
        where: {
          storeId,
          eventType: 'SOLD',
          createdAt: { gte: historyCutoff }
        },
        select: {
          productTitle: true,
          sku: true,
          quantity: true
        }
      });

      const prodSales = new Map<string, number>();
      salesLogs.forEach((log: any) => {
        const titleKey = log.productTitle?.trim() || log.sku?.trim();
        if (!titleKey) return;
        const currentQty = prodSales.get(titleKey) || 0;
        prodSales.set(titleKey, currentQty + (log.quantity || 1));
      });

      storeSalesMap.set(storeId, prodSales);
    }

    // Fetch product catalog for target stores
    const productWhereClause: any = {
      storeId: { in: targetStoreIds }
    };

    if (selectedCollection && selectedCollection !== 'all' && selectedCollection !== 'All collections') {
      const collectionRecords = await prisma.collection.findMany({
        where: {
          storeId: { in: targetStoreIds },
          title: { equals: selectedCollection, mode: 'insensitive' }
        },
        include: {
          products: {
            select: { productCacheId: true }
          }
        }
      });
      const cacheIds = collectionRecords.flatMap((c: any) => c.products.map((p: any) => p.productCacheId));
      if (cacheIds.length > 0) {
        productWhereClause.id = { in: cacheIds };
      }
    }

    const rawProducts = await prisma.productCache.findMany({
      where: productWhereClause,
      select: {
        id: true,
        storeId: true,
        title: true,
        sku: true,
        imageUrl: true,
        inventoryQuantity: true,
        price: true,
        store: {
          select: {
            id: true,
            label: true,
            shopDomain: true
          }
        }
      }
    });

    // Aggregation & Metric Calculations
    const aggregatedMap = new Map<string, any>();
    let totalMonitoredProducts = 0;

    rawProducts.forEach((p: any) => {
      const titleKey = p.title?.trim() || p.sku?.trim();
      if (!titleKey) return;

      if (searchQuery && !titleKey.toLowerCase().includes(searchQuery) && !(p.sku || '').toLowerCase().includes(searchQuery)) {
        return;
      }

      totalMonitoredProducts++;

      const storeId = p.storeId;
      const storeObj = p.store || storeMap.get(storeId);
      const storeName = storeObj?.label || storeObj?.shopDomain || 'Store';
      const cfg = storeConfigMap.get(storeId) || {
        forecastPeriodDays: (currentStore as any).forecastPeriodDays ?? 7,
        salesHistoryPeriodDays: (currentStore as any).salesHistoryPeriodDays ?? 30,
        supplierLeadTimeDays: (currentStore as any).supplierLeadTimeDays ?? 7,
        safetyStockDays: (currentStore as any).safetyStockDays ?? 3
      };

      const salesHistoryDays = cfg.salesHistoryPeriodDays || 30;
      const forecastDays = overrideForecastDays || cfg.forecastPeriodDays || 7;
      const leadTimeDays = cfg.supplierLeadTimeDays || 7;
      const safetyDays = cfg.safetyStockDays || 3;

      const salesMapForStore = storeSalesMap.get(storeId);
      const unitsSoldInHistory = salesMapForStore?.get(titleKey) || 0;
      const avgDailySales = unitsSoldInHistory / salesHistoryDays;

      const currentStock = Math.max(0, p.inventoryQuantity || 0);

      let expectedStockoutDays: number | null = null;
      if (avgDailySales > 0 && currentStock > 0) {
        expectedStockoutDays = Math.floor(currentStock / avgDailySales);
      }

      const forecastDemand = Math.round(avgDailySales * forecastDays);
      const replenishDays = overrideReplenishDays || leadTimeDays;
      const leadTimeDemand = avgDailySales * replenishDays;
      const safetyStockDemand = avgDailySales * safetyDays;
      const requiredStock = Math.ceil(leadTimeDemand + safetyStockDemand);
      const recommendedReplenishment = Math.max(0, Math.ceil(requiredStock - currentStock));

      // Deterministic Risk Assignment
      let risk: 'OUT_OF_STOCK' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NO_DEMAND' = 'LOW';

      if (currentStock === 0) {
        risk = 'OUT_OF_STOCK';
      } else if (avgDailySales === 0) {
        risk = 'NO_DEMAND';
      } else if (expectedStockoutDays !== null && expectedStockoutDays <= leadTimeDays) {
        risk = 'HIGH';
      } else if (expectedStockoutDays !== null && expectedStockoutDays <= (leadTimeDays + safetyDays)) {
        risk = 'MEDIUM';
      } else {
        risk = 'LOW';
      }

      const mapKey = isAllStores ? titleKey : `${storeId}:${titleKey}`;

      if (!aggregatedMap.has(mapKey)) {
        const storeBreakdownMap = new Map<string, any>();
        const skus = new Set<string>();
        if (p.sku && p.sku !== 'N/A') skus.add(p.sku);

        storeBreakdownMap.set(storeId, {
          storeId,
          storeName,
          currentStock,
          avgDailySales,
          expectedStockoutDays,
          recommendedReplenishment,
          risk,
          skus
        });

        aggregatedMap.set(mapKey, {
          id: p.id,
          title: p.title,
          sku: p.sku || 'N/A',
          imageUrl: p.imageUrl,
          price: p.price || 0,
          currentStock,
          unitsSoldInHistory,
          avgDailySales,
          forecastDemand,
          expectedStockoutDays,
          leadTimeDays,
          safetyDays,
          requiredStock,
          recommendedReplenishment,
          risk,
          storeLabels: new Set<string>([storeName]),
          storeBreakdownMap
        });
      } else {
        const existing = aggregatedMap.get(mapKey);
        existing.currentStock += currentStock;
        existing.unitsSoldInHistory += unitsSoldInHistory;
        existing.avgDailySales += avgDailySales;
        existing.forecastDemand += forecastDemand;
        existing.storeLabels.add(storeName);

        if (existing.storeBreakdownMap.has(storeId)) {
          const sb = existing.storeBreakdownMap.get(storeId);
          sb.currentStock += currentStock;
          if (p.sku && p.sku !== 'N/A') sb.skus.add(p.sku);

          if (sb.avgDailySales > 0 && sb.currentStock > 0) {
            sb.expectedStockoutDays = Math.floor(sb.currentStock / sb.avgDailySales);
          } else {
            sb.expectedStockoutDays = null;
          }
          const replenishDays = overrideReplenishDays || leadTimeDays;
          sb.requiredStock = Math.ceil((sb.avgDailySales * replenishDays) + (sb.avgDailySales * safetyDays));
          sb.recommendedReplenishment = Math.max(0, Math.ceil(sb.requiredStock - sb.currentStock));
          sb.replenishDays = replenishDays;
          if (sb.currentStock === 0) {
            sb.risk = 'OUT_OF_STOCK';
          } else if (sb.avgDailySales === 0) {
            sb.risk = 'NO_DEMAND';
          } else if (sb.expectedStockoutDays !== null && sb.expectedStockoutDays <= leadTimeDays) {
            sb.risk = 'HIGH';
          } else if (sb.expectedStockoutDays !== null && sb.expectedStockoutDays <= (leadTimeDays + safetyDays)) {
            sb.risk = 'MEDIUM';
          } else {
            sb.risk = 'LOW';
          }
        } else {
          const skus = new Set<string>();
          if (p.sku && p.sku !== 'N/A') skus.add(p.sku);

          existing.storeBreakdownMap.set(storeId, {
            storeId,
            storeName,
            currentStock,
            avgDailySales,
            expectedStockoutDays,
            recommendedReplenishment,
            risk,
            skus
          });
        }

        if (existing.avgDailySales > 0 && existing.currentStock > 0) {
          existing.expectedStockoutDays = Math.floor(existing.currentStock / existing.avgDailySales);
        } else {
          existing.expectedStockoutDays = null;
        }

        const replenishDays = overrideReplenishDays || leadTimeDays;
        existing.requiredStock = Math.ceil((existing.avgDailySales * replenishDays) + (existing.avgDailySales * safetyDays));
        existing.recommendedReplenishment = Math.max(0, Math.ceil(existing.requiredStock - existing.currentStock));
        existing.replenishDays = replenishDays;

        if (existing.currentStock === 0) {
          existing.risk = 'OUT_OF_STOCK';
        } else if (existing.avgDailySales === 0) {
          existing.risk = 'NO_DEMAND';
        } else if (existing.expectedStockoutDays !== null && existing.expectedStockoutDays <= leadTimeDays) {
          existing.risk = 'HIGH';
        } else if (existing.expectedStockoutDays !== null && existing.expectedStockoutDays <= (leadTimeDays + safetyDays)) {
          existing.risk = 'MEDIUM';
        } else {
          existing.risk = 'LOW';
        }
      }
    });

    const allProcessedProducts = Array.from(aggregatedMap.values()).map((p) => ({
      ...p,
      avgDailySalesFormatted: p.avgDailySales.toFixed(1),
      storeLabel: isAllStores && p.storeLabels.size > 1
        ? 'Multi-Store'
        : Array.from(p.storeLabels)[0] || 'Store',
      storesBreakdown: Array.from(p.storeBreakdownMap.values()).map((sb: any) => ({
        ...sb,
        skus: Array.from(sb.skus || [])
      }))
    }));

    // Aggregate counts across processed products
    let highRiskCount = 0;
    let mediumRiskCount = 0;
    let outOfStockCount = 0;
    let replenishmentNeededCount = 0;

    allProcessedProducts.forEach((p) => {
      if (p.risk === 'OUT_OF_STOCK') outOfStockCount++;
      if (p.risk === 'HIGH') highRiskCount++;
      if (p.risk === 'MEDIUM') mediumRiskCount++;
      if (p.recommendedReplenishment > 0) replenishmentNeededCount++;
    });

    // Tab-specific Filtering & Priority Sorting
    let tabData = [...allProcessedProducts];

    const riskPriority: Record<string, number> = {
      OUT_OF_STOCK: 1,
      HIGH: 2,
      MEDIUM: 3,
      LOW: 4,
      NO_DEMAND: 5
    };

    if (activeTab === 'stock-risk') {
      tabData.sort((a, b) => {
        const pA = riskPriority[a.risk] || 99;
        const pB = riskPriority[b.risk] || 99;
        if (pA !== pB) return pA - pB;

        const sA = a.expectedStockoutDays ?? 99999;
        const sB = b.expectedStockoutDays ?? 99999;
        if (sA !== sB) return sA - sB;

        return b.avgDailySales - a.avgDailySales;
      });
    } else if (activeTab === 'forecast') {
      tabData.sort((a, b) => b.forecastDemand - a.forecastDemand);
    } else if (activeTab === 'replenishment') {
      tabData = tabData.filter((p) => p.recommendedReplenishment > 0);
      tabData.sort((a, b) => b.recommendedReplenishment - a.recommendedReplenishment);
    } else if (activeTab === 'cross-store') {
      tabData.sort((a, b) => {
        const pA = riskPriority[a.risk] || 99;
        const pB = riskPriority[b.risk] || 99;
        if (pA !== pB) return pA - pB;
        return b.avgDailySales - a.avgDailySales;
      });
    }

    // Pagination
    const totalCount = tabData.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const startIndex = (page - 1) * limit;
    const paginatedData = tabData.slice(startIndex, startIndex + limit);

    // Dynamic Filter Options
    const storeFilterOptions = isAllStores
      ? [
          { id: 'all', label: 'All stores' },
          ...Array.from(storeMap.values()).map((s: any) => ({
            id: s.id,
            label: s.label || s.shopDomain
          }))
        ]
      : [
          {
            id: currentStore.id,
            label: currentStore.label || currentStore.shopDomain
          }
        ];

    const collections = await prisma.collection.findMany({
      where: {
        storeId: { in: targetStoreIds }
      },
      select: { title: true }
    });
    const collectionFilterOptions = ['All collections', ...Array.from(new Set(collections.map((c: any) => c.title)))];

    return NextResponse.json({
      success: true,
      stats: {
        highRisk: highRiskCount,
        mediumRisk: mediumRiskCount,
        outOfStock: outOfStockCount,
        replenishmentNeeded: replenishmentNeededCount,
        productsMonitored: totalMonitoredProducts
      },
      filters: {
        stores: storeFilterOptions,
        collections: collectionFilterOptions
      },
      data: paginatedData,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages
      }
    });
  } catch (err: any) {
    console.error('[API:inventory-planning] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
