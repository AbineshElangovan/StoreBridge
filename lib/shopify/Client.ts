"use client";

interface CachedResponseData {
  status: number;
  statusText: string;
  headers: [string, string][];
  body: ArrayBuffer;
}

// Reusable in-flight request cache for safe/idempotent GET requests
const inFlightRequests = new Map<string, Promise<CachedResponseData>>();

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
    const cached = await inFlightRequests.get(requestKey)!;
    return new Response(cached.body.slice(0), {
      status: cached.status,
      statusText: cached.statusText,
      headers: new Headers(cached.headers),
    });
  }

  const executionPromise = (async (): Promise<CachedResponseData> => {
    // Non-blocking token retrieval: check App Bridge idToken with 1500ms safety timeout
    let token = "dev_fallback_token";
    const shopifyV4 = typeof window !== "undefined" ? (window as any).shopify : null;

    if (shopifyV4 && typeof shopifyV4.idToken === "function") {
      try {
        const tokenPromise = shopifyV4.idToken();
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 1500));
        const idToken = await Promise.race([tokenPromise, timeoutPromise]);
        if (idToken && typeof idToken === "string") {
          token = idToken;
        }
      } catch (err: any) {
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
      const res = await fetch(requestInput, {
        ...init,
        headers,
      });
      const buffer = await res.arrayBuffer();

      // Guard against HTML error pages throwing syntax errors on res.json()
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json") && res.status >= 400) {
        const textDecoder = new TextDecoder();
        const text = textDecoder.decode(buffer);
        console.warn(`[shopifyFetch] Server returned HTML error (${res.status}):`, text.substring(0, 120));
        const errorJson = JSON.stringify({
          success: false,
          error: `Server error (${res.status}): Please refresh or check server logs.`
        });
        const enc = new TextEncoder();
        return {
          status: res.status,
          statusText: res.statusText,
          headers: [["Content-Type", "application/json"]],
          body: enc.encode(errorJson).buffer,
        };
      }

      return {
        status: res.status,
        statusText: res.statusText,
        headers: Array.from(res.headers.entries()),
        body: buffer,
      };
    } catch (err: any) {
      console.warn("[shopifyFetch] Network request failed:", err?.message || err);
      const errorJson = JSON.stringify({ success: false, error: "Network error: Unable to connect to server." });
      const enc = new TextEncoder();
      return {
        status: 503,
        statusText: "Service Unavailable",
        headers: [["Content-Type", "application/json"]],
        body: enc.encode(errorJson).buffer,
      };
    }
  })();

  if (isSafeGet && requestKey) {
    inFlightRequests.set(requestKey, executionPromise);
    executionPromise.finally(() => {
      inFlightRequests.delete(requestKey);
    });
  }

  const result = await executionPromise;
  return new Response(result.body.slice(0), {
    status: result.status,
    statusText: result.statusText,
    headers: new Headers(result.headers),
  });
}