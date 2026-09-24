import { prisma } from "../lib/db/prisma";

async function main() {
  const chennai = await prisma.store.findFirst({
    where: { shopDomain: "eshan-inventory-solutions.myshopify.com" },
  });
  if (!chennai) return;

  const prods = await prisma.productCache.findMany({
    where: {
      storeId: chennai.id,
      OR: [
        { title: { contains: "refrf", mode: "insensitive" } },
        { shopifyProductId: { contains: "10311407501526" } },
      ],
    },
  });
  console.log("Matches in Chennai DB for refrf / 10311407501526:", prods.length);
  for (const p of prods) {
    console.log("- ID:", p.id, "Title:", p.title, "ShopifyId:", p.shopifyProductId);
  }

  // Also check if there are any products in Chennai DB where shopifyProductId does not exist on Shopify!
  const allChennaiDb = await prisma.productCache.findMany({
    where: { storeId: chennai.id },
    select: { id: true, shopifyProductId: true, title: true },
  });

  const { getAdminClient } = await import("../lib/shopify/admin");
  const client = await getAdminClient(chennai.shopDomain);
  const res: any = await client.request("{ products(first: 250) { nodes { id } } }");
  const liveGids = new Set((res.data?.products?.nodes || []).map((n: any) => n.id));

  const ghostInDb = allChennaiDb.filter(p => !liveGids.has(p.shopifyProductId));
  console.log(`\nGhost products in Chennai DB (not in Shopify): ${ghostInDb.length}`);
  for (const g of ghostInDb) {
    console.log("- Ghost DB id:", g.id, "Title:", g.title, "ShopifyId:", g.shopifyProductId);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
