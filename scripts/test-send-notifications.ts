import fs from 'fs';
import path from 'path';

// Safely ensure .env variables are loaded
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
} catch {}

import { EmailNotificationService } from '../services/notifications/email-notification-service';
import { prisma } from '../lib/db/prisma';

/**
 * Standalone test script to send both Back in Stock and Pre-order test notification emails
 * linking directly to the real Shopify Chennai Store storefront!
 * Usage: npx tsx scripts/test-send-notifications.ts [optional-email]
 */
async function run() {
  const targetEmail = process.argv[2] || process.env.EMAIL_FROM || process.env.SMTP_USER || 'e.abineshabi99@gmail.com';

  // Find real store domain from database
  let shopDomain = 'eshan-inventory-solutions.myshopify.com';
  let storeName = 'ESHAN Chennai Store';
  try {
    const allStores = await prisma.store.findMany({ select: { id: true, label: true, shopDomain: true } });
    console.log('Available stores in database:', allStores.map(s => `${s.label || 'Unnamed'} (${s.shopDomain})`).join(', '));
    const chennaiStore = allStores.find(s => 
      (s.label && s.label.toLowerCase().includes('chennai')) || 
      s.shopDomain.toLowerCase().includes('chennai')
    ) || allStores[0];

    if (chennaiStore) {
      shopDomain = chennaiStore.shopDomain;
      storeName = chennaiStore.label || 'ESHAN Chennai Store';
    }
  } catch {}

  // Direct Shopify storefront URLs for Chennai Store
  const shopifyProductUrl = `https://${shopDomain}/products/cotton-t-shirt`;
  const shopifyOrderUrl = `https://${shopDomain}/account/orders`;

  console.log(`\n🚀 Sending 2 test notifications to: ${targetEmail}`);
  console.log(`🏬 Storefront: ${storeName} (${shopDomain})`);
  console.log(`🔗 Direct Shopify Product Link: ${shopifyProductUrl}`);
  console.log(`🔗 Direct Shopify Order Status Link: ${shopifyOrderUrl}\n`);

  try {
    // 1. Send Back in Stock (Notify Me) Email -> links directly to Chennai Store product page!
    console.log('1. Dispatching Back in Stock (Notify Me) email for Abi (#1033)...');
    const notifyMeResult = await EmailNotificationService.sendBackInStockEmail({
      to: targetEmail,
      customerName: 'Abi',
      orderNumber: '#1033',
      productTitle: 'Cotton T-shirt',
      variantTitle: 'White / M',
      productUrl: shopifyProductUrl,
      imageUrl: 'https://cdn.shopify.com/s/files/1/0836/6748/4891/files/cotton-t-shirt_924bced9-4b4d-4e4f-9f3b-b554623c9e69.png?v=1790857896',
      price: '₹1,240',
      storeName: storeName,
    });
    console.log('   Result:', notifyMeResult);

    // 2. Send Pre-order Ready for Fulfillment Email -> links directly to Chennai Store!
    console.log('\n2. Dispatching Pre-order Ready for Fulfillment email for Abi (#1033)...');
    const preorderResult = await EmailNotificationService.sendPreorderInStockEmail({
      to: targetEmail,
      customerName: 'Abi',
      orderNumber: '#1033',
      productTitle: 'Cotton T-shirt',
      variantTitle: 'White / M',
      productUrl: shopifyProductUrl,
      imageUrl: 'https://cdn.shopify.com/s/files/1/0836/6748/4891/files/cotton-t-shirt_924bced9-4b4d-4e4f-9f3b-b554623c9e69.png?v=1790857896',
      price: '₹1,240',
      storeName: storeName,
    });
    console.log('   Result:', preorderResult);

    console.log(`\n✅ Completed! Check your inbox at ${targetEmail}.`);
    console.log(`Clicking the buttons will now open your real Chennai Shopify Store directly!\n`);
  } catch (err: any) {
    console.error('❌ Error sending test notifications:', err);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

run();
