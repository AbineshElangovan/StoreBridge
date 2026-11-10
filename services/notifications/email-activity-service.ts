import { prisma } from '@/lib/db/prisma';
import { EmailActivityStatus } from '@prisma/client';
import { safeEncrypt, safeDecrypt } from '@/lib/utils/encryption';

export interface RecordQueuedEmailParams {
  merchantId?: string | null;
  storeId?: string | null;
  shopDomain: string;
  recipient: string;
  emailType?: string;
  relatedEntityId?: string | null;
  relatedEntityType?: string | null;
  metadata?: Record<string, any> | null;
}

export interface SesDeliveryEventDetails {
  timestamp?: string;
  smtpResponse?: string;
  recipients?: string[];
  raw?: any;
}

export interface SesBounceEventDetails {
  bounceType?: string;
  bounceSubType?: string;
  diagnostics?: string;
  bouncedRecipients?: any[];
  raw?: any;
}

// Sensitive field blacklist to scrub from email metadata
const SENSITIVE_FIELDS = new Set([
  'accesstoken',
  'refreshtoken',
  'token',
  'secret',
  'clientsecret',
  'shopify_api_secret',
  'password',
  'encryptionkey',
  'ses_secret_access_key',
  'ses_access_key_id',
  'authorization',
  'cookie',
  'sessiontoken',
  'apikey',
  'api_key',
  'privatekey',
  'secretkey',
]);

/**
 * Scrubs credentials and secrets from email metadata.
 */
function sanitizeEmailMetadata(data: any, depth = 0): any {
  if (data === null || data === undefined) return data;
  if (depth > 5) return '[Truncated: Max Depth]';
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeEmailMetadata(item, depth + 1));
  }

  const cleanObj: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    const lowerKey = k.toLowerCase().replace(/[-_]/g, '');
    if (
      SENSITIVE_FIELDS.has(lowerKey) ||
      lowerKey.includes('secret') ||
      lowerKey.includes('refreshtoken') ||
      lowerKey.includes('accesstoken') ||
      lowerKey.includes('password')
    ) {
      continue;
    }
    cleanObj[k] = sanitizeEmailMetadata(v, depth + 1);
  }
  return cleanObj;
}

export class EmailActivityService {
  /**
   * Records an email in QUEUED status before dispatch.
   * Ensures recipient privacy with AES-256-GCM encryption.
   * Fail-safe: database logging errors never interrupt the primary workflow.
   */
  static async recordQueued(params: RecordQueuedEmailParams): Promise<string | null> {
    try {
      const {
        merchantId,
        storeId,
        shopDomain,
        recipient,
        emailType = 'NOTIFICATION',
        relatedEntityId,
        relatedEntityType,
        metadata,
      } = params;

      if (!shopDomain || !recipient) {
        console.warn('[EmailActivityService:Validation] Missing shopDomain or recipient', { shopDomain });
        return null;
      }

      let resolvedStoreId = storeId || null;
      let resolvedMerchantId = merchantId || null;

      // Look up store if not provided
      if (!resolvedStoreId || !resolvedMerchantId) {
        try {
          const store = await prisma.store.findUnique({
            where: { shopDomain: shopDomain.trim().toLowerCase() },
            select: { id: true, shopifyStoreId: true },
          });
          if (store) {
            if (!resolvedStoreId) resolvedStoreId = store.id;
            if (!resolvedMerchantId) resolvedMerchantId = store.shopifyStoreId || store.id;
          }
        } catch (lookupErr: any) {
          console.warn('[EmailActivityService:StoreLookup] Store lookup warning:', lookupErr?.message);
        }
      }

      const encryptedRecipient = safeEncrypt(recipient.trim().toLowerCase()) || recipient.trim().toLowerCase();
      const cleanMetadata = metadata ? sanitizeEmailMetadata(metadata) : null;

      const record = await prisma.emailActivity.create({
        data: {
          merchantId: resolvedMerchantId,
          storeId: resolvedStoreId,
          shopDomain: shopDomain.trim().toLowerCase(),
          recipient: encryptedRecipient,
          emailType,
          relatedEntityId: relatedEntityId ? String(relatedEntityId) : null,
          relatedEntityType: relatedEntityType || null,
          status: EmailActivityStatus.QUEUED,
          metadata: cleanMetadata || undefined,
        },
      });

      return record.id;
    } catch (err: any) {
      console.error('[EmailActivityService:Error] Failed to record QUEUED email activity:', err?.message || err);
      return null;
    }
  }

  /**
   * Transitions an email activity from QUEUED to SENT upon AWS SES acceptance.
   * Records providerMessageId (SES MessageId).
   */
  static async recordSent(
    activityId: string | null | undefined,
    providerMessageId: string,
    additionalMetadata?: Record<string, any>
  ): Promise<boolean> {
    if (!activityId) return false;
    try {
      const existing = await prisma.emailActivity.findUnique({
        where: { id: activityId },
      });

      if (!existing) return false;

      // Do not overwrite final statuses (DELIVERED or BOUNCED)
      if (existing.status === EmailActivityStatus.DELIVERED || existing.status === EmailActivityStatus.BOUNCED) {
        return true;
      }

      let mergedMetadata: any = existing.metadata || {};
      if (additionalMetadata) {
        mergedMetadata = {
          ...mergedMetadata,
          ...sanitizeEmailMetadata(additionalMetadata),
          sentAt: new Date().toISOString(),
        };
      }

      await prisma.emailActivity.update({
        where: { id: activityId },
        data: {
          status: EmailActivityStatus.SENT,
          providerMessageId,
          errorMessage: null,
          metadata: mergedMetadata,
        },
      });

      return true;
    } catch (err: any) {
      console.error('[EmailActivityService:Error] Failed to record SENT status:', err?.message || err);
      return false;
    }
  }

