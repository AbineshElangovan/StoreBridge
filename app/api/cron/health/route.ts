import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAdminClient } from "@/lib/shopify/admin";
import { logAuthEvent } from "@/lib/auth/audit";

export async function GET(request: Request) {
  // Allow Vercel Cron or manual invocation with CRON_SECRET
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  const authHeader = request.headers.get("authorization");
  const isAuthorized = isVercelCron || authHeader === `Bearer ${process.env.CRON_SECRET || 'dev_cron_secret'}`;

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeStores = await prisma.store.findMany({
    where: { authStatus: "AUTHENTICATED", isActive: true },
  });

  const results = {
    total: activeStores.length,
    healthy: 0,
    failed: 0,
    details: [] as any[],
  };

  for (const store of activeStores) {
    try {
      if (!store.accessToken) {
        throw new Error("Token missing from DB (should be impossible via extension)");
      }

      // Instantiate client - this validates the token format
      const client = await getAdminClient(store.shopDomain);
      
      // Make a lightweight API call to verify the token is still valid with Shopify
      await client.request(`
        query {
          shop {
            id
          }
        }
      `);

      results.healthy++;
      results.details.push({ shop: store.shopDomain, status: "OK" });
    } catch (error: any) {
      results.failed++;
      results.details.push({ shop: store.shopDomain, status: "FAILED", error: error.message });
      
      console.error(`[HealthCheck] Store ${store.shopDomain} failed auth check:`, error.message);
      
      // Only mark for reauth if the store truly has no refresh token or the refresh token itself has expired
      const isRefreshTokenExpired = store.refreshTokenExpiresAt && store.refreshTokenExpiresAt < new Date();
      const hasNoRefreshToken = !store.refreshToken;

      if (hasNoRefreshToken || isRefreshTokenExpired) {
        await prisma.store.update({
          where: { id: store.id },
          data: {
            authStatus: "REQUIRES_REAUTH",
            lastAuthFailure: new Date(),
            authFailureReason: `Proactive health check failed: ${error.message}`
          }
        });

        await logAuthEvent(
          store.shopDomain,
          "Health Check Failed",
          false,
          `Token invalid or revoked. Status updated to REQUIRES_REAUTH. Error: ${error.message}`
        );
      }
    }
  }

  return NextResponse.json(results);
}
