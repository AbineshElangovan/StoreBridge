import { NextRequest, NextResponse } from "next/server";
import { authenticate, handleApiError } from "@/lib/shopify/authenticate";
import { prisma } from "@/lib/db/prisma";
import { getAdminClient } from "@/lib/shopify/admin";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { store } = await authenticate(req);
    const { productId: rawParam } = await params;
    const decodedId = decodeURIComponent(rawParam).trim();
    const cleanId = decodedId.replace(/^gid:\/\/shopify\/Product\//i, "").split("/").pop() || decodedId;

    const targetProduct = await prisma.productCache.findFirst({
      where: {
        storeId: store.id,
        OR: [
          { id: decodedId },
          { shopifyProductId: decodedId },
          { shopifyProductId: cleanId },
          { shopifyProductId: `gid://shopify/Product/${cleanId}` },
        ],
      },
    });

    if (!targetProduct) {
      return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
    }

    const variants = await prisma.productCache.findMany({
      where: {
        storeId: store.id,
        shopifyProductId: targetProduct.shopifyProductId,
      },
      orderBy: { createdAt: "asc" },
    });

    // Detect existing option names and values dynamically
    const optionsMap = new Map<string, Set<string>>();

    // 1. Try fetching options live from Shopify GraphQL if store domain active
    try {
      const client = await getAdminClient(store.shopDomain);
      const prodGid = targetProduct.shopifyProductId.startsWith("gid://")
        ? targetProduct.shopifyProductId
        : `gid://shopify/Product/${targetProduct.shopifyProductId}`;

      const res: any = await client.request(
        `
        query getProductOptions($id: ID!) {
          product(id: $id) {
            options {
              name
              values
            }
          }
        }
      `,
        { variables: { id: prodGid } }
      );

      const shopifyOptions = res?.data?.product?.options || res?.product?.options || [];
      for (const opt of shopifyOptions) {
        if (opt.name && opt.name !== "Title") {
          optionsMap.set(opt.name, new Set(opt.values || []));
        }
      }
    } catch (shopifyErr: any) {
      console.warn("[SKU API] Shopify options fetch notice:", shopifyErr.message);
    }

    // 2. Fallback / supplementary: Parse options from cached titles if empty
    if (optionsMap.size === 0 && variants.length > 0) {
      for (const v of variants) {
        if (v.optionsJson && typeof v.optionsJson === "object") {
          for (const [key, val] of Object.entries(v.optionsJson)) {
            if (!optionsMap.has(key)) optionsMap.set(key, new Set());
            optionsMap.get(key)!.add(String(val));
          }
        } else if (v.title && v.title !== targetProduct.title) {
          const parts = v.title.split("/").map((p) => p.trim());
          if (parts.length === 1) {
            if (!optionsMap.has("Option 1")) optionsMap.set("Option 1", new Set());
            optionsMap.get("Option 1")!.add(parts[0]);
          } else if (parts.length === 2) {
            if (!optionsMap.has("Color")) optionsMap.set("Color", new Set());
            if (!optionsMap.has("Size")) optionsMap.set("Size", new Set());
            optionsMap.get("Color")!.add(parts[0]);
            optionsMap.get("Size")!.add(parts[1]);
          } else if (parts.length >= 3) {
            if (!optionsMap.has("Color")) optionsMap.set("Color", new Set());
            if (!optionsMap.has("Size")) optionsMap.set("Size", new Set());
            if (!optionsMap.has("Year / Style")) optionsMap.set("Year / Style", new Set());
            optionsMap.get("Color")!.add(parts[0]);
            optionsMap.get("Size")!.add(parts[1]);
            optionsMap.get("Year / Style")!.add(parts[2]);
          }
        }
      }
    }

    const detectedOptions = Array.from(optionsMap.entries()).map(([name, valuesSet]) => ({
      name,
      values: Array.from(valuesSet),
    }));

    return NextResponse.json({
      success: true,
      product: {
        id: targetProduct.id,
        shopifyProductId: targetProduct.shopifyProductId,
        title: targetProduct.title,
        sku: targetProduct.sku,
        imageUrl: targetProduct.imageUrl,
        price: targetProduct.price,
      },
      variants: variants.map((v) => ({
        id: v.id,
        shopifyVariantId: v.shopifyVariantId,
        title: v.title,
        sku: v.sku,
        price: v.price,
        inventoryQuantity: v.inventoryQuantity,
      })),
      detectedOptions,
    });
  } catch (err: any) {
    console.error("[SKU API] GET Variants Error:", err.message);
    return handleApiError(err);
  }
}
