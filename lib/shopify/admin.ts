import { shopify } from "@/lib/shopify";
import { prisma } from "@/lib/db/prisma";
import { Session, GraphqlQueryError } from "@shopify/shopify-api";
import {
  SHOP_INFO_QUERY,
  GET_PRODUCTS_BASIC_QUERY,
  GET_PRODUCT_VARIANTS_QUERY,
  GET_INVENTORY_LEVELS_QUERY,
} from "@/services/shopify/graphql";
import { encrypt, decrypt } from "@/lib/utils/encryption";

// Per-shop in-flight refresh lock to protect single-use refresh tokens from race conditions within process
const refreshInFlight = new Map<string, Promise<any>>();
const refreshCooldown = new Map<string, number>();

export async function refreshOfflineToken(store: any, force = false) {
  const shopDomain = store.shopDomain;

  // 1. If store has NO expiresAt date or expiresAt is null, it is a permanent non-expiring token
  if (!store.expiresAt) {
    console.log(`[AdminClient] Store ${shopDomain} has a non-expiring permanent token. Skipping refresh.`);
    return store;
  }

  // 2. Cross-instance race condition protection: Check DB first!
  // Another serverless instance or background process might have ALREADY refreshed this store's token.
  const latestStore = await prisma.store.findUnique({ where: { shopDomain } });
  if (latestStore && latestStore.expiresAt) {
    const timeUntilExpiry = latestStore.expiresAt.getTime() - Date.now();
    // If NOT forced: If DB already has a newer token than the passed store AND it is valid for >15m, reuse it immediately!
    if (!force && timeUntilExpiry > 15 * 60 * 1000 && latestStore.accessToken && latestStore.accessToken !== store.accessToken) {
      console.log(`[AdminClient] Reusing fresh token from DB for ${shopDomain} (expires in ${Math.round(timeUntilExpiry / 60000)}m)`);
      return latestStore;
    }
  }

  // Cooldown check: if token refresh was recently rejected with 400/401, don't spam Shopify within 60s
  const cooldownUntil = refreshCooldown.get(shopDomain);
  if (cooldownUntil && Date.now() < cooldownUntil) {
    throw new Error(`Store ${shopDomain} refresh token was recently rejected by Shopify (cooldown active). Requires OAuth handshake.`);
  }

  const currentStore = latestStore || store;
  if (!currentStore.refreshToken) {
    throw new Error(`Store ${shopDomain} has no refresh token.`);
  }

  // 3. Re-use existing in-flight Promise within the current process
  const existingRefresh = refreshInFlight.get(shopDomain);
  if (existingRefresh) {
    console.log(`[AdminClient] Reusing existing in-flight token refresh Promise for ${shopDomain}`);
    return await existingRefresh;
  }

  const refreshPromise = (async () => {
    const clientId = process.env.SHOPIFY_API_KEY || process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
    const clientSecret = process.env.SHOPIFY_API_SECRET;

    let decryptedRefreshToken: string;
    try {
      decryptedRefreshToken = decrypt(currentStore.refreshToken);
    } catch (error: any) {
      console.error(`[AdminClient] Failed to decrypt refresh token for ${shopDomain}:`, error.message);
      throw new Error("Invalid encrypted refresh token format");
    }

    const params = new URLSearchParams();
    params.append("client_id", clientId || "");
    params.append("client_secret", clientSecret || "");
    params.append("refresh_token", decryptedRefreshToken);
    params.append("grant_type", "refresh_token");

    const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[AdminClient] Refresh API response not ok for ${shopDomain}: ${response.status} - ${errText}`);
      if (response.status === 400 || response.status === 401) {
        refreshCooldown.set(shopDomain, Date.now() + 60 * 1000);
      }

      // Double-check: Did a peer serverless worker complete the refresh while our request was in flight?
      const checkAfterFail = await prisma.store.findUnique({ where: { shopDomain } });
      if (checkAfterFail?.expiresAt && checkAfterFail.expiresAt.getTime() > Date.now()) {
        console.log(`[AdminClient] Concurrent refresh detected for ${shopDomain}: DB was updated by peer instance.`);
        return checkAfterFail;
      }

      throw new Error(`Failed to refresh Shopify token: ${errText}`);
    }

    const data = await response.json();
    refreshCooldown.delete(shopDomain);

    // Calculate new expiration dates
    const now = new Date();
    const expiresAt = data.expires_in
      ? new Date(now.getTime() + (data.expires_in * 1000))
      : null;
    
    const refreshTokenExpiresAt = data.refresh_token_expires_in 
      ? new Date(now.getTime() + (data.refresh_token_expires_in * 1000))
      : currentStore.refreshTokenExpiresAt;

    const updatedStore = await prisma.store.update({
      where: { id: currentStore.id },
      data: {
        accessToken: encrypt(data.access_token),
        refreshToken: data.refresh_token ? encrypt(data.refresh_token) : currentStore.refreshToken,
        expiresAt,
        refreshTokenExpiresAt,
        authStatus: "AUTHENTICATED",
        lastAuthFailure: null,
        authFailureReason: null,
      },
    });

    try {
      await prisma.session.updateMany({
        where: { shop: shopDomain },
        data: {
          accessToken: encrypt(data.access_token),
          refreshToken: data.refresh_token ? encrypt(data.refresh_token) : undefined,
          expires: expiresAt,
          refreshTokenExpires: refreshTokenExpiresAt || undefined,
        }
      });
    } catch (sErr: any) {
      console.warn(`[AdminClient] Session sync notice for ${shopDomain}:`, sErr.message);
    }

    return updatedStore;
  })();

  refreshInFlight.set(shopDomain, refreshPromise);

  try {
    return await refreshPromise;
  } finally {
    refreshInFlight.delete(shopDomain);
  }
}

export async function getAdminClient(shopDomain: string) {
  const store = await prisma.store.findUnique({
    where: { shopDomain },
  });

  if (!store || !store.isActive) {
    throw new Error(`Store ${shopDomain} is not active or not found.`);
  }

  let activeStore = store;

  // Proactively refresh tokens with 60 minutes buffer (or if 90-day refresh token has <14 days left)
  // so stores stay continuously rolled and users never experience expiration
  if (activeStore.refreshToken && activeStore.expiresAt) {
    const now = new Date();
    const timeUntilExpiry = activeStore.expiresAt.getTime() - now.getTime();
    const refreshTimeUntilExpiry = activeStore.refreshTokenExpiresAt
      ? activeStore.refreshTokenExpiresAt.getTime() - now.getTime()
      : Infinity;

    // Refresh if access token expires within 60 minutes OR refresh token is within 14 days of expiry
    const shouldRefresh = timeUntilExpiry < 60 * 60 * 1000 || refreshTimeUntilExpiry < 14 * 24 * 60 * 60 * 1000;

    if (shouldRefresh) {
      try {
        console.log(`[AdminClient] Proactively refreshing expiring token for ${shopDomain} (access expires in ${Math.round(timeUntilExpiry / 60000)}m, refresh expires in ${Math.round(refreshTimeUntilExpiry / (86400000))}d)...`);
        const refreshedStore = await refreshOfflineToken(activeStore);
        if (refreshedStore) {
          activeStore = refreshedStore;
        }
      } catch (error: any) {
        console.warn(`[AdminClient] Proactive refresh notice for ${shopDomain}:`, error.message);
      }
    }
  }

  // 1. Strict Validation
  if (!activeStore.accessToken || activeStore.accessToken.trim() === "") {
    throw new Error(`CRITICAL: Store ${shopDomain} has an empty access token.`);
  }

  let decryptedAccessToken: string;
  try {
    decryptedAccessToken = decrypt(activeStore.accessToken);
  } catch (error: any) {
    console.error(`[AdminClient] Failed to decrypt access token for ${shopDomain}:`, error.message);
    throw new Error(`CRITICAL: Store ${shopDomain} access token decryption failed.`);
  }

  // 2. Helper to create a native Graphql client
  const createGraphqlClient = (token: string) => {
    const session = new Session({
      id: `offline_${shopDomain}`,
      shop: shopDomain,
      state: "offline",
      isOnline: false,
      accessToken: token,
    });
    return new shopify.clients.Graphql({ session: session as Session });
  };

  let client = createGraphqlClient(decryptedAccessToken);

  // 3. Automatic 401 Self-Healing Interceptor on client.request
  const originalRequest = client.request.bind(client);
  client.request = (async (query: any, options?: any) => {
    try {
      return await originalRequest(query, options);
    } catch (error: any) {
      const is401 =
        error?.response?.code === 401 ||
        error?.response?.status === 401 ||
        error?.response?.code === 403 ||
        error?.response?.status === 403 ||
        error?.statusCode === 401 ||
        error?.statusCode === 403 ||
        error?.networkStatusCode === 401 ||
        error?.networkStatusCode === 403 ||
        error?.message?.includes("401") ||
        error?.message?.includes("403") ||
        error?.message?.includes("Unauthorized") ||
        error?.message?.includes("Forbidden");

      if (is401) {
        console.warn(`[AdminClient] Auth error (401/403) encountered for ${shopDomain}. Attempting automatic self-healing token refresh...`);
        try {
          const freshStore = await prisma.store.findUnique({ where: { shopDomain } });
          if (!freshStore || !freshStore.refreshToken) {
            throw new Error(`Store ${shopDomain} has no refresh token to recover from 401.`);
          }

          // If another instance already saved a newer access token in DB, use it directly!
          let refreshedStore: any;
          if (freshStore.accessToken && freshStore.accessToken !== activeStore.accessToken) {
            console.log(`[AdminClient] DB already has newer token for ${shopDomain}. Using peer-updated token.`);
            refreshedStore = freshStore;
          } else {
            refreshedStore = await refreshOfflineToken(freshStore, true);
          }

          activeStore = refreshedStore;
          const freshToken = decrypt(activeStore.accessToken);

          client = createGraphqlClient(freshToken);
          console.log(`[AdminClient] Self-healing token refresh succeeded for ${shopDomain}. Retrying request...`);
          return await client.request(query, options);
        } catch (retryError: any) {
          console.error(`[AdminClient] Self-healing retry notice for ${shopDomain}:`, retryError.message);
          throw error;
        }
      }
      throw error;
    }
  }) as typeof client.request;

  return client;
}

export async function handleGraphQLError(error: any, shopDomain: string) {
  if (error instanceof GraphqlQueryError) {
    console.error(`GraphQL Query Error for ${shopDomain}:`, JSON.stringify(error.response, null, 2));
    throw new Error(`Shopify GraphQL Error: ${error.message}`);
  }

  const is401 =
    error.response?.code === 401 ||
    error.response?.status === 401 ||
    error.response?.code === 403 ||
    error.response?.status === 403 ||
    error.statusCode === 401 ||
    error.statusCode === 403 ||
    error.networkStatusCode === 401 ||
    error.networkStatusCode === 403 ||
    error.message?.includes("Unauthorized") ||
    error.message?.includes("Forbidden");

  if (is401) {
    console.warn(`[handleGraphQLError] 401 encountered for ${shopDomain}. Attempting forced token refresh before failing...`);
    try {
      const store = await prisma.store.findUnique({ where: { shopDomain } });
      if (store?.refreshToken) {
        await refreshOfflineToken(store, true);
      }
    } catch (refErr: any) {
      console.warn(`[handleGraphQLError] Token refresh attempt notice:`, refErr.message);
    }
    throw new Error(`Unauthorized: Store ${shopDomain} connection temporarily lost.`);
  }

  throw error;
}

export async function fetchShopInfo(shopDomain: string) {
  const client = await getAdminClient(shopDomain);

  try {
    const response = await client.request(SHOP_INFO_QUERY);

    return response.data?.shop;
  } catch (error) {
    return handleGraphQLError(error, shopDomain);
  }
}

export async function fetchProducts(shopDomain: string, first = 10) {
  const client = await getAdminClient(shopDomain);

  try {
    const response = await client.request(GET_PRODUCTS_BASIC_QUERY, { variables: { first } });

    return response.data?.products;
  } catch (error) {
    return handleGraphQLError(error, shopDomain);
  }
}

export async function fetchProductVariants(shopDomain: string, productId: string, first = 50) {
  const client = await getAdminClient(shopDomain);

  try {
    const response = await client.request(GET_PRODUCT_VARIANTS_QUERY, { variables: { id: productId, first } });

    return response.data?.product?.variants;
  } catch (error) {
    return handleGraphQLError(error, shopDomain);
  }
}

export async function fetchInventoryLevels(shopDomain: string, inventoryItemId: string) {
  const client = await getAdminClient(shopDomain);

  try {
    const response = await client.request(GET_INVENTORY_LEVELS_QUERY, { variables: { id: inventoryItemId } });

    return response.data?.inventoryItem?.inventoryLevels;
  } catch (error) {
    return handleGraphQLError(error, shopDomain);
  }
}
