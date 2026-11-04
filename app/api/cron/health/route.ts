import { NextResponse } from "next/server";
import { performTokenMaintenance } from "@/lib/auth/token-maintenance";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.CRON_SECRET || 'dev_cron_secret';

  // Multi-platform authorization checks:
  // 1. Vercel Cron header
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";

  // 2. Standard RFC Bearer Authorization
  const authHeader = request.headers.get("authorization");
  const isBearerAuth = authHeader === `Bearer ${secret}`;

  // 3. Custom Header (Render, Railway, Cloudflare, Webhooks)
  const cronHeader = request.headers.get("x-cron-secret");
  const isHeaderAuth = cronHeader === secret;

  // 4. URL Query Param (?key=... or ?secret=... for cron-job.org, EasyCron, Zapier)
  const queryKey = url.searchParams.get("key") || url.searchParams.get("secret");
  const isQueryAuth = queryKey === secret;

  // 5. Local development fallback
  const isDev = process.env.NODE_ENV === "development";

  const isAuthorized = isVercelCron || isBearerAuth || isHeaderAuth || isQueryAuth || isDev;

  if (!isAuthorized) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        hint: "Provide ?key=..., x-cron-secret header, or Authorization: Bearer header matching CRON_SECRET.",
      },
      { status: 401 }
    );
  }

  try {
    const results = await performTokenMaintenance();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });
  } catch (error: any) {
    console.error("[HealthCron] Fatal error during token maintenance:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
