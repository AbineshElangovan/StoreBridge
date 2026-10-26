import { NextRequest, NextResponse } from "next/server";
import { shopify } from "@/lib/shopify";
import { prisma } from "@/lib/db/prisma";

export class AuthError extends Error { }

/**
 * Helper to determine if a store is standalone.
 * A store is Standalone if:
 * 1. It is NOT marked as a Master store (`!store.isMaster`)
 * 2. It has NO incoming or outgoing connections in `StoreConnection`
 */
export async function isStoreStandalone(storeId: string): Promise<boolean> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, isMaster: true },
  });
  if (!store || store.isMaster) {
    return false;
  }
  const connectionCount = await (prisma as any).storeConnection.count({
    where: {
      OR: [
        { sourceStoreId: storeId },
        { targetStoreId: storeId },
      ],
    },
  });
  return connectionCount === 0;
}

export async function authenticate(req: NextRequest) {
  // Extract requested shop domain from headers, URL searchParams, referer, or cookies
  let requestedShop = 
    req.headers.get("x-shopify-shop-domain") || 
    req.headers.get("x-shop-domain") || 
    req.nextUrl?.searchParams?.get("shop");

  let masterShop =
    req.headers.get("x-master-shop") ||
    req.nextUrl?.searchParams?.get("master_shop");

  if (!requestedShop && req.headers.get("referer")) {
    try {
      const refererUrl = new URL(req.headers.get("referer")!);
      requestedShop = refererUrl.searchParams.get("shop");
      if (!masterShop) {
        masterShop = refererUrl.searchParams.get("master_shop");
      }
    } catch (e) {}
  }

  if (!requestedShop) {
    requestedShop = req.cookies.get("shopify_shop")?.value || null;
  }

  // Helper to match store in DB by domain, label, or ID
  async function findStore(shopStr: string | null) {
    if (!shopStr) return null;
    const clean = shopStr.trim().toLowerCase();
    const prefix = clean.split('.')[0].replace(/^https?:\/\//, '');

    const activeStore = await prisma.store.findFirst({
      where: {
        isActive: true,
        OR: [
          { shopDomain: clean },
          { shopDomain: { contains: prefix, mode: 'insensitive' } },
          { label: { contains: prefix, mode: 'insensitive' } },
          { uniqueStoreId: clean },
          { id: clean }
        ]
      }
    });
    if (activeStore) return activeStore;

    return prisma.store.findFirst({
      where: {
        OR: [
          { shopDomain: clean },
          { shopDomain: { contains: prefix, mode: 'insensitive' } },
          { label: { contains: prefix, mode: 'insensitive' } },
          { uniqueStoreId: clean },
          { id: clean }
        ]
      }
    });
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");

  // 1. PRIORITIZE SHOPIFY APP BRIDGE SESSION TOKEN (Authoritative store identity)
  if (token && token !== "dev_fallback_token") {
    try {
      const payload = await shopify.session.decodeSessionToken(token);
      if (payload?.dest) {
        const tokenShop = payload.dest.replace(/^https?:\/\//, "");
        const sessionStore = await findStore(tokenShop);

        if (sessionStore && sessionStore.isActive) {
          // If the authenticated session is MASTER:
          if (sessionStore.isMaster) {
            // Master store can manage itself or switch to any of its connected stores
            if (requestedShop && requestedShop !== sessionStore.shopDomain) {
              const targetStore = await findStore(requestedShop);
              if (targetStore && targetStore.isActive) {
                const isConnected = await prisma.storeConnection.findFirst({
                  where: {
                    sourceStoreId: sessionStore.id,
                    targetStoreId: targetStore.id
                  }
                });
                if (isConnected || targetStore.id === sessionStore.id) {
                  const targetStandalone = await isStoreStandalone(targetStore.id);
                  return {
                    shop: targetStore.shopDomain,
                    store: targetStore,
                    sessionStore,
                    isMasterSession: true,
                    isStandalone: targetStandalone,
                  };
                }

                // If target is an independent standalone store, allow accessing it directly as standalone
                const targetStandalone = await isStoreStandalone(targetStore.id);
                if (targetStandalone) {
                  return {
                    shop: targetStore.shopDomain,
                    store: targetStore,
                    sessionStore: targetStore,
                    isMasterSession: false,
                    isStandalone: true,
                  };
                }
              }
            }
            return {
              shop: sessionStore.shopDomain,
              store: sessionStore,
              sessionStore,
              isMasterSession: true,
              isStandalone: false,
            };
          } else {
            // CONNECTED STORE SESSION:
            // Strictly restricted to this store ONLY! Cannot switch to any other store.
            const standalone = await isStoreStandalone(sessionStore.id);
            return {
              shop: sessionStore.shopDomain,
              store: sessionStore,
              sessionStore,
              isMasterSession: false,
              isStandalone: standalone,
            };
          }
        }
      }
    } catch (tokenErr) {
      console.warn("[authenticate] App Bridge session token decode warning:", tokenErr);
    }
  }

  // 2. DEV / LOCALHOST / DIRECT BROWSING FALLBACK
  // If masterShop was provided, verify it is an active master store
  if (masterShop) {
    const master = await findStore(masterShop);
    if (master && master.isMaster && master.isActive) {
      if (requestedShop && requestedShop !== master.shopDomain) {
        const targetStore = await findStore(requestedShop);
        if (targetStore && targetStore.isActive) {
          const isConnected = await prisma.storeConnection.findFirst({
            where: {
              sourceStoreId: master.id,
              targetStoreId: targetStore.id
            }
          });
          if (isConnected || targetStore.id === master.id) {
            const targetStandalone = await isStoreStandalone(targetStore.id);
            return {
              shop: targetStore.shopDomain,
              store: targetStore,
              sessionStore: master,
              isMasterSession: true,
              isStandalone: targetStandalone,
            };
          }

          // If target is an independent standalone store, allow accessing it directly
          const targetStandalone = await isStoreStandalone(targetStore.id);
          if (targetStandalone) {
            return {
              shop: targetStore.shopDomain,
              store: targetStore,
              sessionStore: targetStore,
              isMasterSession: false,
              isStandalone: true,
            };
          }
        }
      }
      return {
        shop: master.shopDomain,
        store: master,
        sessionStore: master,
        isMasterSession: true,
        isStandalone: false,
      };
    }
  }

  let store = await findStore(requestedShop);
  
  if (!store && requestedShop) {
    store = await prisma.store.findFirst({
      where: {
        isActive: true,
        label: { contains: requestedShop, mode: 'insensitive' }
      }
    });
  }

  // Graceful fallback to active Master store or any active store
  if (!store) {
    store = await prisma.store.findFirst({ where: { isMaster: true, isActive: true } })
      || await prisma.store.findFirst({ where: { isActive: true } });
  }

  if (!store) {
    throw new AuthError("Store not installed or inactive");
  }

  if (store) {
    const standalone = await isStoreStandalone(store.id);
    return {
      shop: store.shopDomain,
      store,
      sessionStore: store,
      isMasterSession: Boolean(store.isMaster),
      isStandalone: standalone,
    };
  }

  throw new AuthError("Store not installed or inactive");
}

export function handleApiError(error: any) {
  if (error instanceof AuthError) {
    return NextResponse.json({ success: false, message: error.message }, { status: 401 });
  }
  return NextResponse.json({ success: false, error: error.message }, { status: 500 });
}