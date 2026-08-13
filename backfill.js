const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('UPDATE product_cache SET "basePrice" = price WHERE "basePrice" = 0;');
  console.log('Backfill complete');
}

main().catch(console.error);
