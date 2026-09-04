"use client";

let appBridgeTimedOut = false;

export async function shopifyFetch(input: RequestInfo, init: RequestInit = {}) {

  const maxRetries = 5; // Reduced from 20 to prevent long 2s load delays
  let retries = 0;
  let delay = 100;

  const hasHost = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("host");

  while (
    !appBridgeTimedOut &&
    hasHost &&
    typeof window !== "undefined" &&
    !((window as any).shopify && typeof (window as any).shopify.idToken === "function") &&
    retries < maxRetries
  ) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    retries++;
  }
  
  if (retries >= maxRetries) {
    appBridgeTimedOut = true;
  }

  const shopifyV4 = typeof window !== "undefined" ? (window as any).shopify : null;

  let token: string;

  if (shopifyV4 && typeof shopifyV4.idToken === "function") {
    try {
      token = await shopifyV4.idToken();
    } catch (err: any) {
      if (process.env.NODE_ENV === "development" && err?.message?.includes("host did not respond")) {
        console.warn("[shopifyFetch] idToken unavailable (host did not respond). Falling back to dev_fallback_token.");
        token = "dev_fallback_token";
      } else {
        console.warn("[shopifyFetch] App Bridge idToken failed:", err.message);
        token = "dev_fallback_token";
      }
    }
  } else if (process.env.NODE_ENV === "development") {
    console.warn("[shopifyFetch] App Bridge not initialized in dev mode. Falling back to dev_fallback_token.");
    token = "dev_fallback_token";
  } else {
    token = "dev_fallback_token";
  }


  let requestInput = input;
  let activeShopDomain = "";
  if (typeof window !== "undefined" && window.location) {
    const windowParams = new URLSearchParams(window.location.search);
    const shopFromUrl = windowParams.get("shop");
    if (shopFromUrl) {
      activeShopDomain = shopFromUrl;
      try { localStorage.setItem("storebridge_active_shop", shopFromUrl); } catch (e) {}
    } else {
      try { activeShopDomain = localStorage.getItem("storebridge_active_shop") || ""; } catch (e) {}
    }

    if (activeShopDomain && typeof requestInput === "string" && requestInput.startsWith("/")) {
      const targetUrl = new URL(requestInput, window.location.origin);
      if (!targetUrl.searchParams.has("shop")) {
        targetUrl.searchParams.set("shop", activeShopDomain);
        requestInput = targetUrl.pathname + targetUrl.search;
      }
    }
  }

  console.log("[Frontend: shopifyFetch] URL:", requestInput);
  console.log("[Frontend: shopifyFetch] Token starts with:", token?.substring(0, 15));

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(init.headers as Record<string, string> || {}),
  };

  if (activeShopDomain) {
    headers["x-shopify-shop-domain"] = activeShopDomain;
  }

  return fetch(requestInput, {
    ...init,
    headers,
  });
}