  /**
   * Records an email dispatch failure.
   */
  static async recordFailed(
    activityId: string | null | undefined,
    errorMessage: string,
    additionalMetadata?: Record<string, any>
  ): Promise<boolean> {
    if (!activityId) return false;
    try {
      const existing = await prisma.emailActivity.findUnique({
        where: { id: activityId },
      });

      if (!existing) return false;

      let mergedMetadata: any = existing.metadata || {};
      if (additionalMetadata) {
        mergedMetadata = {
          ...mergedMetadata,
          ...sanitizeEmailMetadata(additionalMetadata),
          failedAt: new Date().toISOString(),
        };
      }

      await prisma.emailActivity.update({
        where: { id: activityId },
        data: {
          status: EmailActivityStatus.FAILED,
          errorMessage: errorMessage || 'Unknown delivery failure',
          metadata: mergedMetadata,
        },
      });

      return true;
    } catch (err: any) {
      console.error('[EmailActivityService:Error] Failed to record FAILED status:', err?.message || err);
      return false;
    }
  }

  /**
   * Handles delivery confirmation event from AWS SES / SNS.
   * Updates status to DELIVERED. Safe against duplicate events.
   */
  static async recordDeliveryEvent(
    providerMessageId: string,
    details?: SesDeliveryEventDetails
  ): Promise<{ success: boolean; isDuplicate?: boolean }> {
    try {
      if (!providerMessageId) return { success: false };

      const existing = await prisma.emailActivity.findFirst({
        where: { providerMessageId },
      });

      if (!existing) {
        console.warn(`[EmailActivityService:Delivery] No email activity found for providerMessageId: ${providerMessageId}`);
        return { success: false };
      }

      // Idempotency: if already DELIVERED, treat as duplicate and do not overwrite
      if (existing.status === EmailActivityStatus.DELIVERED) {
        console.log(`[EmailActivityService:Delivery] Duplicate delivery event for ${providerMessageId}. Ignored.`);
        return { success: true, isDuplicate: true };
      }

      // If already BOUNCED, do not overwrite BOUNCED with DELIVERED
      if (existing.status === EmailActivityStatus.BOUNCED) {
        console.warn(`[EmailActivityService:Delivery] Email was already BOUNCED (${providerMessageId}). Cannot mark DELIVERED.`);
        return { success: false };
      }

      let mergedMetadata: any = existing.metadata || {};
      mergedMetadata = {
        ...mergedMetadata,
        delivery: {
          timestamp: details?.timestamp || new Date().toISOString(),
          smtpResponse: details?.smtpResponse || null,
          recipients: details?.recipients || [],
        },
      };

      await prisma.emailActivity.update({
        where: { id: existing.id },
        data: {
          status: EmailActivityStatus.DELIVERED,
          metadata: mergedMetadata,
        },
      });

      console.log(`[EmailActivityService:Delivery] Activity ${existing.id} updated to DELIVERED (${providerMessageId})`);
      return { success: true };
    } catch (err: any) {
      console.error('[EmailActivityService:Error] Failed to process delivery event:', err?.message || err);
      return { success: false };
    }
  }

  /**
   * Handles bounce event from AWS SES / SNS.
   * Updates status to BOUNCED with diagnostic details. Safe against duplicates.
   */
  static async recordBounceEvent(
    providerMessageId: string,
    details?: SesBounceEventDetails
  ): Promise<{ success: boolean; isDuplicate?: boolean }> {
    try {
      if (!providerMessageId) return { success: false };

      const existing = await prisma.emailActivity.findFirst({
        where: { providerMessageId },
      });

      if (!existing) {
        console.warn(`[EmailActivityService:Bounce] No email activity found for providerMessageId: ${providerMessageId}`);
        return { success: false };
      }

      // Idempotency: if already BOUNCED, treat as duplicate
      if (existing.status === EmailActivityStatus.BOUNCED) {
        console.log(`[EmailActivityService:Bounce] Duplicate bounce event for ${providerMessageId}. Ignored.`);
        return { success: true, isDuplicate: true };
      }

      const bounceSummary = `Bounce: ${details?.bounceType || 'Undetermined'}${details?.bounceSubType ? ` / ${details.bounceSubType}` : ''}${details?.diagnostics ? ` - ${details.diagnostics}` : ''}`;

      let mergedMetadata: any = existing.metadata || {};
      mergedMetadata = {
        ...mergedMetadata,
        bounce: {
          bounceType: details?.bounceType || 'Unknown',
          bounceSubType: details?.bounceSubType || 'Unknown',
          diagnostics: details?.diagnostics || null,
          bouncedRecipients: details?.bouncedRecipients || [],
          timestamp: new Date().toISOString(),
        },
      };

      await prisma.emailActivity.update({
        where: { id: existing.id },
        data: {
          status: EmailActivityStatus.BOUNCED,
          errorMessage: bounceSummary,
          metadata: mergedMetadata,
        },
      });

      console.log(`[EmailActivityService:Bounce] Activity ${existing.id} updated to BOUNCED (${providerMessageId})`);
      return { success: true };
    } catch (err: any) {
      console.error('[EmailActivityService:Error] Failed to process bounce event:', err?.message || err);
      return { success: false };
    }
  }

  /**
   * Helper to decrypt recipient email for authorized internal developer inspection.
   */
  static decryptActivity(activity: any) {
    if (!activity) return activity;
    const decryptedRecipient = safeDecrypt(activity.recipient) || activity.recipient;
    return {
      ...activity,
      recipient: decryptedRecipient,
    };
  }
}

