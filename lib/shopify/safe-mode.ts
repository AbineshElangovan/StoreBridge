/**
 * Safe Mode Guard for Local Development
 * When SHOPIFY_SAFE_MODE="true", live mutations against Shopify stores
 * (such as inventory adjustments) are intercepted during local testing,
 * logged to the developer terminal, and safely mocked.
 * 
 * In production (AWS Amplify / Vercel), SHOPIFY_SAFE_MODE is unset or false,
 * allowing live store updates to execute normally.
 */

export function isShopifySafeMode(): boolean {
  return process.env.SHOPIFY_SAFE_MODE === 'true';
}

export function logSafeModeIntercept(operation: string, details: Record<string, any>) {
  console.log(`[SHOPIFY_SAFE_MODE] Dry-run: Intercepted ${operation}:`, JSON.stringify(details));
}

