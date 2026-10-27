import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/shopify/authenticate";
import { prisma } from "@/lib/db/prisma";
import { evaluateForecastStockoutRisks } from "@/services/planning/stockout-risk-service";

export const dynamic = 'force-dynamic';

async function getAuthorizedStores(currentStore: any, isCurrentStoreStandalone: boolean = false) {
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
    const isStandalone = s.id === currentStore.id ? isCurrentStoreStandalone : (!s.isMaster);
    return {
      id: s.id,
      label: s.label || s.shopDomain,
      shopDomain: s.shopDomain,
      logoUrl: s.logoUrl || null,
      isMaster: !!s.isMaster,
      isStandalone,
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
    const { store, isStandalone } = await authenticate(req);
    const authorizedStores = await getAuthorizedStores(store, isStandalone);
    const targetStoreIdParam = req.nextUrl.searchParams.get('storeId');
    const selectedStoreId = (targetStoreIdParam && authorizedStores.some(s => s.id === targetStoreIdParam))
      ? targetStoreIdParam
      : store.id;

    const currentStoreDb = selectedStoreId === store.id ? store : ((await prisma.store.findUnique({ where: { id: selectedStoreId } })) || store);
    const storeSetting = await prisma.storeSetting.findUnique({ where: { storeId: selectedStoreId } });

    // Fetch customer experience & delivery channel notification settings
    let notifyEmail = true;
    let notifyWhatsApp = true;
    let notifyWaitlist = true;
    let notifyBackInStock = true;
    let notifyPreorder = true;
    let channelInApp = true;

    try {
      const notifyMe = await (prisma as any).notifyMeSetting.findUnique({ where: { storeId: selectedStoreId } });
      if (notifyMe) {
        if (typeof notifyMe.notifyEmail === 'boolean') notifyEmail = notifyMe.notifyEmail;
        if (typeof notifyMe.notifyWhatsApp === 'boolean') notifyWhatsApp = notifyMe.notifyWhatsApp;
        if (typeof notifyMe.enabled === 'boolean') {
          notifyWaitlist = notifyMe.enabled;
          notifyBackInStock = notifyMe.enabled;
        }
      }
    } catch (nmErr) {
      console.warn("[API:settings] notifyMe lookup warning:", nmErr);
    }

    try {
      const preorder = await (prisma as any).preorderConfig.findFirst({
        where: { storeId: selectedStoreId, shopifyProductId: null, shopifyVariantId: null }
      });
      if (preorder && typeof preorder.enabled === 'boolean') {
        notifyPreorder = preorder.enabled;
      }
    } catch (poErr) {
      console.warn("[API:settings] preorder lookup warning:", poErr);
    }

    return NextResponse.json({
      success: true,
      settings: {
        lowStockThreshold: currentStoreDb.lowStockThreshold,
        bestSellerThreshold: currentStoreDb.bestSellerThreshold,
        deadStockDays: currentStoreDb.deadStockDays,
        forecastPeriodDays: (currentStoreDb as any).forecastPeriodDays ?? 7,
        salesHistoryPeriodDays: (currentStoreDb as any).salesHistoryPeriodDays ?? 30,
        supplierLeadTimeDays: (currentStoreDb as any).supplierLeadTimeDays ?? 7,
        safetyStockDays: (currentStoreDb as any).safetyStockDays ?? 3,
        autoSyncEnabled: currentStoreDb.autoSyncEnabled,
        dataRetentionEnabled: storeSetting?.dataRetentionEnabled ?? true,
        notifyLowStock: storeSetting?.notifyLowStock ?? true,
        notifyInventoryUpdate: storeSetting?.notifyInventoryUpdate ?? true,
        notifyPriceUpdate: storeSetting?.notifyPriceUpdate ?? true,
        notifySyncUpdate: storeSetting?.notifySyncUpdate ?? true,
        notifySyncFailure: storeSetting?.notifySyncFailure ?? true,
        notifyStoreUpdate: storeSetting?.notifyStoreUpdate ?? true,
        notifyPreorder,
        notifyWaitlist,
        notifyBackInStock,
        channelInApp,
        notifyEmail,
        notifyWhatsApp,
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
      notifyPreorder,
      notifyWaitlist,
      notifyBackInStock,
      channelInApp,
      notifyEmail,
      notifyWhatsApp,
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
          where: { storeId: selectedStoreId },
          update: storeSettingData,
          create: {
            storeId: selectedStoreId,
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
      updatedSetting = await prisma.storeSetting.findUnique({ where: { storeId: selectedStoreId } });
    }

    // Persist Customer Experience & Channel Notification Settings
    let currentNotifyEmail = true;
    let currentNotifyWhatsApp = true;
    let currentNotifyWaitlist = true;
    let currentNotifyBackInStock = true;
    let currentNotifyPreorder = true;
    let currentChannelInApp = typeof channelInApp === 'boolean' ? channelInApp : true;

    if (
      typeof notifyEmail === 'boolean' ||
      typeof notifyWhatsApp === 'boolean' ||
      typeof notifyWaitlist === 'boolean' ||
      typeof notifyBackInStock === 'boolean'
    ) {
      try {
        const updateData: any = {};
        if (typeof notifyEmail === 'boolean') updateData.notifyEmail = notifyEmail;
        if (typeof notifyWhatsApp === 'boolean') updateData.notifyWhatsApp = notifyWhatsApp;
        if (typeof notifyWaitlist === 'boolean') updateData.enabled = notifyWaitlist;
        else if (typeof notifyBackInStock === 'boolean') updateData.enabled = notifyBackInStock;

        const updatedNotifyMe = await (prisma as any).notifyMeSetting.upsert({
          where: { storeId: selectedStoreId },
          update: updateData,
          create: {
            storeId: selectedStoreId,
            enabled: updateData.enabled ?? true,
            notifyEmail: typeof notifyEmail === 'boolean' ? notifyEmail : true,
            notifyWhatsApp: typeof notifyWhatsApp === 'boolean' ? notifyWhatsApp : true,
          }
        });

        if (updatedNotifyMe) {
          currentNotifyEmail = updatedNotifyMe.notifyEmail ?? true;
          currentNotifyWhatsApp = updatedNotifyMe.notifyWhatsApp ?? true;
          currentNotifyWaitlist = updatedNotifyMe.enabled ?? true;
          currentNotifyBackInStock = updatedNotifyMe.enabled ?? true;
        }
      } catch (nmErr: any) {
        console.warn("[API:settings] notifyMeSetting update warning:", nmErr.message);
      }
    } else {
      try {
        const existingNotifyMe = await (prisma as any).notifyMeSetting.findUnique({ where: { storeId: selectedStoreId } });
        if (existingNotifyMe) {
          currentNotifyEmail = existingNotifyMe.notifyEmail ?? true;
          currentNotifyWhatsApp = existingNotifyMe.notifyWhatsApp ?? true;
          currentNotifyWaitlist = existingNotifyMe.enabled ?? true;
          currentNotifyBackInStock = existingNotifyMe.enabled ?? true;
        }
      } catch {}
    }

    if (typeof notifyPreorder === 'boolean') {
      try {
        const globalPreorder = await (prisma as any).preorderConfig.findFirst({
          where: { storeId: selectedStoreId, shopifyProductId: null, shopifyVariantId: null }
        });
        if (globalPreorder) {
          const updatedPo = await (prisma as any).preorderConfig.update({
            where: { id: globalPreorder.id },
            data: { enabled: notifyPreorder }
          });
          currentNotifyPreorder = updatedPo.enabled ?? true;
        } else {
          const newPo = await (prisma as any).preorderConfig.create({
            data: {
              storeId: selectedStoreId,
              enabled: notifyPreorder,
            }
          });
          currentNotifyPreorder = newPo.enabled ?? true;
        }
      } catch (poErr: any) {
        console.warn("[API:settings] preorderConfig update warning:", poErr.message);
      }
    } else {
      try {
        const existingPo = await (prisma as any).preorderConfig.findFirst({
          where: { storeId: selectedStoreId, shopifyProductId: null, shopifyVariantId: null }
        });
        if (existingPo) {
          currentNotifyPreorder = existingPo.enabled ?? true;
        }
      } catch {}
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
        notifyPreorder: currentNotifyPreorder,
        notifyWaitlist: currentNotifyWaitlist,
        notifyBackInStock: currentNotifyBackInStock,
        channelInApp: currentChannelInApp,
        notifyEmail: currentNotifyEmail,
        notifyWhatsApp: currentNotifyWhatsApp,
      },
      stores: refreshedStores
    });
  } catch (err: any) {
    console.error("[API:settings] Error updating settings:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
