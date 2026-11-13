import { prisma } from '../lib/db/prisma';
import { getAdminClient } from '../lib/shopify/admin';
import { PreorderService } from '../services/preorder/preorder-service';

async function main() {
  const stores = await prisma.store.findMany();
  console.log(`Checking ${stores.length} stores...`);

  for (const s of stores) {
    console.log(`\n========================================`);
    console.log(`Store: ${s.label || s.shopDomain} (${s.shopDomain})`);
    console.log(`Scope: ${s.scope}`);
    try {
      const client = await getAdminClient(s.shopDomain);
      const res = await client.request(`query { shop { name myshopifyDomain } }`);
      console.log(`✅ Admin API Connection: OK (${res.data?.shop?.name})`);

      // Check discount sync
      const config = await PreorderService.getConfig(s.id);
      console.log(`Pre-order Config: discountType=${config?.discountType}, value=${config?.discountValue}, halfPayment=${config?.allowHalfPayment}`);

      if (config) {
        console.log(`Syncing discounts for ${s.shopDomain}...`);
        const fullCode = await PreorderService.syncShopifyDiscount(s.id, config.discountType, config.discountValue);
        console.log(`Full Pre-order Discount Code: ${fullCode}`);

        if (config.allowHalfPayment) {
          const halfCode = await PreorderService.syncShopifyDepositDiscount(s.id, config.discountType, config.discountValue);
          console.log(`Deposit Discount Code: ${halfCode}`);
        }
      }

      // Query active discounts from Shopify
      try {
        const discRes: any = await client.request(`
          query {
            codeDiscountNodes(first: 10) {
              nodes {
                id
                codeDiscount {
                  ... on DiscountCodeBasic {
                    title
                    summary
                    status
                    codes(first: 5) {
                      nodes {
                        code
                      }
                    }
                  }
                }
              }
            }
          }
        `);
        console.log(`Shopify Active Discounts:`);
        const nodes = discRes.data?.codeDiscountNodes?.nodes || [];
        for (const n of nodes) {
          const disc = n.codeDiscount;
          const codes = disc?.codes?.nodes?.map((c: any) => c.code).join(', ');
          console.log(`  - Title: "${disc?.title}", Codes: [${codes}], Status: ${disc?.status}, Summary: "${disc?.summary}"`);
        }
      } catch (dErr: any) {
        console.log(`❌ Discount API Check: ${dErr.message}`);
      }

    } catch (err: any) {
      console.log(`❌ Admin API Connection Failed: ${err.message}`);
    }
  }
}

main().catch(console.error).finally(() => process.exit(0));
