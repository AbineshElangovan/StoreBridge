import { prisma } from '../lib/db/prisma';

async function main() {
  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'preorder_configs' 
    ORDER BY ordinal_position;
  `) as any[];
  console.log('Columns:');
  cols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
}

main().catch(console.error).finally(() => process.exit(0));
