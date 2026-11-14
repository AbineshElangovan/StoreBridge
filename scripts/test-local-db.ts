import { prisma } from '../lib/db/prisma';

async function main() {
  console.log('--- TESTING LOCAL DATABASE CONNECTION ---');
  console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));

  try {
    // 1. Test basic connectivity
    await prisma.$queryRaw`SELECT 1 as connected`;
    console.log('✓ Successfully connected to local PostgreSQL database!\n');

    // 2. Fetch all stores
    const stores = await prisma.store.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        shopDomain: true,
        isMaster: true,
        masterLabel: true,
        label: true,
        isActive: true,
        scope: true,
        expiresAt: true,
        createdAt: true,
      }
    });

    console.log(`Found ${stores.length} store(s) connected in local DB:`);
    for (const store of stores) {
      console.log(`\n========================================`);
      console.log(`Store: ${store.shopDomain}`);
      console.log(`ID: ${store.id}`);
      console.log(`Role: ${store.isMaster ? 'MASTER STORE' : 'CHILD STORE'}`);
      console.log(`Label: ${store.label || store.masterLabel || 'None'}`);
      console.log(`Active: ${store.isActive}`);
      console.log(`Scopes: ${store.scope}`);
      console.log(`Token Expires At: ${store.expiresAt ? store.expiresAt.toISOString() : 'Never'}`);

      // Count related records in local DB
      const [preorderConfig, productCount, preorderRecordsCount, notifySettings, notifyRegistrations] = await Promise.all([
        prisma.preorderConfig.findFirst({ where: { storeId: store.id } }),
        prisma.productCache.count({ where: { storeId: store.id } }),
        prisma.preorderRecord.count({ where: { storeId: store.id } }),
        prisma.notifyMeSetting.findFirst({ where: { storeId: store.id } }),
        prisma.notifyMeRegistration.count({ where: { storeId: store.id } }),
      ]);

      console.log(`-- Pre-order Config: ${preorderConfig ? (preorderConfig.enabled ? 'ENABLED (' + preorderConfig.selectionMode + ')' : 'DISABLED') : 'None'}`);
      console.log(`-- Product Caches: ${productCount} products`);
      console.log(`-- Pre-order Records: ${preorderRecordsCount} orders`);
      console.log(`-- Back In Stock Setting: ${notifySettings ? (notifySettings.enabled ? 'ENABLED' : 'DISABLED') : 'None'}`);
      console.log(`-- Back In Stock Registrations: ${notifyRegistrations} requests`);
    }

    // 3. Summary totals in local DB
    const totalStores = stores.length;
    const totalProducts = await prisma.productCache.count();
    const totalPreorders = await prisma.preorderRecord.count();
    const totalRegistrations = await prisma.notifyMeRegistration.count();

    console.log('\n========================================');
    console.log('--- LOCAL DATABASE SUMMARY TOTALS ---');
    console.log(`Total Stores: ${totalStores}`);
    console.log(`Total Cached Products: ${totalProducts}`);
    console.log(`Total Pre-order Records: ${totalPreorders}`);
    console.log(`Total Restock Registrations: ${totalRegistrations}`);
    console.log('========================================\n');
  } catch (err: any) {
    console.error('Local DB connection failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();

