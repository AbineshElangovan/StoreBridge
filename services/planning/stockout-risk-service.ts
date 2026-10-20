import { prisma } from '@/lib/db/prisma';
import { createNotification } from '@/services/notification-service';

/**
 * Checks all active products for a store (or all stores) and triggers
 * an automated STOCKOUT_RISK notification if a product is forecasted to run out of stock
 * within the store's configured forecastPeriodDays.
 */
export async function evaluateForecastStockoutRisks(targetStoreId?: string): Promise<number> {
  let createdCount = 0;
  try {
    const storeWhere: any = targetStoreId
      ? { id: targetStoreId, isActive: true }
      : { isActive: true };

    const stores = await prisma.store.findMany({
      where: storeWhere,
      select: {
        id: true,
        label: true,
        shopDomain: true,
        isMaster: true,
        forecastPeriodDays: true,
        salesHistoryPeriodDays: true,
        lowStockThreshold: true,
      }
    });

    for (const store of stores) {
      const forecastDays = store.forecastPeriodDays || 7;
      const historyDays = Math.max(1, store.salesHistoryPeriodDays || 30);
      const historyCutoff = new Date(Date.now() - historyDays * 24 * 60 * 60 * 1000);

      // 1. Fetch recent sales from ActivityLog for this store
      const salesLogs = await prisma.activityLog.findMany({
        where: {
          storeId: store.id,
          eventType: 'SOLD',
          createdAt: { gte: historyCutoff }
        },
        select: {
          productTitle: true,
          sku: true,
          quantity: true
        }
      });

      const salesMap = new Map<string, number>();
      for (const log of salesLogs) {
        const qty = log.quantity || 1;
        if (log.productTitle) {
          const tKey = log.productTitle.trim();
          salesMap.set(tKey, (salesMap.get(tKey) || 0) + qty);
        }
        if (log.sku) {
          const sKey = `sku:${log.sku.trim()}`;
          salesMap.set(sKey, (salesMap.get(sKey) || 0) + qty);
        }
      }

      // 2. Fetch all products in cache for this store
      const products = await prisma.productCache.findMany({
        where: { storeId: store.id },
        select: {
          id: true,
          shopifyProductId: true,
          title: true,
          sku: true,
          inventoryQuantity: true,
        }
      });

      // 3. Evaluate each product against the forecastPeriodDays
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      for (const p of products) {
        const currentStock = Math.max(0, p.inventoryQuantity || 0);
        // Only evaluate items that are currently in stock (> 0)
        if (currentStock === 0) continue;

        const titleSales = p.title ? salesMap.get(p.title.trim()) : 0;
        const skuSales = p.sku ? salesMap.get(`sku:${p.sku.trim()}`) : 0;
        const unitsSold = (titleSales && titleSales > 0) ? titleSales : (skuSales || titleSales || 0);
        const avgDailySales = unitsSold / historyDays;

        if (avgDailySales <= 0) continue;

        const expectedStockoutDays = Math.floor(currentStock / avgDailySales);

        // If expected stockout falls within the store's forecast period
        if (expectedStockoutDays <= forecastDays) {
          // Check if a STOCKOUT_RISK notification was already generated in the last 24 hours (anti-spam)
          const cleanPid = p.shopifyProductId ? p.shopifyProductId.replace(/^gid:\/\/shopify\/Product\//, '') : '';
          const existingNotif = await prisma.notification.findFirst({
            where: {
              recipientStoreId: store.id,
              type: 'STOCKOUT_RISK',
              createdAt: { gte: oneDayAgo },
              OR: [
                { productId: p.shopifyProductId },
                ...(cleanPid ? [{ productId: cleanPid }] : []),
                { productTitle: p.title }
              ]
            }
          });

          if (!existingNotif) {
            const notif = await createNotification({
              recipientStoreId: store.id,
              type: 'STOCKOUT_RISK',
              title: 'Forecast Stockout Alert',
              message: `${p.title} is projected to run out of stock in ${expectedStockoutDays} days (Stock: ${currentStock}, Velocity: ${avgDailySales.toFixed(1)}/day, Forecast Period: ${forecastDays} days).`,
              productId: p.shopifyProductId,
              productTitle: p.title,
              sourceStoreId: store.id,
              targetStoreId: store.id,
              metadata: {
                currentStock,
                avgDailySales: Number(avgDailySales.toFixed(2)),
                expectedStockoutDays,
                forecastDays
              }
            });

            // Only notify Master Store IF this store is actually connected via StoreConnection (NEVER if standalone!)
            if (!store.isMaster) {
              const connection = await prisma.storeConnection.findFirst({
                where: { targetStoreId: store.id },
                include: { sourceStore: true }
              });

              if (connection && connection.sourceStore && connection.sourceStore.isActive) {
                const masterStore = connection.sourceStore;
                await createNotification({
                  recipientStoreId: masterStore.id,
                  type: 'STOCKOUT_RISK',
                  title: 'Forecast Stockout Alert',
                  message: `${store.label || store.shopDomain}: ${p.title} is projected to run out of stock in ${expectedStockoutDays} days (Stock: ${currentStock}, Velocity: ${avgDailySales.toFixed(1)}/day, Forecast Period: ${forecastDays} days).`,
                  productId: p.shopifyProductId,
                  productTitle: p.title,
                  sourceStoreId: store.id,
                  targetStoreId: masterStore.id,
                  metadata: {
                    currentStock,
                    avgDailySales: Number(avgDailySales.toFixed(2)),
                    expectedStockoutDays,
                    forecastDays
                  }
                });
              }
            }

            if (notif) {
              createdCount++;
            }
          }
        }
      }
    }
  } catch (error: any) {
    console.error('[StockoutRiskService] Error evaluating forecast stockout risks:', error?.message || error);
  }
  return createdCount;
}
