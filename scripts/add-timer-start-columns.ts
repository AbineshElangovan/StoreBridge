import { prisma as localPrisma } from '../lib/db/prisma';
import { PrismaClient } from '@prisma/client';

async function main() {
  console.log('Adding timerStartDateMode and timerCustomStartDate to local DB...');
  await localPrisma.$executeRawUnsafe(`
    ALTER TABLE "preorder_configs"
    ADD COLUMN IF NOT EXISTS "timerStartDateMode" text DEFAULT 'USE_STATUS_DATE',
    ADD COLUMN IF NOT EXISTS "timerCustomStartDate" timestamp without time zone;
  `);
  console.log('✅ Local DB updated.');

  const neonUrl = process.env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_c9g2GvLoxeEw@ep-restless-sun-b5m5tyc8-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  const neonPrisma = new PrismaClient({ datasources: { db: { url: neonUrl } } });
  try {
    console.log('Adding timerStartDateMode and timerCustomStartDate to Neon DB...');
    await neonPrisma.$executeRawUnsafe(`
      ALTER TABLE "preorder_configs"
      ADD COLUMN IF NOT EXISTS "timerStartDateMode" text DEFAULT 'USE_STATUS_DATE',
      ADD COLUMN IF NOT EXISTS "timerCustomStartDate" timestamp without time zone;
    `);
    console.log('✅ Neon DB updated.');
  } catch (err: any) {
    console.warn('Neon DB update warning:', err.message);
  } finally {
    await neonPrisma.$disconnect();
  }
}

main().catch(console.error).finally(() => process.exit(0));

