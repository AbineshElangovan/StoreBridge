import { NextRequest, NextResponse } from "next/server";
import { authenticate, handleApiError } from "@/lib/shopify/authenticate";
import { prisma } from "@/lib/db/prisma";
import { getAdminClient } from "@/lib/shopify/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { store } = await authenticate(req);

    // Fetch all cached product/variant items for the store with collections
    const cacheItems = await prisma.productCache.findMany({
      where: { storeId: store.id },
      select: {
        id: true,
        shopifyProductId: true,
        title: true,
        sku: true,
        tags: true,
        imageUrl: true,
        price: true,
        collections: {
          select: {
            collection: {
              select: {
                id: true,
                title: true,
              }
            }
          }
        }
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
      variantCount: number;
      allSkus: string[];
      tags: string[];
      collections: { id: string; title: string }[];
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
          variantCount: 0,
          allSkus: [],
          tags: item.tags ? item.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
          collections: [],
        };
        productMap.set(item.shopifyProductId, existing);
      }

      // Count this variant item
      existing.variantCount += 1;

      // Add collections
      if (item.collections && item.collections.length > 0) {
        for (const cp of item.collections) {
          if (cp.collection && !existing.collections.some(c => c.id === cp.collection.id)) {
            existing.collections.push({ id: cp.collection.id, title: cp.collection.title });
          }
        }
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

    // Merge any extra SKUs and count from VariantMap
    for (const vm of variantMaps) {
      const existing = productMap.get(vm.shopifyProductId);
      if (existing) {
        if (vm.sku && vm.sku.trim() !== "" && vm.sku !== "N/A") {
          const cleanSku = vm.sku.trim();
          if (!existing.allSkus.includes(cleanSku)) {
            existing.allSkus.push(cleanSku);
          }
          if (!existing.sku) {
            existing.sku = cleanSku;
          }
        }
      }
    }

    // Ensure variantCount is at least the number of unique SKUs or 1
    for (const p of productMap.values()) {
      p.variantCount = Math.max(p.variantCount, p.allSkus.length, 1);
    }

    const cachedProducts = Array.from(productMap.values());

    // Verify against live Shopify products to filter out deleted/archived items and populate missing images
    let finalProducts = cachedProducts;
    try {
      const client = await getAdminClient(store.shopDomain);
      const shopifyRes: any = await client.request(`
        query getActiveProducts {
          products(first: 250) {
            edges {
              node {
                id
                title
                status
                featuredImage {
                  url
                }
              }
            }
          }
        }
      `);

      const rawProductsData = shopifyRes?.data?.products || shopifyRes?.body?.data?.products || shopifyRes?.products;
      const rawNodes = rawProductsData?.edges
        ? rawProductsData.edges.map((e: any) => e.node)
        : (rawProductsData?.nodes || []);

      if (rawNodes.length > 0) {
        const activeNodes = rawNodes.filter(
          (n: any) => n.status !== "ARCHIVED" && n.status !== "DELETED"
        );

        const liveGids = new Set(activeNodes.map((n: any) => n.id));
        const liveNumericIds = new Set(
          activeNodes.map((n: any) => n.id.replace(/^gid:\/\/shopify\/Product\//i, ""))
        );

        // Map live featured images to product map
        for (const node of activeNodes) {
          const rawGid = node.id;
          const cleanId = rawGid.replace(/^gid:\/\/shopify\/Product\//i, "");
          const liveImg = node.featuredImage?.url || null;

          const existing = productMap.get(rawGid) || productMap.get(cleanId);
          if (existing && liveImg && !existing.imageUrl) {
            existing.imageUrl = liveImg;
          }
        }

        finalProducts = Array.from(productMap.values()).filter((p) => {
          const rawGid = p.shopifyProductId.startsWith("gid://")
            ? p.shopifyProductId
            : `gid://shopify/Product/${p.shopifyProductId}`;
          const cleanId = p.shopifyProductId.replace(/^gid:\/\/shopify\/Product\//i, "");

          return liveGids.has(rawGid) || liveNumericIds.has(cleanId) || liveGids.has(p.shopifyProductId);
        });

        // Clean up orphaned cache items for deleted products in the background
        const deletedProductIds = cachedProducts
          .filter((p) => !finalProducts.some((fp) => fp.id === p.id))
          .map((p) => p.shopifyProductId);

        if (deletedProductIds.length > 0) {
          console.log("[SKU API] Cleaning up deleted products from DB cache:", deletedProductIds);
          prisma.productCache
            .deleteMany({
              where: { storeId: store.id, shopifyProductId: { in: deletedProductIds } },
            })
            .catch((err) => console.error("Error purging deleted productCache:", err));

          prisma.variantMap
            .deleteMany({
              where: { storeId: store.id, shopifyProductId: { in: deletedProductIds } },
            })
            .catch((err) => console.error("Error purging deleted variantMap:", err));
        }
      }
    } catch (shopifyErr: any) {
      console.warn("[SKU API] Live Shopify product check skipped/failed, using cached active products:", shopifyErr.message);
    }

    return NextResponse.json({
      success: true,
      products: finalProducts,
    });
  } catch (err: any) {
    console.error("[SKU API] GET Products Error:", err.message);
    return handleApiError(err);
  }
}
