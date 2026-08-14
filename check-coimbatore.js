const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.store.findFirst({
    where: { shopDomain: { contains: 'coimbatore' } }
  });
  const m = await prisma.store.findFirst({
    where: { isMaster: true }
  });

  if(!c) {
    console.log('Coimbatore store not found');
    return;
  }
  
  console.log('--- COIMBATORE STORE DATA ---');
  
  const globalAdj = await prisma.store.findUnique({
    where: {id: c.id}, 
    select: {priceAdjustmentValue: true, isPriceAdjustmentEnabled: true}
  });
  console.log('\nGlobal Settings:', globalAdj);

  const adjs = await prisma.collectionPriceAdjustment.findMany({where: {storeId: c.id}});
  console.log('\nCollection Adjustments:');
  if (adjs.length > 0) {
    adjs.forEach(a => console.log(`- Collection ${a.collectionId}: ${a.adjustmentValue}% (Enabled: ${a.enabled})`));
  } else {
    console.log('No collection adjustments active');
  }

  const products = await prisma.productCache.findMany({where: {storeId: c.id}, take: 3});
  console.log('\nSample Prices vs Master:');
  for (const p of products) {
    const mProd = await prisma.productCache.findFirst({where: {storeId: m.id, sku: p.sku}});
    console.log(`- ${p.title} | Master: $${mProd ? mProd.price : 'N/A'} -> Coimbatore: $${p.price}`);
  }
}

main().catch(console.error);
