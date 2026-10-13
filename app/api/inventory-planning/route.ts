import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { authenticate } from '@/lib/shopify/authenticate';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { store: currentStore, sessionStore, isMasterSession } = await authenticate(req);
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
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '10', 10));

    // Master store scope resolution: master store session or current store is master
    const effectiveMaster = isMasterSession
      ? (sessionStore?.isMaster ? sessionStore : (currentStore.isMaster ? currentStore : null))
      : (currentStore.isMaster ? currentStore : null);
    const isMasterScope = Boolean(effectiveMaster);

    // Get authorized stores for current user context
    const storeMap = new Map<string, any>();
    if (effectiveMaster) {
      storeMap.set(effectiveMaster.id, effectiveMaster);
      const connections = await (prisma as any).storeConnection.findMany({
        where: { sourceStoreId: effectiveMaster.id },
        include: { targetStore: true }
      });
      connections.forEach((c: any) => {
        if (c.targetStore) {
          storeMap.set(c.targetStore.id, c.targetStore);
        }
      });
      if (!storeMap.has(currentStore.id) && currentStore.isActive) {
        storeMap.set(currentStore.id, currentStore);
      }
    } else {
      storeMap.set(currentStore.id, currentStore);
    }

    const isAllStores = (selectedStore === 'all' || !selectedStore) && isMasterScope;
    let targetStoreIds: string[] = [];

    if (isAllStores) {
      targetStoreIds = Array.from(storeMap.keys());
    } else {
      const targetId = (selectedStore === 'all' || !selectedStore) ? currentStore.id : selectedStore;
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
        shopifyProductId: true,
        title: true,
        sku: true,
        imageUrl: true,
        inventoryQuantity: true,
        price: true,
        createdAt: true,
        store: {
          select: {
            id: true,
            label: true,
            shopDomain: true
          }
        }
      }
    });

    // Build cross-variant and cross-store fallback image maps
    // First from rawProducts, then supplemented from any authorized product caches if needed
    const skuToImageMap = new Map<string, string>();
    const titleToImageMap = new Map<string, string>();
    const shopifyPidToImageMap = new Map<string, string>();

    rawProducts.forEach((p: any) => {
      if (p.imageUrl) {
        if (p.sku && !skuToImageMap.has(p.sku)) skuToImageMap.set(p.sku, p.imageUrl);
        const t = p.title?.trim().toLowerCase();
        if (t && !titleToImageMap.has(t)) titleToImageMap.set(t, p.imageUrl);
        // Also base title without variant suffix if applicable (e.g., "Baggy Denim pant - Blue / Medium" -> "baggy denim pant")
        const baseTitle = t?.split(' - ')[0]?.trim();
        if (baseTitle && !titleToImageMap.has(baseTitle)) titleToImageMap.set(baseTitle, p.imageUrl);
        if (p.shopifyProductId && !shopifyPidToImageMap.has(p.shopifyProductId)) {
          shopifyPidToImageMap.set(p.shopifyProductId, p.imageUrl);
        }
      }
    });

    // If any products are still missing images, check authorized store caches for any variant with an image
    const missingImageSkus = rawProducts.filter((p: any) => !p.imageUrl && p.sku).map((p: any) => p.sku);
    if (missingImageSkus.length > 0) {
      const extraCachesWithImg = await prisma.productCache.findMany({
        where: {
          storeId: { in: targetStoreIds },
          sku: { in: missingImageSkus },
          imageUrl: { not: null }
        },
        select: { sku: true, title: true, imageUrl: true, shopifyProductId: true }
      });
      extraCachesWithImg.forEach((ec: any) => {
        if (ec.imageUrl) {
          if (ec.sku && !skuToImageMap.has(ec.sku)) skuToImageMap.set(ec.sku, ec.imageUrl);
          const t = ec.title?.trim().toLowerCase();
          if (t && !titleToImageMap.has(t)) titleToImageMap.set(t, ec.imageUrl);
          const baseTitle = t?.split(' - ')[0]?.trim();
          if (baseTitle && !titleToImageMap.has(baseTitle)) titleToImageMap.set(baseTitle, ec.imageUrl);
          if (ec.shopifyProductId && !shopifyPidToImageMap.has(ec.shopifyProductId)) {
            shopifyPidToImageMap.set(ec.shopifyProductId, ec.imageUrl);
          }
        }
      });
    }

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
      const highRiskDays = cfg.supplierLeadTimeDays || 10;
      const leadTimeDays = highRiskDays;
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

      // Deterministic Risk Assignment: Only High Risk, Low Risk, and No Demand
      let risk: 'OUT_OF_STOCK' | 'HIGH' | 'LOW' | 'NO_DEMAND' = 'LOW';

      if (currentStock === 0) {
        risk = 'OUT_OF_STOCK';
      } else if (avgDailySales === 0) {
        risk = 'NO_DEMAND';
      } else if (expectedStockoutDays !== null && expectedStockoutDays <= highRiskDays) {
        risk = 'HIGH';
      } else {
        risk = 'LOW';
      }

      // Best resolved image URL
      const tLower = p.title?.trim().toLowerCase();
      const baseTitle = tLower?.split(' - ')[0]?.trim();
      const resolvedImageUrl = p.imageUrl ||
        (p.sku ? skuToImageMap.get(p.sku) : null) ||
        (p.shopifyProductId ? shopifyPidToImageMap.get(p.shopifyProductId) : null) ||
        (tLower ? titleToImageMap.get(tLower) : null) ||
        (baseTitle ? titleToImageMap.get(baseTitle) : null) ||
        null;

      const mapKey = isAllStores ? titleKey : `${storeId}:${titleKey}`;

      if (!aggregatedMap.has(mapKey)) {
        const storeBreakdownMap = new Map<string, any>();
        const skus = new Set<string>();
        if (p.sku && p.sku !== 'N/A') skus.add(p.sku);

        const createdAtDate = p.createdAt ? new Date(p.createdAt) : new Date();
        const daysSinceCreated = Math.max(0, Math.floor((Date.now() - createdAtDate.getTime()) / (1000 * 60 * 60 * 24)));

        storeBreakdownMap.set(storeId, {
          storeId,
          storeName,
          currentStock,
          avgDailySales,
          expectedStockoutDays,
          daysSinceCreated,
          createdAt: createdAtDate.toISOString(),
          recommendedReplenishment,
          risk,
          skus
        });

        aggregatedMap.set(mapKey, {
          id: p.id,
          title: p.title,
          sku: p.sku || 'N/A',
          imageUrl: resolvedImageUrl,
          price: p.price || 0,
          currentStock,
          unitsSoldInHistory,
          avgDailySales,
          forecastDemand,
          expectedStockoutDays,
          createdAt: createdAtDate,
          daysSinceCreated,
          leadTimeDays,
          replenishDays,
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

        if (p.createdAt && new Date(p.createdAt) < existing.createdAt) {
          existing.createdAt = new Date(p.createdAt);
          existing.daysSinceCreated = Math.max(0, Math.floor((Date.now() - existing.createdAt.getTime()) / (1000 * 60 * 60 * 24)));
        }

        // Retain / upgrade image if existing had none
        if (!existing.imageUrl && resolvedImageUrl) {
          existing.imageUrl = resolvedImageUrl;
        }

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
          const highRiskDays = cfg.supplierLeadTimeDays || 10;
          if (sb.currentStock === 0) {
            sb.risk = 'OUT_OF_STOCK';
          } else if (sb.avgDailySales === 0) {
            sb.risk = 'NO_DEMAND';
          } else if (sb.expectedStockoutDays !== null && sb.expectedStockoutDays <= highRiskDays) {
            sb.risk = 'HIGH';
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

        const highRiskDays = cfg.supplierLeadTimeDays || 10;
        if (existing.currentStock === 0) {
          existing.risk = 'OUT_OF_STOCK';
        } else if (existing.avgDailySales === 0) {
          existing.risk = 'NO_DEMAND';
        } else if (existing.expectedStockoutDays !== null && existing.expectedStockoutDays <= highRiskDays) {
          existing.risk = 'HIGH';
        } else {
          existing.risk = 'LOW';
        }
      }
    });

    const formatStockoutDays = (days: number | null): string => {
      if (days === null) return 'No demand';
      if (days === 0) return '0 days';
      if (days === 1) return '1 day';
      if (days > 365) return '> 1 year';
      if (days > 90) return '> 90 days';
      return `${days} days`;
    };

    const getStockoutDate = (days: number | null): string | null => {
      if (days === null) return null;
      const target = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      return target.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const allProcessedProducts = Array.from(aggregatedMap.values()).map((p) => ({
      ...p,
      avgDailySalesFormatted: p.avgDailySales.toFixed(1),
      stockoutDaysFormatted: formatStockoutDays(p.expectedStockoutDays),
      stockoutDate: getStockoutDate(p.expectedStockoutDays),
      daysSinceCreated: p.daysSinceCreated ?? 0,
      createdDateFormatted: p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
      storeLabel: isAllStores && p.storeLabels.size > 1
        ? 'Multi-Store'
        : Array.from(p.storeLabels)[0] || 'Store',
      storesBreakdown: Array.from(p.storeBreakdownMap.values()).map((sb: any) => ({
        ...sb,
        stockoutDaysFormatted: formatStockoutDays(sb.expectedStockoutDays),
        stockoutDate: getStockoutDate(sb.expectedStockoutDays),
        daysSinceCreated: sb.daysSinceCreated ?? 0,
        createdDateFormatted: sb.createdAt ? new Date(sb.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
        skus: Array.from(sb.skus || [])
      }))
    }));

    // Aggregate counts across processed products
    let highRiskCount = 0;
    let lowRiskCount = 0;
    let outOfStockCount = 0;
    let replenishmentNeededCount = 0;

    allProcessedProducts.forEach((p) => {
      if (p.risk === 'OUT_OF_STOCK') {
        outOfStockCount++;
        highRiskCount++;
      } else if (p.risk === 'HIGH') {
        highRiskCount++;
      } else if (p.risk === 'LOW') {
        lowRiskCount++;
      }
      if (p.recommendedReplenishment > 0) replenishmentNeededCount++;
    });

    // Tab-specific Filtering & Priority Sorting
    let tabData = [...allProcessedProducts];

    const riskPriority: Record<string, number> = {
      OUT_OF_STOCK: 1,
      HIGH: 2,
      LOW: 3,
      NO_DEMAND: 4
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
    const storeFilterOptions = (isMasterScope && storeMap.size > 1)
      ? [
          { id: 'all', label: 'All stores' },
          ...Array.from(storeMap.values()).map((s: any) => ({
            id: s.id,
            label: s.isMaster
              ? `${s.label || s.shopDomain} (Master)`
              : (s.label || s.shopDomain)
          }))
        ]
      : [
          {
            id: currentStore.id,
            label: currentStore.isMaster
              ? `${currentStore.label || currentStore.shopDomain} (Master)`
              : (currentStore.label || currentStore.shopDomain)
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
        lowRisk: lowRiskCount,
        outOfStock: outOfStockCount,
        replenishmentNeeded: replenishmentNeededCount,
        productsMonitored: totalMonitoredProducts,
        highRiskThresholdDays: targetStoreIds.length === 1 ? (storeConfigMap.get(targetStoreIds[0])?.supplierLeadTimeDays || 10) : 10
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
