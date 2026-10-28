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

// Per-shop in-flight refresh lock to protect single-use refresh tokens from race conditions
const refreshInFlight = new Map<string, Promise<any>>();

export async function refreshOfflineToken(store: any) {
  if (!store.refreshToken) {
    throw new Error(`Store ${store.shopDomain} has no refresh token.`);
  }

  const shopDomain = store.shopDomain;

  // If a refresh is already in flight for this specific shop, await it
  const existingRefresh = refreshInFlight.get(shopDomain);
  if (existingRefresh) {
    console.log(`[AdminClient] Reusing existing in-flight token refresh Promise for ${shopDomain}`);
    return await existingRefresh;
  }

  const refreshPromise = (async () => {
    const clientId = process.env.SHOPIFY_API_KEY;
    const clientSecret = process.env.SHOPIFY_API_SECRET;

    let decryptedRefreshToken;
    try {
      decryptedRefreshToken = decrypt(store.refreshToken);
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
      console.error("Refresh failed:", errText);
      throw new Error("Failed to refresh Shopify token.");
    }

    const data = await response.json();

    // Calculate new expiration dates
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (data.expires_in * 1000));
    
    const refreshTokenExpiresAt = data.refresh_token_expires_in 
      ? new Date(now.getTime() + (data.refresh_token_expires_in * 1000))
      : store.refreshTokenExpiresAt;

    const updatedStore = await prisma.store.update({
      where: { id: store.id },
      data: {
        accessToken: encrypt(data.access_token),
        refreshToken: data.refresh_token ? encrypt(data.refresh_token) : store.refreshToken,
        expiresAt,
        refreshTokenExpiresAt,
      },
    });

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

  // Check if we need to refresh the token proactively
  if (activeStore.refreshToken) {
    const now = new Date();
    const shouldRefresh =
      !activeStore.expiresAt ||
      activeStore.expiresAt.getTime() - now.getTime() < 2 * 60 * 60 * 1000;

    if (shouldRefresh) {
      try {
        console.log(`[AdminClient] Proactively refreshing token for ${shopDomain}...`);
        const refreshedStore = await refreshOfflineToken(activeStore);
        if (refreshedStore) {
          activeStore = refreshedStore;
        }
      } catch (error: any) {
        console.error(`[AdminClient] Failed to refresh token proactively for ${shopDomain}:`, error.message);
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
    await prisma.store.update({
      where: { shopDomain },
      data: { 
        authStatus: "INVALID_TOKEN",
        authFailureReason: "Decryption failed: " + error.message
      },
    });
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
        error?.statusCode === 401 ||
        error?.networkStatusCode === 401 ||
        error?.message?.includes("401") ||
        error?.message?.includes("Unauthorized");

      if (is401) {
        console.warn(`[AdminClient] 401 Unauthorized encountered for ${shopDomain}. Attempting automatic self-healing token refresh...`);
        try {
          const freshStore = await prisma.store.findUnique({ where: { shopDomain } });
          if (!freshStore || !freshStore.refreshToken) {
            throw new Error(`Store ${shopDomain} has no refresh token to recover from 401.`);
          }

          const refreshedStore = await refreshOfflineToken(freshStore);
          const freshToken = decrypt(refreshedStore.accessToken);

          client = createGraphqlClient(freshToken);
          console.log(`[AdminClient] Self-healing token refresh succeeded for ${shopDomain}. Retrying request...`);
          return await client.request(query, options);
        } catch (retryError: any) {
          console.error(`[AdminClient] Self-healing retry failed for ${shopDomain}:`, retryError.message);
          try {
            await prisma.store.update({
              where: { shopDomain },
              data: {
                authStatus: "REQUIRES_REAUTH",
                lastAuthFailure: new Date(),
                authFailureReason: `401 Unauthorized: ${retryError.message}`,
              },
            });
          } catch {}
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


  if (
    error.response?.code === 401 ||
    error.response?.status === 401 ||
    error.statusCode === 401 ||
    error.networkStatusCode === 401 ||
    error.message?.includes("Unauthorized")
  ) {
    console.error("===== SHOPIFY 401 =====");
    
    // We already do proactive refresh in getAdminClient.
    // If we hit a 401 here, update authStatus without deactivating the store record
    console.warn(`Access token invalid for ${shopDomain}. Updating authStatus to INVALID_TOKEN.`);
    try {
      await prisma.store.update({
        where: { shopDomain },
        data: { 
          authStatus: "INVALID_TOKEN",
          authFailureReason: error.message || "401 Unauthorized"
        },
      });
    } catch {}
    throw new Error(`Unauthorized: Store ${shopDomain} token requires re-authentication.`);
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
