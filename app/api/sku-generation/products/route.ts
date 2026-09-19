import { NextRequest, NextResponse } from "next/server";
import { authenticate, handleApiError } from "@/lib/shopify/authenticate";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { store } = await authenticate(req);

    // Fetch all cached product/variant items for the store
    const cacheItems = await prisma.productCache.findMany({
      where: { storeId: store.id },
      select: {
        id: true,
        shopifyProductId: true,
        title: true,
        sku: true,
        imageUrl: true,
        price: true,
      },
      orderBy: { title: "asc" },
    });

    // Also fetch any extra SKU mappings from VariantMap for completeness
    const variantMaps = await prisma.variantMap.findMany({
      where: { storeId: store.id },
      select: { shopifyProductId: true, sku: true },
    });

    const productMap = new Map<string, {
      id: string;
      shopifyProductId: string;
      title: string;
      sku: string | null;
      imageUrl: string | null;
      price: number;
      allSkus: string[];
    }>();

    for (const item of cacheItems) {
      let existing = productMap.get(item.shopifyProductId);
      // Clean base title by removing variant option suffix if title contains " - "
      const cleanTitle = item.title ? item.title.split(" - ")[0].trim() : "Untitled Product";

      if (!existing) {
        existing = {
          id: item.id,
          shopifyProductId: item.shopifyProductId,
          title: cleanTitle,
          sku: item.sku || null,
          imageUrl: item.imageUrl || null,
          price: item.price || 0,
          allSkus: [],
        };
        productMap.set(item.shopifyProductId, existing);
      }

      if (item.sku && item.sku.trim() !== "" && item.sku !== "N/A") {
        const cleanSku = item.sku.trim();
        if (!existing.allSkus.includes(cleanSku)) {
          existing.allSkus.push(cleanSku);
        }
        if (!existing.sku) {
          existing.sku = cleanSku;
        }
      }

      if (!existing.imageUrl && item.imageUrl) {
        existing.imageUrl = item.imageUrl;
      }
    }

    // Merge any extra SKUs from VariantMap
    for (const vm of variantMaps) {
      if (vm.sku && vm.sku.trim() !== "" && vm.sku !== "N/A") {
        const cleanSku = vm.sku.trim();
        const existing = productMap.get(vm.shopifyProductId);
        if (existing) {
          if (!existing.allSkus.includes(cleanSku)) {
            existing.allSkus.push(cleanSku);
          }
          if (!existing.sku) {
            existing.sku = cleanSku;
          }
        }
      }
    }

    const products = Array.from(productMap.values());

    return NextResponse.json({
      success: true,
      products,
    });
  } catch (err: any) {
    console.error("[SKU API] GET Products Error:", err.message);
    return handleApiError(err);
  }
}
