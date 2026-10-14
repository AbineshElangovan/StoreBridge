import { NextRequest, NextResponse } from 'next/server';
import { EmailNotificationService } from '@/services/notifications/email-notification-service';

export const dynamic = 'force-dynamic';

async function dispatchTwoTestNotifications(targetEmail: string) {
  // 1. Send Back in Stock (Notify Me) Email
  const notifyMeResult = await EmailNotificationService.sendBackInStockEmail({
    to: targetEmail,
    productTitle: 'Cotton T-shirt',
    variantTitle: 'White / M',
    productUrl: 'https://dz50mdfc-3000.inc1.devtunnels.ms/products/cotton-t-shirt',
    imageUrl: 'https://cdn.shopify.com/s/files/1/0836/6748/4891/files/cotton-t-shirt_924bced9-4b4d-4e4f-9f3b-b554623c9e69.png?v=1790857896',
    price: '₹1,240',
    storeName: 'ESHAN Chennai Store',
  });

  // 2. Send Pre-order Ready for Fulfillment Email
  const preorderResult = await EmailNotificationService.sendPreorderInStockEmail({
    to: targetEmail,
    productTitle: 'Cotton T-shirt',
    variantTitle: 'White / M',
    productUrl: 'https://dz50mdfc-3000.inc1.devtunnels.ms/products/cotton-t-shirt',
    imageUrl: 'https://cdn.shopify.com/s/files/1/0836/6748/4891/files/cotton-t-shirt_924bced9-4b4d-4e4f-9f3b-b554623c9e69.png?v=1790857896',
    price: '₹1,240',
    storeName: 'ESHAN Chennai Store',
    customerName: 'Abinesh',
    orderNumber: '#1001',
  });

  return {
    success: notifyMeResult.success && preorderResult.success,
    targetEmail,
    notifyMe: notifyMeResult,
    preorder: preorderResult,
    message: `Dispatched 2 test notifications to ${targetEmail}`,
  };
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const targetEmail = searchParams.get('email') || process.env.EMAIL_FROM || process.env.SMTP_USER || 'e.abineshabi99@gmail.com';
    const result = await dispatchTwoTestNotifications(targetEmail);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to dispatch test emails' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const targetEmail = body.email || process.env.EMAIL_FROM || process.env.SMTP_USER || 'e.abineshabi99@gmail.com';
    const result = await dispatchTwoTestNotifications(targetEmail);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to dispatch test emails' }, { status: 500 });
  }
}
