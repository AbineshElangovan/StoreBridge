const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE product_cache ADD COLUMN "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0.0;');
  console.log('Column added successfully');
}

main().catch(console.error);
