import crypto from 'crypto';
import { Session } from '@shopify/shopify-api';
import { shopify } from "@/lib/shopify";
import { prisma } from "@/lib/db/prisma";
import { AuthStatus } from "@prisma/client";
import { registerWebhooks } from "@/lib/shopify/webhooks";
import { NextRequest, NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { syncStoreProducts } from "./bulk-sync";
import { hasValidShopifyAccessToken } from "./utils";
import { logAuthEvent } from "@/lib/auth/audit";
import { encrypt } from "@/lib/utils/encryption";

export async function cleanupSeededData() {
  try {
    const seededStoreIds = await prisma.store.findMany({
      where: {
        OR: [
          { shopDomain: { contains: 'mock', mode: 'insensitive' } },
          { shopDomain: { contains: 'seed', mode: 'insensitive' } },
          { accessToken: { contains: 'mock', mode: 'insensitive' } },
          { accessToken: { contains: 'placeholder', mode: 'insensitive' } },
          { accessToken: { contains: 'your_', mode: 'insensitive' } },
          { accessToken: { contains: 'your-', mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });

    if (seededStoreIds.length > 0) {
      const seededStoreIdList = seededStoreIds.map((store) => store.id);

      await prisma.syncLog.deleteMany({
        where: {
          OR: [
            { sourceStoreId: { in: seededStoreIdList } },
            { destinationStoreId: { in: seededStoreIdList } },
          ],
        },
      });

      await prisma.variantMap.deleteMany({
        where: { storeId: { in: seededStoreIdList } },
      });

      await prisma.productCache.deleteMany({
        where: { storeId: { in: seededStoreIdList } },
      });

      await prisma.store.deleteMany({
        where: { id: { in: seededStoreIdList } },
      });
    }

    await prisma.store.deleteMany({
      where: {
        OR: [
          { shopDomain: { contains: 'mock', mode: 'insensitive' } },
          { shopDomain: { contains: 'seed', mode: 'insensitive' } },
          { accessToken: { contains: 'mock', mode: 'insensitive' } },
          { accessToken: { contains: 'placeholder', mode: 'insensitive' } },
          { accessToken: { contains: 'your_', mode: 'insensitive' } },
          { accessToken: { contains: 'your-', mode: 'insensitive' } },
        ],
      },
    });
  } catch (error: any) {
    console.error("[Service:cleanupSeededData] Error cleaning up seeded data:", error.message);
  }
}

export async function beginAuth(shop: string, rawRequest: NextRequest) {
  const sanitizedShop = shopify.utils.sanitizeShop(shop, true);
  if (!sanitizedShop) {
    throw new Error("Invalid shop domain");
  }

  const hostName = shopify.config.hostName;
  const secureUrl = `https://${hostName}${rawRequest.nextUrl.pathname}${rawRequest.nextUrl.search}`;
  console.log("[OAuth] beginAuth creating secure cleanRequest:", { secureUrl, hostName });
  const cleanRequest = new Request(secureUrl, {
    method: rawRequest.method,
    headers: rawRequest.headers,
  });

  return await shopify.auth.begin({
    shop: sanitizedShop,
    callbackPath: "/api/auth/callback",
    isOnline: false,
    rawRequest: cleanRequest,
  });
}

export async function handleAuthCallback(req: NextRequest) {
  console.log("[OAuth] callback start in Service", { shop: req.nextUrl.searchParams.get("shop") });

  const hostName = shopify.config.hostName;
  const secureUrl = `https://${hostName}${req.nextUrl.pathname}${req.nextUrl.search}`;
  console.log("[OAuth] handleAuthCallback creating secure cleanRequest:", { secureUrl });
  const cleanRequest = new Request(secureUrl, {
    method: req.method,
    headers: req.headers,
  });

  console.log("[OAuthCallback] Validating auth callback...");
  let session: Session;
  let headers: any = {};

  try {
    const callbackResponse = await shopify.auth.callback({
      rawRequest: cleanRequest,
      expiring: true,
    } as any);
    console.log("[OAuthCallback] Standard shopify.auth.callback succeeded.");
    session = callbackResponse.session;
    headers = callbackResponse.headers || {};
  } catch (authErr: any) {
    console.warn("[OAuthCallback] shopify.auth.callback failed, checking cookie/HMAC fallback:", authErr.message);
    const isCookieErr =
      authErr.message?.toLowerCase().includes("cookie") ||
      authErr.name === "CookieNotFound";

    if (!isCookieErr) {
      throw authErr;
    }

    console.log("[OAuthCallback] Cookie missing (cross-site/tunnel redirect). Attempting cryptographic HMAC verification...");
    const searchParams = req.nextUrl.searchParams;
    const hmac = searchParams.get("hmac");
    const code = searchParams.get("code");
    const shopParam = searchParams.get("shop");
    const cleanShop = shopify.utils.sanitizeShop(shopParam || "", true);

    if (!hmac || !code || !cleanShop) {
      console.error("[OAuthCallback] Missing required OAuth params for fallback:", { hasHmac: Boolean(hmac), hasCode: Boolean(code), cleanShop });
      throw authErr;
    }

    // Verify HMAC cryptographically using SHOPIFY_API_SECRET
    const params: Record<string, string> = {};
    for (const [key, val] of searchParams.entries()) {
      if (key !== "hmac" && key !== "signature") {
        params[key] = val;
      }
    }
    const message = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
    const secret = process.env.SHOPIFY_API_SECRET || "";
    const digest = crypto.createHmac("sha256", secret).update(message).digest("hex");

    const isValidHmac =
      digest.length === hmac.length &&
      crypto.timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(hmac, "utf8"));

    if (!isValidHmac) {
      console.error("[OAuthCallback] HMAC signature validation failed!");
      throw authErr;
    }

    console.log("[OAuthCallback] HMAC cryptographic signature verified! Exchanging authorization code directly with Shopify...");
    const tokenResponse = await fetch(`https://${cleanShop}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code,
        expiring: "1",
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error("[OAuthCallback] Direct token exchange failed:", tokenResponse.status, errText);
      throw new Error(`Shopify token exchange failed (HTTP ${tokenResponse.status}): ${errText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log("[OAuthCallback] Direct token exchange succeeded! Token received with expiresIn:", tokenData.expires_in);

    const now = new Date();
    session = new Session({
      id: `offline_${cleanShop}`,
      shop: cleanShop,
      state: searchParams.get("state") || "offline",
      isOnline: false,
      accessToken: tokenData.access_token,
      scope: tokenData.scope,
      expires: tokenData.expires_in ? new Date(now.getTime() + tokenData.expires_in * 1000) : undefined,
    });

    if (tokenData.refresh_token) {
      (session as any).refreshToken = tokenData.refresh_token;
    }
    if (tokenData.refresh_token_expires_in) {
      (session as any).refreshTokenExpires = new Date(
        now.getTime() + tokenData.refresh_token_expires_in * 1000
      );
    }
  }

  const { shop, accessToken, scope } = session;
  console.log("OAuth Session Scope:", scope);

  console.log("===== TOKEN RESPONSE =====");
  console.log({
    hasAccessToken: !!session.accessToken,
    hasRefreshToken: !!(session as any).refreshToken,
    expires: session.expires,
  });

  const maskedToken = accessToken
    ? `${accessToken.substring(0, 10)}...${accessToken.substring(accessToken.length - 4)}`
    : "null";

  console.log("=== INCOMING TOKEN DATA ===");
  console.log("Token Type:", session.isOnline ? "ONLINE TOKEN" : "OFFLINE TOKEN");
  console.log("Token Starts With:", accessToken?.substring(0, 12));
  console.log("===== OAUTH CALLBACK =====");
  console.log("Shop:", session.shop);
  console.log("Timestamp:", new Date().toISOString());
  console.log("Offline Token Received:", session.accessToken?.substring(0, 12) + "...");

  console.log("[OAuthCallback] Complete Session Object received:", {
    id: session.id,
    shop: session.shop,
    state: session.state,
    isOnline: session.isOnline,
    scope: session.scope,
    expires: session.expires,
    accessToken: maskedToken,
  });

  if (!accessToken) {
    throw new Error("No access token provided by Shopify");
  }

  console.log("===== SAVING SESSION =====");
  console.log({
    shop: session.shop,
    hasAccessToken: !!session.accessToken,
    hasRefreshToken: !!(session as any).refreshToken,
  });
  console.log("[OAuthCallback] Attempting storeSession...");
  await shopify.config.sessionStorage.storeSession(session);
  console.log("[OAuthCallback] storeSession completed successfully.");

  try {
    const dbSession = await prisma.session.findUnique({ where: { id: session.id } });
    console.log("[DBVerification] Post-write Session check:", {
      exists: Boolean(dbSession),
      storedId: dbSession?.id,
      storedShop: dbSession?.shop,
    });
  } catch (dbErr: any) {
    console.error("[DBVerification] Error querying Session table post-write:", dbErr.message);
  }

  const normalizedShop = shop.trim().toLowerCase();

  await cleanupSeededData();

  let shopLabel = normalizedShop;
  let shopifyStoreId: string | null = null;
  try {
    console.log("[OAuth] Fetching shop details from Shopify GraphQL API for:", normalizedShop);
    const client = new shopify.clients.Graphql({ session });
    const shopResponse: any = await client.request(`
      query {
        shop {
          id
          name
        }
      }
    `);

    if (shopResponse.data?.shop?.name) {
      shopLabel = shopResponse.data.shop.name;
      console.log("[OAuth] Successfully retrieved shop name:", shopLabel);
    } else {
      console.log("[OAuth] Shop query returned empty or missing name. Defaulting label to domain.");
    }

    if (shopResponse.data?.shop?.id) {
      shopifyStoreId = shopResponse.data.shop.id;
    }
  } catch (error: any) {
    console.error("[OAuth] Failed to fetch shop details from Shopify:", error.message);
    console.log("[OAuth] Falling back to shop domain as label:", normalizedShop);
  }
  console.log("[OAuth] Upserting store record in database for shop:", normalizedShop);

  const existingStore = await prisma.store.findUnique({ where: { shopDomain: normalizedShop } });
  const isReinstall = existingStore && !existingStore.isActive;

  const updateData: any = {
    accessToken: accessToken,
    scope: scope || "",
    isActive: true,
    label: shopLabel,
    authStatus: AuthStatus.AUTHENTICATED,
  };

  if (shopifyStoreId) {
    updateData.shopifyStoreId = shopifyStoreId;
  }

  if (isReinstall) {
    updateData.uniqueStoreId = `STORE-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  }

  console.log("Saving Store Token");
  console.log("Shop:", normalizedShop);
  console.log("Store Updated");

  const storedShop = await prisma.$transaction(async (tx) => {
    console.log("===== SAVING STORE =====");
    console.log({
      shop: normalizedShop,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!(session as any).refreshToken,
      expiresAt: session.expires || null,
      refreshTokenExpiresAt: (session as any).refreshTokenExpires || null,
    });

    const encryptedAccessToken = encrypt(accessToken);
    const encryptedRefreshToken = (session as any).refreshToken
      ? encrypt((session as any).refreshToken)
      : null;

    const updateDataToSave: any = {
      ...updateData,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      expiresAt: session.expires || null,
      refreshTokenExpiresAt: (session as any).refreshTokenExpires || null,
      authStatus: AuthStatus.AUTHENTICATED,
      lastAuthFailure: null,
      authFailureReason: null,
    };

    const store = await tx.store.upsert({
      where: { shopDomain: normalizedShop },
      update: updateDataToSave,
      create: {
        shopDomain: normalizedShop,
        shopifyStoreId: shopifyStoreId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: session.expires || null,
        refreshTokenExpiresAt: (session as any).refreshTokenExpires || null,
        scope: scope || "",
        isActive: true,
        label: shopLabel,
        bestSellerThreshold: 20,
        deadStockDays: 90,
        uniqueStoreId: `STORE-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      },
    });

    const testClient = new shopify.clients.Graphql({ session });

    try {
      const result = await testClient.request(`
    query {
      shop {
        name
      }
    }
  `);

      console.log("OAuth Test:", result.data.shop.name);
    } catch (err) {
      console.error("OAuth Test Failed:", err);
    }

    await tx.authAudit.create({
      data: {
        shopDomain: normalizedShop,
        event: "OAuth Completed",
        success: true,
        message: `App ${isReinstall ? "reinstalled" : "installed"} successfully.`,
      }
    });

    return store;
  });

  console.log("[OAuth] Store record and audit log persisted successfully:", {
    id: storedShop.id,
    shopDomain: storedShop.shopDomain,
    label: storedShop.label,
    isActive: storedShop.isActive
  });

  // Post-store database verification
  try {
    const dbStore = await prisma.store.findUnique({ where: { shopDomain: normalizedShop } });
    const storeMaskedToken = dbStore?.accessToken
      ? `${dbStore.accessToken.substring(0, 10)}...${dbStore.accessToken.substring(dbStore.accessToken.length - 4)}`
      : "null";
    console.log("[DBVerification] Post-write Store check:", {
      exists: Boolean(dbStore),
      id: dbStore?.id,
      shopDomain: dbStore?.shopDomain,
      accessTokenSaved: Boolean(dbStore?.accessToken),
      accessTokenMasked: storeMaskedToken,
    });
  } catch (dbErr: any) {
    console.error("[DBVerification] Error querying Store table post-write:", dbErr.message);
  }

  // Register Shopify webhooks
  try {
    await registerWebhooks(session);
    console.log("[OAuth] Webhooks registered successfully");
  } catch (error: any) {
    console.error("[OAuth] Webhook registration failed:", error.message);
  }

  // Trigger product and inventory synchronization in background (silent: avoid spamming notification bell on each login/deploy)
  syncStoreProducts(normalizedShop, { sendNotification: false })
    .then((result) => {
      console.log(`[OAuth] Background initial sync complete for ${normalizedShop}`, result);
    })
    .catch((error: any) => {
      console.error(`[OAuth] Background initial sync failed for ${normalizedShop}:`, error.message);
    });

  // Get embedded app URL to redirect the user
  let redirectUrl: string;
  try {
    redirectUrl = await shopify.auth.getEmbeddedAppUrl({
      rawRequest: cleanRequest,
    });
  } catch (err: any) {
    console.warn("[OAuthCallback] shopify.auth.getEmbeddedAppUrl failed, calculating fallback:", err?.message);
    const host = req.nextUrl.searchParams.get("host");
    const sanitizedShop = shopify.utils.sanitizeShop(shop, true) || normalizedShop;
    if (host) {
      try {
        const decodedHost = Buffer.from(host, "base64").toString("utf8");
        redirectUrl = `https://${decodedHost}/apps/${shopify.config.apiKey}`;
      } catch {
        redirectUrl = `https://${sanitizedShop}/admin/apps/${shopify.config.apiKey}`;
      }
    } else {
      redirectUrl = `https://${sanitizedShop}/admin/apps/${shopify.config.apiKey}`;
    }
  }

  console.log("[OAuthCallback] Redirecting to embedded app URL:", redirectUrl);
  const response = NextResponse.redirect(redirectUrl);
  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      if (Array.isArray(value)) {
        value.forEach((v) => response.headers.append(key, v));
      } else {
        response.headers.set(key, value as string);
      }
    }
  }
  return response;
}

export async function verifyStoreInstallation(shop: string | null | undefined, host: string | null | undefined) {
  if (!shop) return;
  const normalizedShop = shop.trim().toLowerCase();

  const store = await prisma.store.findUnique({
    where: { shopDomain: normalizedShop },
  });

  if (!store || !store.isActive || !hasValidShopifyAccessToken(store.accessToken)) {
    console.log(`[AuthVerify] Store ${normalizedShop} not connected. Redirecting to OAuth.`);
    redirect(`/api/auth?shop=${normalizedShop}&host=${host || ""}&embedded=1`);
  }
}
