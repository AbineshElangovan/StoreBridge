import { prisma } from '@/lib/db/prisma';

export interface RetentionCleanupResult {
  activityLogs: number;
  notifications: number;
  syncLogs: number;
  importHistories: number;
  notificationJobs: number;
  totalPurged: number;
}

/**
 * Automatically purges activity logs, notifications, sync logs, import histories,
 * and finished notification jobs older than 90 days for all stores
 * where dataRetentionEnabled is true (default).
 */
export async function cleanupExpiredActivityLogs(): Promise<RetentionCleanupResult> {
  const summary: RetentionCleanupResult = {
    activityLogs: 0,
    notifications: 0,
    syncLogs: 0,
    importHistories: 0,
    notificationJobs: 0,
    totalPurged: 0,
  };

  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Find stores that explicitly disabled data retention
    const disabledSettings = await prisma.storeSetting.findMany({
      where: { dataRetentionEnabled: false },
      select: { storeId: true }
    });
    const disabledStoreIds = disabledSettings.map(s => s.storeId);

    // 1. Purge Activity Logs older than 90 days
    const actResult = await prisma.activityLog.deleteMany({
      where: {
        createdAt: { lt: ninetyDaysAgo },
        storeId: { notIn: disabledStoreIds }
      }
    });
    summary.activityLogs = actResult.count;

    // 2. Purge In-App Notifications older than 90 days
    const notifResult = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: ninetyDaysAgo },
        recipientStoreId: { notIn: disabledStoreIds }
      }
    });
    summary.notifications = notifResult.count;

    // 3. Purge Completed / Expired Sync Logs older than 90 days
    const syncResult = await prisma.syncLog.deleteMany({
      where: {
        createdAt: { lt: ninetyDaysAgo },
        sourceStoreId: { notIn: disabledStoreIds }
      }
    });
    summary.syncLogs = syncResult.count;

    // 4. Purge Completed Import History older than 90 days
    const importResult = await prisma.importHistory.deleteMany({
      where: {
        createdAt: { lt: ninetyDaysAgo },
        storeId: { notIn: disabledStoreIds }
      }
    });
    summary.importHistories = importResult.count;

    // 5. Purge Completed / Failed Customer Notification Jobs older than 90 days
    const jobResult = await prisma.notificationJob.deleteMany({
      where: {
        createdAt: { lt: ninetyDaysAgo },
        storeId: { notIn: disabledStoreIds },
        status: { in: ['SENT', 'FAILED'] }
      }
    });
    summary.notificationJobs = jobResult.count;

    summary.totalPurged =
      summary.activityLogs +
      summary.notifications +
      summary.syncLogs +
      summary.importHistories +
      summary.notificationJobs;

    if (summary.totalPurged > 0) {
      console.log(`[Data Retention] Successfully purged ${summary.totalPurged} item(s) older than 90 days:`, summary);
    }

    return summary;
  } catch (err: any) {
    console.error('[Data Retention] Error during 90-day retention cleanup:', err?.message || err);
    return summary;
  }
}

