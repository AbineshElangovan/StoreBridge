import { NextRequest, NextResponse } from "next/server";
import { authenticate, handleApiError } from "@/lib/shopify/authenticate";
import { prisma } from "@/lib/db/prisma";
import { pushProductsToDestinations } from "@/services/shopify/push-sync";

export async function POST(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    const body = await req.json();
    const { selectedTargetStoreIds } = body;

    if (!selectedTargetStoreIds || !Array.isArray(selectedTargetStoreIds) || selectedTargetStoreIds.length === 0) {
      return NextResponse.json({ success: false, error: "No target stores selected" }, { status: 400 });
    }

    // Verify connections exist and belong to the authenticated store
    const connections = await prisma.storeConnection.findMany({
      where: {
        sourceStoreId: store.id,
        targetStoreId: { in: selectedTargetStoreIds }
      }
    });

    if (connections.length !== selectedTargetStoreIds.length) {
      return NextResponse.json({ success: false, error: "One or more selected stores are not explicitly connected to your store." }, { status: 400 });
    }

    // Fast Pre-Check: Are target stores already in sync?
    const sourceCaches = await prisma.productCache.findMany({
      where: { storeId: store.id },
      select: { sku: true, inventoryQuantity: true }
    });

    let isAlreadySynced = false;
    if (sourceCaches.length > 0) {
      let allTargetsMatched = true;
      for (const targetId of selectedTargetStoreIds) {
        const targetCaches = await prisma.productCache.findMany({
          where: { storeId: targetId },
          select: { sku: true, inventoryQuantity: true }
        });

        const targetMapBySku = new Map(targetCaches.filter(c => c.sku).map(c => [c.sku, c.inventoryQuantity]));
        const sourceSkus = sourceCaches.map(c => c.sku).filter(Boolean);

        if (sourceSkus.length === 0 || targetCaches.length < sourceCaches.length) {
          allTargetsMatched = false;
          break;
        }

        const hasAllSkusAndQuantities = sourceSkus.every(sku => {
          const targetQty = targetMapBySku.get(sku as string);
          const sourceItem = sourceCaches.find(c => c.sku === sku);
          return targetQty !== undefined && targetQty === sourceItem?.inventoryQuantity;
        });

        if (!hasAllSkusAndQuantities) {
          allTargetsMatched = false;
          break;
        }
      }
      isAlreadySynced = allTargetsMatched;
    }

    if (isAlreadySynced) {
      console.log("[Manual Sync API] Target stores are ALREADY in sync. Skipping sync process.");
      return NextResponse.json({
        success: true,
        isAlreadySynced: true,
        message: "⚠️ Selected stores are already fully in sync! No changes were needed."
      });
    }

    // Stores need sync: run in background to prevent HTTP timeouts
    setTimeout(async () => {
      try {
        console.log("[Manual Sync API] Starting background push sync for", selectedTargetStoreIds.length, "stores");
        await pushProductsToDestinations(store.id, selectedTargetStoreIds);
      } catch (err: any) {
        console.error("[Manual Sync API] Background Error:", err);
      }
    }, 50);

    return NextResponse.json({
      success: true,
      isAlreadySynced: false,
      message: "Synchronization initiated successfully!"
    });
  } catch (err: any) {
    console.error("[Manual Sync API] POST Error:", err.message);
    return handleApiError(err);
  }
}
