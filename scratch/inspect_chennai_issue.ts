import { prisma } from "../lib/db/prisma";
import { getAdminClient } from "../lib/shopify/admin";

async function main() {
  const chennai = await prisma.store.findFirst({
    where: { shopDomain: "eshan-inventory-solutions.myshopify.com" },
  });
  if (!chennai) {
    console.log("Chennai store not found!");
    return;
  }

  console.log(`Chennai Store ID: ${chennai.id}, Domain: ${chennai.shopDomain}`);

  // 2. Fetch all products from Shopify for Chennai
  const client = await getAdminClient(chennai.shopDomain);
  const res: any = await client.request(`
    query {
      products(first: 250) {
        nodes {
          id
          title
          status
          createdAt
          updatedAt
          variants(first: 50) {
            nodes {
              id
              title
              sku
              price
            }
          }
        }
      }
    }
  `);

  const shopifyProds = res.data?.products?.nodes || [];
  console.log(`\nShopify Total Products in Chennai: ${shopifyProds.length}`);

  // 3. Fetch all ProductCache rows for Chennai
  const dbProds = await prisma.productCache.findMany({
    where: { storeId: chennai.id },
  });
  console.log(`DB Total ProductCache rows for Chennai: ${dbProds.length}`);

  const shopifyGids = new Set(shopifyProds.map((p: any) => p.id));
  const shopifyNumIds = new Set(shopifyProds.map((p: any) => p.id.replace("gid://shopify/Product/", "")));

  // Products in DB but NOT in Shopify
  const dbNotInShopify = dbProds.filter(
    (p) => !shopifyGids.has(p.shopifyProductId) && !shopifyNumIds.has(p.shopifyProductId.replace("gid://shopify/Product/", ""))
  );
  console.log(`\nDB products NOT IN SHOPIFY (${dbNotInShopify.length}):`);
  for (const p of dbNotInShopify) {
    console.log(`  - DB id: ${p.id}, shopifyProductId: ${p.shopifyProductId}, title: "${p.title}"`);
  }

  // Check titles that appear multiple times in Shopify
  const titleGroups: Record<string, any[]> = {};
  for (const p of shopifyProds) {
    const cleanTitle = p.title.split(" - ")[0].trim();
    if (!titleGroups[cleanTitle]) titleGroups[cleanTitle] = [];
    titleGroups[cleanTitle].push(p);
  }

  console.log("\n--- Shopify Duplicate Products in Chennai ---");
  for (const [title, prods] of Object.entries(titleGroups)) {
    if (prods.length > 1) {
      console.log(`Title: "${title}" (${prods.length} products in Shopify):`);
      for (const p of prods) {
        const skus = p.variants.nodes.map((v: any) => v.sku).join(", ");
        console.log(`  - ID: ${p.id} | Created: ${p.createdAt} | Updated: ${p.updatedAt} | SKUs: [${skus}]`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
