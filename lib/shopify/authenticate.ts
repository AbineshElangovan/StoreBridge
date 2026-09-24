import { NextRequest, NextResponse } from "next/server";
import { shopify } from "@/lib/shopify";
import { prisma } from "@/lib/db/prisma";

export class AuthError extends Error { }

export async function authenticate(req: NextRequest) {
  // Extract requested shop domain from headers, URL searchParams, referer, or cookies
  let requestedShop = 
    req.headers.get("x-shopify-shop-domain") || 
    req.headers.get("x-shop-domain") || 
    req.nextUrl?.searchParams?.get("shop");

  if (!requestedShop && req.headers.get("referer")) {
    try {
      const refererUrl = new URL(req.headers.get("referer")!);
      requestedShop = refererUrl.searchParams.get("shop");
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

    return prisma.store.findFirst({
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
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");

  // 1. PRIORITIZE SHOPIFY APP BRIDGE SESSION TOKEN (Authoritative store identity)
  if (token && token !== "dev_fallback_token") {
    try {
      const payload = await shopify.session.decodeSessionToken(token);
      if (payload?.dest) {
        const tokenShop = payload.dest.replace(/^https?:\/\//, "");
        const store = await findStore(tokenShop) || await findStore(requestedShop);
        if (store && store.isActive) {
          return { shop: store.shopDomain, store };
        }
      }
    } catch (tokenErr) {
      console.warn("[authenticate] App Bridge session token decode warning:", tokenErr);
    }
  }

  // 2. DEV / LOCALHOST / DIRECT BROWSING FALLBACK
  let store = await findStore(requestedShop);
  
  if (!store && requestedShop) {
    store = await prisma.store.findFirst({
      where: {
        isActive: true,
        label: { contains: requestedShop, mode: 'insensitive' }
      }
    });

    // If a specific shop was requested by the browser/App Bridge but it is inactive or not found,
    // DO NOT silently fall back to another store (like Namakkal or Chennai)!
    // Reject with a clear message so the frontend redirects to /api/auth to install/activate it.
    if (!store) {
      throw new AuthError("Store not installed or inactive");
    }
  }

  if (!store) {
    store = await prisma.store.findFirst({ where: { isMaster: true, isActive: true } })
      || await prisma.store.findFirst({ where: { isActive: true } });
  }

  if (store && store.isActive) {
    return { shop: store.shopDomain, store };
  }

  throw new AuthError("Store not installed or inactive");
}

export function handleApiError(error: any) {
  if (error instanceof AuthError) {
    return NextResponse.json({ success: false, message: error.message }, { status: 401 });
  }
  return NextResponse.json({ success: false, error: error.message }, { status: 500 });
}