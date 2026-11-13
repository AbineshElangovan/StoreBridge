import { PrismaClient } from '@prisma/client';

const neonUrl = "postgresql://neondb_owner:npg_7rDw2gJtlEeU@ep-restless-sun-b5m5tyc8-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const prismaNeon = new PrismaClient({
  datasourceUrl: neonUrl
});

async function main() {
  console.log("Connecting to Amplify Neon DB...");
  const stores = await prismaNeon.store.findMany();
  console.log(`Found ${stores.length} stores in Neon:`);
  for (const s of stores) {
    console.log(`- ID: ${s.id}, Domain: ${s.shopDomain}, Active: ${s.isActive}, Scope: ${s.scope}`);
    console.log(`  ExpiresAt: ${s.expiresAt}, HasRefreshToken: ${!!s.refreshToken}`);
  }
}

main().catch(console.error).finally(() => prismaNeon.$disconnect());

