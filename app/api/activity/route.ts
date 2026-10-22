import { NextRequest, NextResponse } from "next/server";
import { authenticate, handleApiError } from "@/lib/shopify/authenticate";
import { prisma } from "@/lib/db/prisma";
import { cleanupExpiredActivityLogs } from "@/lib/services/activityRetention";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const collection = searchParams.get('collection') || '';
    const filterStoreId = searchParams.get('storeId') || ''; 
    const dateRange = searchParams.get('dateRange') || 'all';
    const isExport = searchParams.get('export') === 'true';
    
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '15', 10);
    const skip = (page - 1) * limit;

    let allowedStoreIds: string[] = [];
    let isMultiStore = false;

    // 1. Find the Master Store ID for this network
    let masterStoreId = store.id;
    if (!store.isMaster) {
      const parentConnection = await (prisma as any).storeConnection.findFirst({
         where: { targetStoreId: store.id }
      });
      if (parentConnection) {
        masterStoreId = parentConnection.sourceStoreId;
      }
    }

    // 2. Find ALL stores in this network (Master + all connected stores)
    const connections = await (prisma as any).storeConnection.findMany({
      where: { sourceStoreId: masterStoreId }
    });
    
    let storeIdsToQuery: string[] = [];
    if (store.isMaster) {
      allowedStoreIds = [masterStoreId, ...connections.map((c: any) => c.targetStoreId)];
      isMultiStore = connections.length > 0;
      storeIdsToQuery = allowedStoreIds;
    } else {
      allowedStoreIds = [store.id];
      isMultiStore = false;
      storeIdsToQuery = [store.id];
    }
    if (filterStoreId && filterStoreId !== 'all') {
      if (allowedStoreIds.includes(filterStoreId)) {
        storeIdsToQuery = [filterStoreId];
      }
    }

    const andConditions: any[] = [
      { storeId: { in: storeIdsToQuery } }
    ];

    if (search && search.trim()) {
      const q = search.trim();
      andConditions.push({
        OR: [
          { productTitle: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ]
      });
    }

    if (collection && collection !== 'all' && collection.trim()) {
      const col = collection.trim();
      // Find all products in ProductCache that strictly belong to this collection
      const matchingCaches = await prisma.productCache.findMany({
        where: {
          storeId: { in: allowedStoreIds },
          collections: {
            some: {
              collection: {
                title: { equals: col, mode: 'insensitive' }
              }
            }
          }
        },
        select: { shopifyProductId: true, sku: true, title: true }
      });

      const colSkus = Array.from(new Set(matchingCaches.map((c: any) => c.sku).filter(Boolean)));
      const colPids = Array.from(new Set(matchingCaches.map((c: any) => c.shopifyProductId).filter(Boolean)));
      const colRawPids = colPids.map((p: string) => p.replace('gid://shopify/Product/', ''));

      const colOrConditions: any[] = [
        { collection: { equals: col, mode: 'insensitive' } }
      ];

      if (colSkus.length > 0) {
        colOrConditions.push({ sku: { in: colSkus } });
      }
      if (colPids.length > 0 || colRawPids.length > 0) {
        colOrConditions.push({ productId: { in: [...colPids, ...colRawPids] } });
      }

      andConditions.push({ OR: colOrConditions });
    }

    if (dateRange && dateRange !== 'all') {
      let startDate: Date;
      if (dateRange === 'today') {
        // Last 24 hours (ensures timezone-safe matching between local browser and UTC server)
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      } else if (dateRange === 'week') {
        // Last 7 days
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateRange === 'month') {
        // Last 30 days
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      } else {
        startDate = new Date(0);
      }
      andConditions.push({ createdAt: { gte: startDate } });
    }

    const whereClause: any = andConditions.length === 1 ? andConditions[0] : { AND: andConditions };

    // Auto-delete logs older than 90 days for all stores with data retention enabled
    cleanupExpiredActivityLogs().catch((err) => {
      console.error("[Activity API] Error cleaning up old logs:", err);
    });

    const [activities, totalActivities] = await Promise.all([
      prisma.activityLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
          store: {
            select: { id: true, label: true, shopDomain: true, isMaster: true }
          }
        },
        take: isExport ? undefined : limit,
        skip: isExport ? undefined : skip
      }),
      prisma.activityLog.count({ where: whereClause })
    ]);
    
    // Attach product images from ProductCache across entire catalog (multi-tier resolution: ID, SKU, Title, Collection, Store)
    const allCaches = await prisma.productCache.findMany({
      where: {
        imageUrl: { not: null }
      },
      select: {
        shopifyProductId: true,
        sku: true,
        title: true,
        imageUrl: true,
        storeId: true,
        tags: true,
        collections: {
          select: {
            collection: {
              select: { title: true }
            }
          }
        }
      }
    });

    const cacheByProdId = new Map<string, string>();
    const cacheBySku = new Map<string, string>();
    const cacheByTitle = new Map<string, string>();
    const cacheByStoreAndCol = new Map<string, string>(); // `${storeId}_${normalizedCol}` -> img
    const cacheByCol = new Map<string, string>(); // `${normalizedCol}` -> img
    const cacheByStore = new Map<string, string>(); // `${storeId}` -> img

    allCaches.forEach((c: any) => {
      if (!c.imageUrl) return;
      const rawId = c.shopifyProductId.replace('gid://shopify/Product/', '');
      const gid = c.shopifyProductId.startsWith('gid://') ? c.shopifyProductId : `gid://shopify/Product/${c.shopifyProductId}`;

      cacheByProdId.set(rawId, c.imageUrl);
      cacheByProdId.set(gid, c.imageUrl);
      if (c.sku) cacheBySku.set(c.sku.toLowerCase(), c.imageUrl);
      if (c.title) cacheByTitle.set(c.title.toLowerCase(), c.imageUrl);

      if (!cacheByStore.has(c.storeId)) {
        cacheByStore.set(c.storeId, c.imageUrl);
      }

      const colTitles: string[] = [];
      if (c.collections) {
        c.collections.forEach((cp: any) => {
          if (cp.collection?.title) colTitles.push(cp.collection.title.toLowerCase());
        });
      }
      if (c.tags) {
        c.tags.split(',').forEach((t: string) => {
          if (t.trim()) colTitles.push(t.trim().toLowerCase());
        });
      }

      colTitles.forEach((col) => {
        const storeColKey = `${c.storeId}_${col}`;
        if (!cacheByStoreAndCol.has(storeColKey)) {
          cacheByStoreAndCol.set(storeColKey, c.imageUrl);
        }
        if (!cacheByCol.has(col)) {
          cacheByCol.set(col, c.imageUrl);
        }
      });
    });

    const enrichedActivities = activities.map((a: any) => {
      let resolvedImg = a.imageUrl || null;

      // Tier 1: Direct match by productId
      if (!resolvedImg && a.productId) {
        const rawId = a.productId.replace('gid://shopify/Product/', '');
        resolvedImg = cacheByProdId.get(rawId) || cacheByProdId.get(a.productId) || null;
      }

      // Tier 2: Match by SKU
      if (!resolvedImg && a.sku) {
        resolvedImg = cacheBySku.get(a.sku.toLowerCase()) || null;
      }

      // Tier 3: Match by productTitle
      if (!resolvedImg && a.productTitle) {
        resolvedImg = cacheByTitle.get(a.productTitle.toLowerCase()) || null;
      }

      // Tier 4: Collection match (e.g. for Price Adjustment or categorized batch actions)
      if (!resolvedImg) {
        const colString = a.collection || (a.productTitle?.includes('Price Adjustment (') ? a.productTitle.replace('Price Adjustment (', '').replace(')', '') : '');
        if (colString) {
          const cols = colString.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
          for (const col of cols) {
            resolvedImg = cacheByStoreAndCol.get(`${a.storeId}_${col}`) || cacheByCol.get(col);
            if (resolvedImg) break;
          }
        }
      }

      // Tier 5: Store fallback (representative store product image)
      if (!resolvedImg && a.storeId) {
        resolvedImg = cacheByStore.get(a.storeId) || null;
      }

      return {
        ...a,
        imageUrl: resolvedImg
      };
    });

    // For bulk exports, deduplicate any identical log entries created in the same 60-second window.
    // For paginated table requests, activities are fetched from the database directly matching the exact limit.
    let responseActivities = enrichedActivities;
    if (isExport) {
      const seenMap = new Set<string>();
      responseActivities = enrichedActivities.filter((a: any) => {
        const timeBucket = Math.floor(new Date(a.createdAt).getTime() / 60000);
        const key = `${a.storeId}_${a.eventType}_${a.productTitle}_${a.sku || ''}_${timeBucket}`;
        if (seenMap.has(key)) return false;
        seenMap.add(key);
        return true;
      });
    }
    
    let storeOptions: any[] = [];
    if (isMultiStore) {
        const stores = await prisma.store.findMany({
            where: { id: { in: allowedStoreIds } },
            select: { id: true, label: true, shopDomain: true }
        });
        storeOptions = stores.map((s: any) => ({
            label: s.label || s.shopDomain,
            value: s.id
        }));
    }

    const collections = await prisma.collection.findMany({
      where: { storeId: { in: allowedStoreIds } },
      select: { title: true },
      distinct: ['title']
    });
    
    const collectionOptions = collections
      .filter((c: any) => c.title)
      .map((c: any) => ({ label: c.title, value: c.title }));

    return NextResponse.json({
      success: true,
      activities: responseActivities,
      pagination: {
        total: totalActivities,
        page,
        limit,
        totalPages: Math.ceil(totalActivities / limit)
      },
      currentStoreId: store.id,
      isMaster: store.isMaster,
      isMultiStore,
      storeOptions,
      collectionOptions,
      allowedStoreIds: storeIdsToQuery
    });

  } catch (err: any) {
    console.error("[Activity API] Error:", err);
    return NextResponse.json({ success: false, error: err.message || err.toString() }, { status: 500 });
  }
}
