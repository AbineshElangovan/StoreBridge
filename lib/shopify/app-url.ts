import { NextRequest } from "next/server";

export const LOCAL_DEV_TUNNEL = "dz50mdfc-3000.inc1.devtunnels.ms";
export const VERCEL_PRODUCTION_DOMAIN = "store-bridge-yemi.vercel.app";
export const AMPLIFY_PRODUCTION_DOMAIN = "version-control.d38r9lc5j1o8oj.amplifyapp.com";

/**
 * Normalizes any URL string into a clean hostname without protocol, port, or trailing slash.
 */
export function cleanHost(input?: string | null): string {
  if (!input) return "";
  return input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/:\d+$/, "")
    .replace(/\/+$/, "");
}

/**
 * Centralized, environment-aware hostname resolver.
 * Priority:
 * 1. Incoming Request headers (x-forwarded-host / host) - dynamically supports whatever domain receives the request
 * 2. AWS Amplify environment detection (AWS_BRANCH / AWS_APP_ID)
 * 3. Vercel environment detection (VERCEL)
 * 4. SHOPIFY_APP_URL environment variable
 * 5. Static fallbacks based on environment
 */
export function getAppHost(req?: Request | NextRequest | null): string {
  // 1. Check incoming request headers if available
  if (req) {
    const forwardedHost = req.headers.get("x-forwarded-host");
    if (forwardedHost) {
      const cleaned = cleanHost(forwardedHost.split(",")[0]);
      if (isValidAppHost(cleaned)) return cleaned;
    }

    const host = req.headers.get("host");
    if (host) {
      const cleaned = cleanHost(host);
      if (isValidAppHost(cleaned)) return cleaned;
    }
  }

  // 2. AWS Amplify runtime
  if (process.env.AWS_BRANCH || process.env.AWS_APP_ID || process.env.AWS_EXECUTION_ENV || process.env.LAMBDA_TASK_ROOT) {
    if (process.env.SHOPIFY_APP_URL) {
      const cleaned = cleanHost(process.env.SHOPIFY_APP_URL);
      if (cleaned.includes("amplifyapp.com") || isValidProductionHost(cleaned)) {
        return cleaned;
      }
    }
    return AMPLIFY_PRODUCTION_DOMAIN;
  }

  // 3. Vercel runtime
  if (process.env.VERCEL) {
    if (process.env.SHOPIFY_APP_URL) {
      const cleaned = cleanHost(process.env.SHOPIFY_APP_URL);
      if (cleaned.includes("vercel.app") || isValidProductionHost(cleaned)) {
        return cleaned;
      }
    }
    return VERCEL_PRODUCTION_DOMAIN;
  }

  // 4. Configured SHOPIFY_APP_URL (local / devtunnel)
  if (process.env.SHOPIFY_APP_URL) {
    const cleaned = cleanHost(process.env.SHOPIFY_APP_URL);
    if (cleaned) return cleaned;
  }

  return LOCAL_DEV_TUNNEL;
}

/**
 * Returns full HTTPS URL for the current environment.
 */
export function getAppUrl(req?: Request | NextRequest | null): string {
  const host = getAppHost(req);
  return `https://${host}`;
}

function isValidAppHost(host: string): boolean {
  if (!host) return false;
  return (
    host.includes("amplifyapp.com") ||
    host.includes("vercel.app") ||
    host.includes("devtunnels.ms") ||
    host.includes("localhost") ||
    host.includes("127.0.0.1") ||
    host.includes("trycloudflare.com") ||
    host.includes("ngrok")
  );
}

function isValidProductionHost(host: string): boolean {
  return (
    host.length > 0 &&
    !host.includes("localhost") &&
    !host.includes("127.0.0.1") &&
    !host.includes("devtunnels.ms")
  );
}

