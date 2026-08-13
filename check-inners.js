const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const m = await prisma.store.findFirst({where: {isMaster: true}});
  const c = await prisma.collection.findUnique({where: {id: '9f1e6d03-1e08-48c4-9e31-285904c1cb02'}});
  const cps = await prisma.collectionProduct.findMany({
    where: {collectionId: c.id}, 
    include: {productCache: {include: {store: true}}}
  });
  
  console.log('Prices for INNERS collection in Coimbatore:');
  for (const cp of cps) {
    const p = cp.productCache;
    if(p.store.shopDomain.includes('coimbatore')) {
      const mProd = await prisma.productCache.findFirst({where: {storeId: m.id, sku: p.sku}});
      console.log(`- ${p.title} | Master: $${mProd ? mProd.price : 'N/A'} -> Coimbatore: $${p.price}`);
    }
  }
}
main().catch(console.error);
