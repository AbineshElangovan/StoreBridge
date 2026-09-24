"use client";

// Reusable in-flight request cache for safe/idempotent GET requests
const inFlightRequests = new Map<string, Promise<Response>>();

function buildRequestKey(input: RequestInfo, init: RequestInit, activeShopDomain: string): string {
  let urlStr = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
  try {
    // Strip ephemeral cache-busting timestamp `t=...` so identical simultaneous calls share the in-flight promise
    if (urlStr.includes('t=')) {
      urlStr = urlStr.replace(/([?&])t=\d+(&|$)/, '$1').replace(/[?&]$/, '');
    }
  } catch (e) {}
  return `${urlStr}::shop=${activeShopDomain}`;
}

export async function shopifyFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || "GET").toUpperCase();

  // Active shop domain resolution (preserves existing fallback behavior)
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

  // Deduplicate safe GET requests only. Never deduplicate mutations (POST, PUT, PATCH, DELETE).
  const isSafeGet = method === "GET";
  const requestKey = isSafeGet ? buildRequestKey(requestInput, init, activeShopDomain) : null;

  if (isSafeGet && requestKey && inFlightRequests.has(requestKey)) {
    // Clone response so multiple callers can read their own body stream
    const ongoingPromise = inFlightRequests.get(requestKey)!;
    return ongoingPromise.then((res) => res.clone());
  }

  const executionPromise = (async () => {
    // Non-blocking token retrieval: check App Bridge idToken immediately without multi-second delays
    let token = "dev_fallback_token";
    const shopifyV4 = typeof window !== "undefined" ? (window as any).shopify : null;

    if (shopifyV4 && typeof shopifyV4.idToken === "function") {
      try {
        const idToken = await shopifyV4.idToken();
        if (idToken) {
          token = idToken;
        }
      } catch (err: any) {
        // Fallback silently and immediately to existing dev/header fallback
        if (process.env.NODE_ENV === "development") {
          console.warn("[shopifyFetch] App Bridge idToken unavailable, using fallback:", err?.message || err);
        }
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string> || {}),
    };

    if (activeShopDomain) {
      headers["x-shopify-shop-domain"] = activeShopDomain;
    }

    try {
      return await fetch(requestInput, {
        ...init,
        headers,
      });
    } catch (err: any) {
      console.warn("[shopifyFetch] Network request failed:", err?.message || err);
      return new Response(
        JSON.stringify({ success: false, error: "Network error: Unable to connect to server." }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
  })();

  if (isSafeGet && requestKey) {
    inFlightRequests.set(requestKey, executionPromise);
    // Always clear the in-flight lock after settling (success or failure)
    executionPromise.finally(() => {
      inFlightRequests.delete(requestKey);
    });
  }

  const response = await executionPromise;
  return isSafeGet ? response.clone() : response;
}