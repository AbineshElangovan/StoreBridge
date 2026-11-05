import { prisma } from '@/lib/db/prisma';
import { ActorType } from '@prisma/client';
import { safeEncrypt, safeDecrypt } from '@/lib/utils/encryption';

export interface LogUserActivityParams {
  action: string;
  shopDomain: string;
  storeId?: string | null;
  merchantId?: string | null;
  userId?: string | null;
  userType?: string | null;
  actorType?: 'SHOPIFY_USER' | 'WEBHOOK' | 'SYSTEM' | 'UNKNOWN';
  entityType?: string | null;
  entityId?: string | null;
  description: string;
  metadata?: Record<string, any> | null;
  idempotencyKey?: string | null;
}

// Explicit sensitive field blacklist (do not strip harmless keys containing "key")
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
 * Recursively scrubs sensitive credentials, tokens, and secrets from activity metadata.
 */
function sanitizeActivityMetadata(data: any, depth = 0): any {
  if (data === null || data === undefined) return data;
  if (depth > 5) return '[Truncated: Max Depth]';
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeActivityMetadata(item, depth + 1));
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
      continue; // Skip sensitive credential values
    }

    cleanObj[k] = sanitizeActivityMetadata(v, depth + 1);
  }

  return cleanObj;
}

/**
 * Decrypts a UserActivity record so developer tools can view plain English text.
 */
export function decryptUserActivity(activity: any) {
  if (!activity) return activity;

  let description = activity.description;
  try {
    description = safeDecrypt(activity.description) || activity.description;
  } catch {}

  let userId = activity.userId;
  try {
    if (activity.userId) {
      userId = safeDecrypt(activity.userId) || activity.userId;
    }
  } catch {}

  let metadata = activity.metadata;
  if (metadata && typeof metadata === 'object' && metadata._encrypted && metadata.payload) {
    try {
      const decrypted = safeDecrypt(metadata.payload);
      if (decrypted) {
        metadata = JSON.parse(decrypted);
      }
    } catch {}
  }

  return {
    ...activity,
    description,
    userId,
    metadata,
  };
}

/**
 * Centralized, resilient, internal developer activity logger.
 * - Stores all descriptions, user IDs, and metadata ENCRYPTED at rest (AES-256-GCM).
 * - Append-only database records.
 * - Idempotency safe (prevents duplicates from retried webhooks).
 * - Non-destructive (store uninstallation never deletes audit history).
 * - Never throws into the caller or breaks primary business workflows.
 */
export async function logUserActivity(params: LogUserActivityParams): Promise<void> {
  try {
    const {
      action,
      shopDomain,
      description,
      idempotencyKey,
      entityType,
      entityId,
      actorType = 'UNKNOWN',
      metadata,
    } = params;

    if (!shopDomain || !action || !description) {
      console.warn('[UserActivity:Validation] Missing required fields for activity logging', {
        action,
        shopDomain,
      });
      return;
    }

    let resolvedStoreId = params.storeId || null;
    let resolvedMerchantId = params.merchantId || null;

    // If storeId or merchantId are missing, look up from Store by shopDomain
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
        console.warn('[UserActivity:StoreLookup] Warning looking up store for domain:', shopDomain, lookupErr?.message);
      }
    }

    const cleanMetadata = metadata ? sanitizeActivityMetadata(metadata) : null;
    const resolvedActorType = (actorType in ActorType ? actorType : 'UNKNOWN') as ActorType;

    // Idempotency: if key provided, check if already recorded
    if (idempotencyKey) {
      const existing = await prisma.userActivity.findUnique({
        where: { idempotencyKey },
        select: { id: true },
      });
      if (existing) {
        return; // Already recorded, skip duplicate gracefully
      }
    }

    // Encrypt sensitive fields at rest before writing to database
    const encryptedDescription = safeEncrypt(description) || description;
    const encryptedUserId = params.userId ? safeEncrypt(params.userId) : null;
    const encryptedMetadata = cleanMetadata
      ? {
          _encrypted: true,
          payload: safeEncrypt(JSON.stringify(cleanMetadata)),
        }
      : undefined;

    await prisma.userActivity.create({
      data: {
        idempotencyKey: idempotencyKey || null,
        merchantId: resolvedMerchantId,
        storeId: resolvedStoreId,
        shopDomain: shopDomain.trim().toLowerCase(),
        userId: encryptedUserId,
        userType: params.userType || 'UNKNOWN',
        actorType: resolvedActorType,
        action,
        entityType: entityType || null,
        entityId: entityId ? String(entityId) : null,
        description: encryptedDescription,
        metadata: encryptedMetadata,
      },
    });
  } catch (err: any) {
    // Unique constraint violation on idempotencyKey is normal for webhook retries
    if (err?.code === 'P2002') {
      return;
    }

    // Structured error logging without failing the caller transaction
    console.error('[UserActivity:Error] Failed to write internal user activity:', {
      action: params.action,
      shopDomain: params.shopDomain,
      error: err?.message || String(err),
    });
  }
}
