import { prisma } from '@/lib/db/prisma';

/**
 * Automatically purges activity logs older than 90 days for all stores
 * where dataRetentionEnabled is true (default).
 */
export async function cleanupExpiredActivityLogs(): Promise<number> {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Find stores that explicitly disabled data retention
    const disabledSettings = await prisma.storeSetting.findMany({
      where: { dataRetentionEnabled: false },
      select: { storeId: true }
    });
    const disabledStoreIds = disabledSettings.map(s => s.storeId);

    const result = await prisma.activityLog.deleteMany({
      where: {
        createdAt: { lt: ninetyDaysAgo },
        storeId: { notIn: disabledStoreIds }
      }
    });

    if (result.count > 0) {
      console.log(`[Activity Retention] Successfully purged ${result.count} activity log(s) older than 90 days.`);
    }

    return result.count;
  } catch (err: any) {
    console.error('[Activity Retention] Error during 90-day activity log cleanup:', err?.message || err);
    return 0;
  }
}
