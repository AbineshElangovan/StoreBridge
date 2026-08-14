const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function calculateAdjustedPrice(sourcePriceStr, sourceStore, targetStore, productCollections) {
  const sourcePrice = parseFloat(sourcePriceStr || "0");
  if (isNaN(sourcePrice)) return sourcePriceStr;

  let basePrice = sourcePrice;
  
  const sourceRules = await prisma.collectionPriceAdjustment.findMany({
    where: { storeId: sourceStore?.id, enabled: true, collection: { title: { in: productCollections } } },
    include: { collection: true }
  });

  if (sourceRules.length > 0) {
    const rule = sourceRules[0];
    if (rule.adjustmentType === 'PERCENTAGE' && rule.adjustmentValue !== -100) {
      basePrice = sourcePrice / (1 + rule.adjustmentValue / 100);
    } else if (rule.adjustmentType === 'FIXED') {
      basePrice = sourcePrice - rule.adjustmentValue;
    }
  } else if (sourceStore && sourceStore.isPriceAdjustmentEnabled) {
    const value = sourceStore.priceAdjustmentValue || 0;
    if (sourceStore.priceAdjustmentType === 'PERCENTAGE' && value !== -100) {
      basePrice = sourcePrice / (1 + value / 100);
    } else if (sourceStore.priceAdjustmentType === 'FIXED') {
      basePrice = sourcePrice - value;
    }
  }

  let adjusted = basePrice;
  const targetRules = await prisma.collectionPriceAdjustment.findMany({
    where: { storeId: targetStore?.id, enabled: true, collection: { title: { in: productCollections } } },
    include: { collection: true }
  });

  if (targetRules.length > 0) {
    const rule = targetRules[0];
    if (rule.adjustmentType === 'PERCENTAGE') {
      adjusted = basePrice * (1 + rule.adjustmentValue / 100);
    } else if (rule.adjustmentType === 'FIXED') {
      adjusted = basePrice + rule.adjustmentValue;
    }
  } else if (targetStore && targetStore.isPriceAdjustmentEnabled) {
    const value = targetStore.priceAdjustmentValue || 0;
    if (targetStore.priceAdjustmentType === 'PERCENTAGE') {
      adjusted = basePrice * (1 + value / 100);
    } else if (targetStore.priceAdjustmentType === 'FIXED') {
      adjusted = basePrice + value;
    }
  }

  return adjusted < 0 ? '0.00' : adjusted.toFixed(2);
}

async function main() {
  const k = await prisma.store.findFirst({where: {shopDomain: {contains: 'karur'}}});
  const m = await prisma.store.findFirst({where: {isMaster: true}});
  const p = await prisma.productCache.findFirst({where: {storeId: m.id, title: {contains: 'Maroon Boxer Briefs'}}});
  console.log('Master price:', p.price);
  const val = await calculateAdjustedPrice(p.price.toString(), m, k, ['INNERS']);
  console.log('Simulated adjusted price:', val);
}
main().catch(console.error);
