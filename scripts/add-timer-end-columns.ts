import { prisma } from '../lib/db/prisma';

async function main() {
  await (prisma as any).$executeRawUnsafe(`
    ALTER TABLE "preorder_configs" 
    ADD COLUMN IF NOT EXISTS "timerHeadingEnd" text DEFAULT 'Hurry up! Pre-order ending soon',
    ADD COLUMN IF NOT EXISTS "timerTextColorEnd" text DEFAULT '#000000',
    ADD COLUMN IF NOT EXISTS "timerBgColorEnd" text DEFAULT '#fee2e2';
  `);
  console.log('Columns timerHeadingEnd, timerTextColorEnd, timerBgColorEnd added successfully!');
}

main().catch(console.error).finally(() => process.exit());

