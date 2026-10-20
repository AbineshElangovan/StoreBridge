import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/shopify/authenticate";
import { prisma } from "@/lib/db/prisma";
import { evaluateForecastStockoutRisks } from "@/services/planning/stockout-risk-service";

export const dynamic = 'force-dynamic';

async function getAuthorizedStores(currentStore: any) {
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

  const ids = Array.from(storeMap.keys());
  let dbStores: any[] = [];
  if (ids.length > 0) {
    try {
      dbStores = await prisma.$queryRawUnsafe(`SELECT "id", "bestSellerThreshold", "deadStockDays", "forecastPeriodDays", "salesHistoryPeriodDays", "supplierLeadTimeDays", "safetyStockDays" FROM "stores" WHERE "id" IN (${ids.map(id => `'${id}'`).join(',')});`);
    } catch (rawErr) {
      // Ignore error if raw query fails
    }
  }
  const dbDataMap = new Map<string, any>();
  dbStores.forEach((row: any) => dbDataMap.set(row.id, row));

  return Array.from(storeMap.values()).map((s: any) => {
    const dbRow = dbDataMap.get(s.id);
    return {
      id: s.id,
      label: s.label || s.shopDomain,
      shopDomain: s.shopDomain,
      logoUrl: s.logoUrl || null,
      isMaster: !!s.isMaster,
      bestSellerThreshold: s.bestSellerThreshold ?? dbRow?.bestSellerThreshold ?? 20,
      deadStockDays: s.deadStockDays ?? dbRow?.deadStockDays ?? 90,
      forecastPeriodDays: s.forecastPeriodDays ?? dbRow?.forecastPeriodDays ?? 7,
      salesHistoryPeriodDays: s.salesHistoryPeriodDays ?? dbRow?.salesHistoryPeriodDays ?? 30,
      supplierLeadTimeDays: s.supplierLeadTimeDays ?? dbRow?.supplierLeadTimeDays ?? 7,
      safetyStockDays: s.safetyStockDays ?? dbRow?.safetyStockDays ?? 3,
      lowStockThreshold: s.lowStockThreshold
    };
  });
}

