const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const k = await prisma.store.findFirst({where: {shopDomain: {contains: 'karur'}}});
  const res = await fetch(`https://${k.shopDomain}/admin/api/2024-01/graphql.json`, { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': k.accessToken }, 
    body: JSON.stringify({ query: '{ products(first: 5) { edges { node { title variants(first: 1) { edges { node { price } } } } } } }' }) 
  }); 
  const data = await res.json(); 
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
