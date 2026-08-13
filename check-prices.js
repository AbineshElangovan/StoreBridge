const { PrismaClient } = require('@prisma/client');
const { getAdminClient } = require('./lib/shopify/admin.ts'); // Wait, can't require TS.

async function main() {
  const prisma = new PrismaClient();
  const k = await prisma.store.findFirst({where: {shopDomain: {contains: 'karur'}}});
  const p = await prisma.productCache.findFirst({where: {storeId: k.id, title: {contains: 'Maroon Boxer Briefs'}}});
  console.log("DB Price:", p.price);
}
main().catch(console.error);