export async function GET(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    const storeSetting = await prisma.storeSetting.findUnique({ where: { storeId: store.id } });
    const authorizedStores = await getAuthorizedStores(store);

    return NextResponse.json({
      success: true,
      settings: {
        lowStockThreshold: store.lowStockThreshold,
        bestSellerThreshold: store.bestSellerThreshold,
        deadStockDays: store.deadStockDays,
        forecastPeriodDays: (store as any).forecastPeriodDays ?? 7,
        salesHistoryPeriodDays: (store as any).salesHistoryPeriodDays ?? 30,
        supplierLeadTimeDays: (store as any).supplierLeadTimeDays ?? 7,
        safetyStockDays: (store as any).safetyStockDays ?? 3,
        autoSyncEnabled: store.autoSyncEnabled,
        dataRetentionEnabled: storeSetting?.dataRetentionEnabled ?? true,
        notifyLowStock: storeSetting?.notifyLowStock ?? true,
        notifyInventoryUpdate: storeSetting?.notifyInventoryUpdate ?? true,
        notifyPriceUpdate: storeSetting?.notifyPriceUpdate ?? true,
        notifySyncUpdate: storeSetting?.notifySyncUpdate ?? true,
        notifySyncFailure: storeSetting?.notifySyncFailure ?? true,
        notifyStoreUpdate: storeSetting?.notifyStoreUpdate ?? true,
      },
      stores: authorizedStores
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 401 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    const body = await req.json();
    
    const { 
      targetStoreId,
      bestSellerThreshold,
      deadStockDays,
      forecastPeriodDays,
      salesHistoryPeriodDays,
      supplierLeadTimeDays,
      safetyStockDays,
      lowStockThreshold, 
      autoSyncEnabled, 
      dataRetentionEnabled,
      notifyLowStock,
      notifyInventoryUpdate,
      notifyPriceUpdate,
      notifySyncUpdate,
      notifySyncFailure,
      notifyStoreUpdate,
    } = body;
    
    const selectedStoreId = targetStoreId || store.id;

    // Server-side scope verification
    const authorizedStores = await getAuthorizedStores(store);
    const isAuthorized = authorizedStores.some(s => s.id === selectedStoreId);

    if (!isAuthorized) {
      return NextResponse.json({ 
        success: false, 
        error: "Unauthorized store update request" 
      }, { status: 403 });
    }

    // Validate thresholds if provided
    if (bestSellerThreshold !== undefined) {
      const parsed = Number(bestSellerThreshold);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return NextResponse.json({ 
          success: false, 
          error: "Best seller threshold must be an integer greater than 0." 
        }, { status: 400 });
      }
    }

    if (deadStockDays !== undefined) {
      const parsedDs = Number(deadStockDays);
      if (!Number.isInteger(parsedDs) || parsedDs <= 0) {
        return NextResponse.json({ 
          success: false, 
          error: "Dead stock days must be an integer greater than 0." 
        }, { status: 400 });
      }
    }

    if (forecastPeriodDays !== undefined) {
      const parsedFc = Number(forecastPeriodDays);
      if (!Number.isInteger(parsedFc) || parsedFc <= 0) {
        return NextResponse.json({ 
          success: false, 
          error: "Forecast period days must be an integer greater than 0." 
        }, { status: 400 });
      }
    }

    if (salesHistoryPeriodDays !== undefined) {
      const parsedSh = Number(salesHistoryPeriodDays);
      if (!Number.isInteger(parsedSh) || parsedSh <= 0) {
        return NextResponse.json({ 
          success: false, 
          error: "Sales history period days must be an integer greater than 0." 
        }, { status: 400 });
      }
    }

    if (supplierLeadTimeDays !== undefined) {
      const parsedLt = Number(supplierLeadTimeDays);
      if (!Number.isInteger(parsedLt) || parsedLt <= 0) {
        return NextResponse.json({ 
          success: false, 
          error: "Supplier lead time days must be an integer greater than 0." 
        }, { status: 400 });
      }
    }

    if (safetyStockDays !== undefined) {
      const parsedSs = Number(safetyStockDays);
      if (!Number.isInteger(parsedSs) || parsedSs <= 0) {
        return NextResponse.json({ 
          success: false, 
          error: "Safety stock days must be an integer greater than 0." 
        }, { status: 400 });
      }
    }

    if (lowStockThreshold !== undefined) {
      const parsedLow = Number(lowStockThreshold);
      if (!Number.isInteger(parsedLow) || parsedLow <= 0) {
        return NextResponse.json({ 
          success: false, 
          error: "Low stock threshold must be an integer greater than 0." 
        }, { status: 400 });
      }
    }

    // Safely update Store table
    if (
      typeof bestSellerThreshold === 'number' ||
      typeof deadStockDays === 'number' ||
      typeof forecastPeriodDays === 'number' ||
      typeof salesHistoryPeriodDays === 'number' ||
      typeof supplierLeadTimeDays === 'number' ||
      typeof safetyStockDays === 'number' ||
      typeof lowStockThreshold === 'number' ||
      typeof autoSyncEnabled === 'boolean'
    ) {
      try {
        await prisma.store.update({
          where: { id: selectedStoreId },
          data: {
            ...(typeof bestSellerThreshold === 'number' && { bestSellerThreshold }),
            ...(typeof deadStockDays === 'number' && { deadStockDays }),
            ...(typeof forecastPeriodDays === 'number' && { forecastPeriodDays }),
            ...(typeof salesHistoryPeriodDays === 'number' && { salesHistoryPeriodDays }),
            ...(typeof supplierLeadTimeDays === 'number' && { supplierLeadTimeDays }),
            ...(typeof safetyStockDays === 'number' && { safetyStockDays }),
            ...(typeof lowStockThreshold === 'number' && { lowStockThreshold }),
            ...(typeof autoSyncEnabled === 'boolean' && { autoSyncEnabled }),
          }
        });
      } catch (storeUpdateErr: any) {
        console.warn("[API:settings] store.update warning, executing raw SQL fallback:", storeUpdateErr.message);
        const sets: string[] = [];
        if (typeof bestSellerThreshold === 'number') sets.push(`"bestSellerThreshold" = ${bestSellerThreshold}`);
        if (typeof deadStockDays === 'number') sets.push(`"deadStockDays" = ${deadStockDays}`);
        if (typeof forecastPeriodDays === 'number') sets.push(`"forecastPeriodDays" = ${forecastPeriodDays}`);
        if (typeof salesHistoryPeriodDays === 'number') sets.push(`"salesHistoryPeriodDays" = ${salesHistoryPeriodDays}`);
        if (typeof supplierLeadTimeDays === 'number') sets.push(`"supplierLeadTimeDays" = ${supplierLeadTimeDays}`);
        if (typeof safetyStockDays === 'number') sets.push(`"safetyStockDays" = ${safetyStockDays}`);
        if (typeof lowStockThreshold === 'number') sets.push(`"lowStockThreshold" = ${lowStockThreshold}`);
        if (typeof autoSyncEnabled === 'boolean') sets.push(`"autoSyncEnabled" = ${autoSyncEnabled}`);
        if (sets.length > 0) {
          await prisma.$executeRawUnsafe(`UPDATE "stores" SET ${sets.join(', ')} WHERE "id" = '${selectedStoreId}';`);
        }
      }

      // Re-evaluate stockout risk alerts with the newly saved planning config
      evaluateForecastStockoutRisks(selectedStoreId).catch(() => {});
    }

    // Only update StoreSetting if notification or data retention fields were provided
    const hasNotificationSettings = 
      typeof dataRetentionEnabled === 'boolean' ||
      typeof notifyLowStock === 'boolean' ||
      typeof notifyInventoryUpdate === 'boolean' ||
      typeof notifyPriceUpdate === 'boolean' ||
      typeof notifySyncUpdate === 'boolean' ||
      typeof notifySyncFailure === 'boolean' ||
      typeof notifyStoreUpdate === 'boolean';

    let updatedSetting: any = null;
    if (hasNotificationSettings) {
      const storeSettingData: any = {};
      if (typeof dataRetentionEnabled === 'boolean') storeSettingData.dataRetentionEnabled = dataRetentionEnabled;
      if (typeof notifyLowStock === 'boolean') storeSettingData.notifyLowStock = notifyLowStock;
      if (typeof notifyInventoryUpdate === 'boolean') storeSettingData.notifyInventoryUpdate = notifyInventoryUpdate;
      if (typeof notifyPriceUpdate === 'boolean') storeSettingData.notifyPriceUpdate = notifyPriceUpdate;
      if (typeof notifySyncUpdate === 'boolean') storeSettingData.notifySyncUpdate = notifySyncUpdate;
      if (typeof notifySyncFailure === 'boolean') storeSettingData.notifySyncFailure = notifySyncFailure;
      if (typeof notifyStoreUpdate === 'boolean') storeSettingData.notifyStoreUpdate = notifyStoreUpdate;

      try {
        updatedSetting = await prisma.storeSetting.upsert({
          where: { storeId: store.id },
          update: storeSettingData,
          create: {
            storeId: store.id,
            notifyLowStock: typeof notifyLowStock === 'boolean' ? notifyLowStock : true,
            notifyInventoryUpdate: typeof notifyInventoryUpdate === 'boolean' ? notifyInventoryUpdate : true,
            notifyPriceUpdate: typeof notifyPriceUpdate === 'boolean' ? notifyPriceUpdate : true,
            notifySyncUpdate: typeof notifySyncUpdate === 'boolean' ? notifySyncUpdate : true,
            notifySyncFailure: typeof notifySyncFailure === 'boolean' ? notifySyncFailure : true,
            notifyStoreUpdate: typeof notifyStoreUpdate === 'boolean' ? notifyStoreUpdate : true,
            ...storeSettingData,
          }
        });
      } catch (upsertErr: any) {
        console.warn("[API:settings] storeSetting upsert warning:", upsertErr.message);
      }
    } else {
      updatedSetting = await prisma.storeSetting.findUnique({ where: { storeId: store.id } });
    }
    
    const currentStoreRefreshed = await prisma.store.findUnique({ where: { id: store.id } });
    const refreshedStores = await getAuthorizedStores(store);

    return NextResponse.json({
      success: true,
      settings: {
        lowStockThreshold: currentStoreRefreshed?.lowStockThreshold ?? store.lowStockThreshold,
        bestSellerThreshold: currentStoreRefreshed?.bestSellerThreshold ?? store.bestSellerThreshold,
        deadStockDays: (currentStoreRefreshed as any)?.deadStockDays ?? store.deadStockDays,
        autoSyncEnabled: currentStoreRefreshed?.autoSyncEnabled ?? store.autoSyncEnabled,
        dataRetentionEnabled: updatedSetting?.dataRetentionEnabled ?? true,
        notifyLowStock: updatedSetting?.notifyLowStock ?? true,
        notifyInventoryUpdate: updatedSetting?.notifyInventoryUpdate ?? true,
        notifyPriceUpdate: updatedSetting?.notifyPriceUpdate ?? true,
        notifySyncUpdate: updatedSetting?.notifySyncUpdate ?? true,
        notifySyncFailure: updatedSetting?.notifySyncFailure ?? true,
        notifyStoreUpdate: updatedSetting?.notifyStoreUpdate ?? true,
      },
      stores: refreshedStores
    });
  } catch (err: any) {
    console.error("[API:settings] Error updating settings:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
