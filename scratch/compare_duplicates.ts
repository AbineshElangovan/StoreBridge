import { prisma } from "../lib/db/prisma";

async function main() {
  const coimbatore = await prisma.store.findFirst({
    where: { label: { contains: "Coimbatore" } },
  });
  const chennai = await prisma.store.findFirst({
    where: { shopDomain: "eshan-inventory-solutions.myshopify.com" },
  });

  const duplicateTitles = [
    "Cotton T-shirt",
    "Classic Cotton T-Shirt",
    "Premium Leather Wallet",
    "Colorful T-shirt",
    "maroon shirt",
    "colored t-shirt",
    "T-shirt",
    "Premium Running Shoes",
  ];

  console.log("=== COMPARING DUPLICATE TITLES IN CHENNAI VS MASTER (COIMBATORE) ===\n");

  for (const title of duplicateTitles) {
    const cbe = await prisma.productCache.findMany({
      where: {
        storeId: coimbatore!.id,
        title: { startsWith: title },
      },
      select: { shopifyProductId: true, title: true, sku: true },
    });

    const chn = await prisma.productCache.findMany({
      where: {
        storeId: chennai!.id,
        title: { startsWith: title },
      },
      select: { shopifyProductId: true, title: true, sku: true },
    });

    console.log(`--------------------------------------------------`);
    console.log(`TITLE: "${title}"`);
    console.log(`Master (Coimbatore) [${cbe[0]?.shopifyProductId}]:`);
    for (const p of cbe) {
      console.log(`  - Variant: "${p.title}" | SKU: ${p.sku}`);
    }

    const chnById: Record<string, typeof chn> = {};
    for (const p of chn) {
      if (!chnById[p.shopifyProductId]) chnById[p.shopifyProductId] = [];
      chnById[p.shopifyProductId].push(p);
    }

    console.log(`Chennai (${Object.keys(chnById).length} products):`);
    for (const [pId, prods] of Object.entries(chnById)) {
      const skus = prods.map((p) => p.sku).filter(Boolean);
      const matchesMaster = skus.some((s) => cbe.map((c) => c.sku).includes(s));
      console.log(`  * [${pId}] ${matchesMaster ? "--> [ACTIVE MATCH WITH MASTER]" : "--> [OLD / EXTRA DUPLICATE]"}`);
      for (const p of prods) {
        console.log(`      "${p.title}" | SKU: ${p.sku}`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
