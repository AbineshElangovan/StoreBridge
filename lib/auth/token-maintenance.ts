import { prisma } from "@/lib/db/prisma";
import { getAdminClient, refreshOfflineToken } from "@/lib/shopify/admin";
import { logAuthEvent } from "@/lib/auth/audit";

export interface MaintenanceResults {
  total: number;
  refreshed: number;
  verified: number;
  skipped: number;
  failed: number;
  details: Array<{
    shop: string;
    action: "refreshed" | "verified" | "skipped" | "failed";
    message?: string;
  }>;
}

/**
 * Autonomous Shopify token health & refresh sweeper.
 * Runs across all platforms: Node.js servers, Docker, Vercel, Railway, Render, AWS, and local dev.
 *
 * Guarantees:
 * 1. Proactively rotates tokens expiring in < 2 hours.
 * 2. Proactively refreshes 90-day refresh tokens if within 14 days of expiry to keep them indefinitely rolling.
 * 3. Verifies active tokens with a lightweight GraphQL shop query.
 */
export async function performTokenMaintenance(): Promise<MaintenanceResults> {
  const activeStores = await prisma.store.findMany({
    where: { authStatus: "AUTHENTICATED", isActive: true },
  });

  const results: MaintenanceResults = {
    total: activeStores.length,
    refreshed: 0,
    verified: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  const now = Date.now();
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

  for (const store of activeStores) {
    const shop = store.shopDomain;

    try {
      if (!store.accessToken) {
        throw new Error("Store has no access token in database.");
      }

      // If store has no refresh token and no expiresAt, it's a permanent legacy token
      if (!store.refreshToken && !store.expiresAt) {
        results.skipped++;
        results.details.push({
          shop,
          action: "skipped",
          message: "Permanent non-expiring token.",
        });
        continue;
      }

      const accessExpiresAtMs = store.expiresAt ? store.expiresAt.getTime() : 0;
      const refreshExpiresAtMs = store.refreshTokenExpiresAt ? store.refreshTokenExpiresAt.getTime() : 0;

      const accessExpiringSoon = accessExpiresAtMs > 0 && (accessExpiresAtMs - now < TWO_HOURS_MS);
      const refreshExpiringSoon = refreshExpiresAtMs > 0 && (refreshExpiresAtMs - now < FOURTEEN_DAYS_MS);

      // Proactively rotate token if access token expires soon OR refresh token needs rolling renewal
      if (store.refreshToken && (accessExpiringSoon || refreshExpiringSoon)) {
        console.log(`[TokenMaintenance] Rolling token refresh for ${shop} (accessExpiring=${accessExpiringSoon}, refreshExpiring=${refreshExpiringSoon})...`);
        const updated = await refreshOfflineToken(store, true);
        if (updated) {
          results.refreshed++;
          results.details.push({
            shop,
            action: "refreshed",
            message: `Tokens rolled successfully. Next refresh: ${updated.expiresAt?.toISOString()}`,
          });
          continue;
        }
      }

      // If token is still fresh, verify connectivity with Shopify
      const client = await getAdminClient(shop);
      await client.request(`query { shop { id } }`);

      results.verified++;
      results.details.push({
        shop,
        action: "verified",
        message: "Active token verified with Shopify API.",
      });
    } catch (error: any) {
      results.failed++;
      results.details.push({
        shop,
        action: "failed",
        message: error.message,
      });

      console.error(`[TokenMaintenance] Failed check for ${shop}:`, error.message);

      // Only mark for reauth if the store truly has no refresh token or the refresh token is expired
      const isRefreshTokenExpired = store.refreshTokenExpiresAt && store.refreshTokenExpiresAt < new Date();
      const hasNoRefreshToken = !store.refreshToken;

      if (hasNoRefreshToken || isRefreshTokenExpired) {
        try {
          await prisma.store.update({
            where: { id: store.id },
            data: {
              authStatus: "REQUIRES_REAUTH",
              lastAuthFailure: new Date(),
              authFailureReason: `Health check failed: ${error.message}`,
            },
          });

          await logAuthEvent(
            shop,
            "Health Check Failed",
            false,
            `Token invalid or revoked. Status updated to REQUIRES_REAUTH. Error: ${error.message}`
          );
        } catch (dbErr: any) {
          console.error(`[TokenMaintenance] Failed updating store status for ${shop}:`, dbErr.message);
        }
      }
    }
  }

  return results;
}

// Global reference to ensure only one daemon timer exists across hot-reloads
declare global {
  var __tokenMaintenanceDaemonStarted: boolean | undefined;
  var __tokenMaintenanceTimer: NodeJS.Timeout | undefined;
}

/**
 * Starts an in-process maintenance daemon that runs automatically inside Node.js.
 * This runs independently of Vercel, Docker, Railway, Render, or any external scheduler.
 */
export function startTokenMaintenanceDaemon() {
  if (globalThis.__tokenMaintenanceDaemonStarted) {
    return;
  }
  globalThis.__tokenMaintenanceDaemonStarted = true;

  console.log("[TokenMaintenance] Initializing autonomous background token maintenance daemon...");

  // Run initial check 45 seconds after boot to let app & DB connections settle
  const initialTimeout = setTimeout(async () => {
    try {
      console.log("[TokenMaintenance] Running boot-time token maintenance sweep...");
      const res = await performTokenMaintenance();
      console.log(`[TokenMaintenance] Sweep complete: ${res.verified} verified, ${res.refreshed} refreshed, ${res.failed} failed.`);
    } catch (err: any) {
      console.warn("[TokenMaintenance] Boot-time maintenance error:", err.message);
    }
  }, 45 * 1000);

  if (initialTimeout.unref) {
    initialTimeout.unref();
  }

  // Schedule recurring sweep every 2 hours
  const TWO_HOURS_INTERVAL = 2 * 60 * 60 * 1000;
  const recurringTimer = setInterval(async () => {
    try {
      console.log("[TokenMaintenance] Running scheduled 2-hour token maintenance sweep...");
      const res = await performTokenMaintenance();
      console.log(`[TokenMaintenance] Sweep complete: ${res.verified} verified, ${res.refreshed} refreshed, ${res.failed} failed.`);
    } catch (err: any) {
      console.warn("[TokenMaintenance] Scheduled maintenance error:", err.message);
    }
  }, TWO_HOURS_INTERVAL);

  if (recurringTimer.unref) {
    recurringTimer.unref();
  }

  globalThis.__tokenMaintenanceTimer = recurringTimer;
}

