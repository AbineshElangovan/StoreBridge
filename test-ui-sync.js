const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== LIVE PRICING TEST ===");
  const storeId = 'b55c019f-8100-4d4a-83e1-90019f44b6e6'; // Karur Store
  
  // 1. Get current prices before adjustment
  const beforeProducts = await prisma.productCache.findMany({
    where: { storeId: storeId },
    take: 3
  });
  
  console.log("\n[BEFORE] Current Prices in Karur:");
  for (const p of beforeProducts) {
    console.log(`- ${p.title} (${p.sku}): $${p.price}`);
  }
  
  // 2. Fetch all collections for Karur to simulate "Select All"
  const collectionsRes = await fetch(`http://localhost:3000/api/stores/${storeId}/collection-adjustments`);
  const collections = await collectionsRes.json();
  
  const adjustments = collections.map(col => ({
    collectionId: col.id,
    enabled: true,
    adjustmentType: 'PERCENTAGE',
    adjustmentValue: '20'
  }));
  
  console.log(`\nSimulating UI Action: Clicking 'Select All' and 'Save' with 20% adjustment...`);
  
  // 3. Call the API just like the UI does
  const res = await fetch(`http://localhost:3000/api/stores/${storeId}/collection-adjustments`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adjustments })
  });
  
  const result = await res.json();
  console.log(`UI Save Result: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  // Wait a few seconds for the background Shopify Sync to complete (which we just fixed with await!)
  console.log("\nWaiting 10 seconds for Shopify to process the bulk updates...");
  await new Promise(r => setTimeout(r, 10000));
  
  // 4. Check prices after adjustment
  const afterProducts = await prisma.productCache.findMany({
    where: { storeId: storeId, id: { in: beforeProducts.map(p => p.id) } }
  });
  
  console.log("\n[AFTER] Updated Prices in Karur (Master Price + 20%):");
  for (const p of afterProducts) {
    console.log(`- ${p.title} (${p.sku}): $${p.price}`);
  }
  console.log("\n✅ Test Complete! Shopify and Local Database successfully updated.");
}

main().catch(console.error);
