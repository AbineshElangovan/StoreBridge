import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    UPDATE "preorder_configs"
    SET "timerBgColor" = '#fee2e2',
        "timerBgColorEnd" = '#fee2e2',
        "timerTextColor" = '#000000',
        "timerTextColorEnd" = '#000000'
    WHERE "timerBgColor" = '#e52424' OR "timerBgColor" = '#dc2626' OR "timerBgColorEnd" IS NULL OR "timerBgColorEnd" = '#fee2e2'
  `);
  console.log('Successfully updated timer colors to #fee2e2!');
}

main().catch(console.error).finally(() => prisma.$disconnect());

