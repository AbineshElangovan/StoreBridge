import { prisma } from "../lib/db/prisma";
import { getAdminClient } from "../lib/shopify/admin";

async function main() {
  const chennai = await prisma.store.findFirst({
    where: { shopDomain: "eshan-inventory-solutions.myshopify.com" },
  });
  if (!chennai) {
    console.log("No chennai store");
    return;
  }

  // Check DB for any product with 'refrf' in title or sku or shopifyProductId
  const inDb = await prisma.productCache.findMany({
    where: {
      storeId: chennai.id,
      OR: [
        { title: { contains: "refrf", mode: "insensitive" } },
        { sku: { contains: "0009" } },
        { sku: { contains: "0010" } },
        { shopifyProductId: { contains: "10311407501526" } },
      ],
    },
  });
  console.log(`Chennai DB matches for refrf / 0009 / 0010: ${inDb.length}`, inDb);

  // Check Shopify directly in Chennai
  const client = await getAdminClient(chennai.shopDomain);
  const res: any = await client.request(`
    query {
      products(first: 250) {
        nodes {
          id
          title
          handle
          variants(first: 10) {
            nodes {
              id
              title
              sku
            }
          }
        }
      }
    }
  `);

  const allShopifyProds = res.data?.products?.nodes || [];
  console.log(`Total products on Shopify in Chennai: ${allShopifyProds.length}`);

  const refrfShopify = allShopifyProds.filter(
    (p: any) =>
      p.title.toLowerCase().includes("refrf") ||
      p.handle.toLowerCase().includes("refrf") ||
      p.variants.nodes.some((v: any) => (v.sku || "").includes("0009") || (v.sku || "").includes("0010"))
  );
  console.log(`Chennai Shopify matches for refrf: ${refrfShopify.length}`);
  for (const p of refrfShopify) {
    console.log(`  - ID: ${p.id} | Title: "${p.title}" | Variants:`, p.variants.nodes);
  }

  // Also print all 54 products on Chennai Shopify to see exactly what products exist!
  console.log("\n--- All Products in Chennai on Shopify ---");
  for (const p of allShopifyProds) {
    const vList = p.variants.nodes.map((v: any) => `${v.title} (${v.sku || "NO_SKU"})`).join(", ");
    console.log(`- [${p.id}] "${p.title}" -> ${vList}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
