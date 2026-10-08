import { prisma } from '@/lib/db/prisma';
import { NotificationChannel, NotificationJobStatus } from '@prisma/client';
import { EmailNotificationService } from './email-notification-service';
import { safeDecrypt } from '@/lib/utils/encryption';

export class CustomerNotificationService {
  /**
   * Process all pending or retriable notification jobs for a specific store (or global).
   */
  static async processPendingJobs(storeId?: string, limit = 25) {
    const where: any = {
      status: NotificationJobStatus.PENDING,
      ...(storeId && { storeId }),
    };

    const jobs = await prisma.notificationJob.findMany({
      where,
      include: {
        store: true,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    if (jobs.length === 0) return { processed: 0, sent: 0, failed: 0 };

    let sentCount = 0;
    let failedCount = 0;

    for (const job of jobs) {
      // 1. Mark as PROCESSING and increment attempts
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          status: NotificationJobStatus.PROCESSING,
          attempts: { increment: 1 },
        },
      });

      const storeName = job.store.label || job.store.shopDomain;
      let sendResult: { success: boolean; error?: string } = { success: false, error: 'Unknown channel' };

      let productPrice: string | undefined;
      let finalImageUrl = job.imageUrl;
      try {
        const cleanVarId = job.shopifyVariantId.replace(/\D/g, '');
        let cached = await prisma.productCache.findFirst({
          where: {
            storeId: job.storeId,
            OR: [
              { shopifyVariantId: job.shopifyVariantId },
              { shopifyVariantId: `gid://shopify/ProductVariant/${cleanVarId}` },
              { shopifyVariantId: cleanVarId },
            ],
          },
        });
        if (cached?.price) productPrice = `₹${cached.price}`;
        if (!finalImageUrl && cached?.imageUrl) finalImageUrl = cached.imageUrl;

        if (!finalImageUrl) {
          const storeFallback = await prisma.productCache.findFirst({
            where: { storeId: job.storeId, imageUrl: { not: null } },
          });
          if (storeFallback?.imageUrl) finalImageUrl = storeFallback.imageUrl;
        }
      } catch (err) {
        console.warn('[CustomerNotificationService:ProductLookup:Error]', err);
      }

      const decryptedEmail = safeDecrypt(job.customerEmail);

      if (job.channel === NotificationChannel.EMAIL && decryptedEmail) {
        sendResult = await EmailNotificationService.sendBackInStockEmail({
          to: decryptedEmail,
          productTitle: job.productTitle,
          variantTitle: job.variantTitle,
          productUrl: job.productUrl,
          imageUrl: finalImageUrl,
          price: productPrice,
          storeName,
        });
      } else {
        // Channel is not EMAIL or phone lead only
        sendResult = { success: true };
      }

      // 2. Transition status based on dispatch result
      if (sendResult.success) {
        sentCount++;
        await prisma.notificationJob.update({
          where: { id: job.id },
          data: {
            status: NotificationJobStatus.SENT,
            sentAt: new Date(),
            lastError: null,
          },
        });
      } else {
        failedCount++;
        const isFinal = job.attempts + 1 >= job.maxAttempts;
        await prisma.notificationJob.update({
          where: { id: job.id },
          data: {
            status: isFinal ? NotificationJobStatus.FAILED : NotificationJobStatus.PENDING,
            lastError: sendResult.error || 'Dispatch error',
          },
        });
      }
    }

    return { processed: jobs.length, sent: sentCount, failed: failedCount };
  }
}
