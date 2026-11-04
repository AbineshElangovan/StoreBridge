import { EmailNotificationService, getSesConfig } from '../services/notifications/email-notification-service';

async function main() {
  console.log('\n========================================');
  console.log('   AWS SES LOCAL EMAIL TESTING TOOL    ');
  console.log('========================================\n');

  const config = getSesConfig();

  if (!config) {
    console.error('❌ Error: SES credentials not found in environment or .env file.');
    console.error('Please make sure you have set in your .env:');
    console.error('  SES_MAIL="your-verified-email@example.com"');
    console.error('  SES_ACCESS_KEY_ID="AKIA..."');
    console.error('  SES_SECRET_ACCESS_KEY="..."');
    console.error('  SES_REGION="us-east-1" (optional, defaults to us-east-1)\n');
    process.exit(1);
  }

  // Recipient email from command line arg or default to the verified sender email
  const recipient = (process.argv[2] || config.fromEmail).trim();

  console.log('📋 AWS Configuration:');
  console.log(`   • From Email (SES Identity): ${config.fromEmail}`);
  console.log(`   • AWS Region:                ${config.region}`);
  console.log(`   • Access Key ID:             ${config.accessKeyId ? config.accessKeyId.slice(0, 6) + '...' + config.accessKeyId.slice(-4) : '(none)'}`);
  console.log(`   • Recipient Target:          ${recipient}\n`);

  console.log('🚀 Sending live test email via AWS SES...');

  const result = await EmailNotificationService.sendBackInStockEmail({
    to: recipient,
    productTitle: 'Classic Cotton T-Shirt',
    variantTitle: 'Navy Blue / XL',
    storeName: 'My Store',
    price: '999',
    productUrl: 'https://example.com/products/classic-cotton-t-shirt',
  });

  if (result.success) {
    console.log('\n✅ SUCCESS! Email was accepted by AWS SES for delivery.');
    console.log(`   • SES Message ID: ${result.messageId}`);
    console.log(`   • Sent To:        ${recipient}`);
    console.log('\n📬 Check your inbox (or Spam/Promotions folder) for the test email!\n');
  } else {
    console.error('\n❌ FAILED to send email via AWS SES:');
    console.error(`   ${result.error}\n`);

    console.log('💡 Troubleshooting Tips:');
    if (result.error?.includes('not verified') || result.error?.includes('MessageRejected')) {
      console.log('   1. If your AWS SES account is in "Sandbox mode", BOTH the sender AND the recipient');
      console.log('      must be verified in AWS SES Console -> Identities.');
      console.log(`      Try running with your verified email: npx tsx scripts/test-ses.ts ${config.fromEmail}`);
    } else if (result.error?.includes('security token') || result.error?.includes('SignatureDoesNotMatch')) {
      console.log('   1. Check your SES_ACCESS_KEY_ID and SES_SECRET_ACCESS_KEY in .env.');
    } else if (result.error?.includes('region') || result.error?.includes('Endpoint')) {
      console.log('   1. Check if SES_REGION in .env matches the region where you verified the email identity in AWS.');
    }
    console.log('');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌ Unexpected error running test script:', err);
  process.exit(1);
});

