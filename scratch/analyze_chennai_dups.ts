import { prisma } from "../lib/db/prisma";

async function main() {
  const coimbatore = await prisma.store.findFirst({
    where: { label: { contains: "Coimbatore" } },
  });
  const chennai = await prisma.store.findFirst({
    where: { shopDomain: "eshan-inventory-solutions.myshopify.com" },
  });

  if (!coimbatore || !chennai) {
    console.log("Stores not found");
    return;
  }

  // Get all master products
  const masterProds = await prisma.productCache.findMany({
    where: { storeId: coimbatore.id },
    select: { shopifyProductId: true, title: true, sku: true },
  });

  const masterByTitle: Record<string, { skus: string[]; id: string }> = {};
  for (const mp of masterProds) {
    const cleanTitle = mp.title.split(" - ")[0].trim();
    if (!masterByTitle[cleanTitle]) {
      masterByTitle[cleanTitle] = { skus: [], id: mp.shopifyProductId };
    }
    if (mp.sku && !masterByTitle[cleanTitle].skus.includes(mp.sku)) {
      masterByTitle[cleanTitle].skus.push(mp.sku);
    }
  }

  // Get all Chennai products
  const chennaiProds = await prisma.productCache.findMany({
    where: { storeId: chennai.id },
    select: { id: true, shopifyProductId: true, title: true, sku: true, createdAt: true, updatedAt: true },
  });

  const chennaiByTitle: Record<string, typeof chennaiProds> = {};
  for (const cp of chennaiProds) {
    const cleanTitle = cp.title.split(" - ")[0].trim();
    if (!chennaiByTitle[cleanTitle]) chennaiByTitle[cleanTitle] = [];
    chennaiByTitle[cleanTitle].push(cp);
  }

  console.log("=== Duplicate Titles in Chennai ===");
  const toKeep: string[] = [];
  const toDelete: { shopifyProductId: string; title: string; reason: string }[] = [];

  for (const [title, prods] of Object.entries(chennaiByTitle)) {
    const uniqueShopifyIds = Array.from(new Set(prods.map((p) => p.shopifyProductId)));
    if (uniqueShopifyIds.length > 1) {
      console.log(`\nTitle: "${title}" has ${uniqueShopifyIds.length} different Shopify products in Chennai:`);
      const masterInfo = masterByTitle[title];
      console.log(`  Master SKUs:`, masterInfo?.skus);

      // Analyze each duplicate
      for (const pId of uniqueShopifyIds) {
        const rows = prods.filter((p) => p.shopifyProductId === pId);
        const skus = rows.map((r) => r.sku).filter(Boolean);
        const matchesMasterSku = skus.some((s) => masterInfo?.skus.includes(s!));
        console.log(`    - ID: ${pId} | SKUs: [${skus.join(", ")}] | Matches Master: ${matchesMasterSku} | Updated: ${rows[0]?.updatedAt}`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
