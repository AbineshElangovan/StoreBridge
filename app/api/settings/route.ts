import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/shopify/authenticate";
import { prisma } from "@/lib/db/prisma";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    const storeSetting = await prisma.storeSetting.findUnique({ where: { storeId: store.id } });
    return NextResponse.json({
      success: true,
      settings: {
        lowStockThreshold: store.lowStockThreshold,
        autoSyncEnabled: store.autoSyncEnabled,
        dataRetentionEnabled: storeSetting?.dataRetentionEnabled ?? true,
        notifyLowStock: storeSetting?.notifyLowStock ?? true,
        notifyInventoryUpdate: storeSetting?.notifyInventoryUpdate ?? true,
        notifyPriceUpdate: storeSetting?.notifyPriceUpdate ?? true,
        notifySyncUpdate: storeSetting?.notifySyncUpdate ?? true,
        notifySyncFailure: storeSetting?.notifySyncFailure ?? true,
        notifyStoreUpdate: storeSetting?.notifyStoreUpdate ?? true,
      }
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
    
    const updated = await prisma.store.update({
      where: { id: store.id },
      data: {
        ...(typeof lowStockThreshold === 'number' && { lowStockThreshold }),
        ...(typeof autoSyncEnabled === 'boolean' && { autoSyncEnabled }),
      }
    });

    const storeSettingData: any = {};
    if (typeof dataRetentionEnabled === 'boolean') storeSettingData.dataRetentionEnabled = dataRetentionEnabled;
    if (typeof notifyLowStock === 'boolean') storeSettingData.notifyLowStock = notifyLowStock;
    if (typeof notifyInventoryUpdate === 'boolean') storeSettingData.notifyInventoryUpdate = notifyInventoryUpdate;
    if (typeof notifyPriceUpdate === 'boolean') storeSettingData.notifyPriceUpdate = notifyPriceUpdate;
    if (typeof notifySyncUpdate === 'boolean') storeSettingData.notifySyncUpdate = notifySyncUpdate;
    if (typeof notifySyncFailure === 'boolean') storeSettingData.notifySyncFailure = notifySyncFailure;
    if (typeof notifyStoreUpdate === 'boolean') storeSettingData.notifyStoreUpdate = notifyStoreUpdate;

    let updatedSetting: any = null;
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
      if (upsertErr.message?.includes('Unknown argument')) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "store_settings" ("id", "storeId", "notifyLowStock", "notifyInventoryUpdate", "notifyPriceUpdate", "notifySyncUpdate", "notifySyncFailure", "notifyStoreUpdate", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), '${store.id}', ${notifyLowStock ?? true}, ${notifyInventoryUpdate ?? true}, ${notifyPriceUpdate ?? true}, ${notifySyncUpdate ?? true}, ${notifySyncFailure ?? true}, ${notifyStoreUpdate ?? true}, NOW(), NOW())
          ON CONFLICT ("storeId") DO UPDATE SET
            "notifyLowStock" = EXCLUDED."notifyLowStock",
            "notifyInventoryUpdate" = EXCLUDED."notifyInventoryUpdate",
            "notifyPriceUpdate" = EXCLUDED."notifyPriceUpdate",
            "notifySyncUpdate" = EXCLUDED."notifySyncUpdate",
            "notifySyncFailure" = EXCLUDED."notifySyncFailure",
            "notifyStoreUpdate" = EXCLUDED."notifyStoreUpdate",
            "updatedAt" = NOW();
        `);
        updatedSetting = await prisma.storeSetting.findUnique({ where: { storeId: store.id } });
      } else {
        throw upsertErr;
      }
    }
    
    return NextResponse.json({
      success: true,
      settings: {
        lowStockThreshold: updated.lowStockThreshold,
        autoSyncEnabled: updated.autoSyncEnabled,
        dataRetentionEnabled: updatedSetting?.dataRetentionEnabled ?? true,
        notifyLowStock: updatedSetting?.notifyLowStock ?? (notifyLowStock ?? true),
        notifyInventoryUpdate: updatedSetting?.notifyInventoryUpdate ?? (notifyInventoryUpdate ?? true),
        notifyPriceUpdate: updatedSetting?.notifyPriceUpdate ?? (notifyPriceUpdate ?? true),
        notifySyncUpdate: updatedSetting?.notifySyncUpdate ?? (notifySyncUpdate ?? true),
        notifySyncFailure: updatedSetting?.notifySyncFailure ?? (notifySyncFailure ?? true),
        notifyStoreUpdate: updatedSetting?.notifyStoreUpdate ?? (notifyStoreUpdate ?? true),
      }
    });
  } catch (err: any) {
    console.error("[API:settings] Error updating settings:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
