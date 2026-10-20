import { NextResponse } from 'next/server';
import { processWebhookQueue } from '@/services/webhook-worker';
import { cleanupExpiredActivityLogs } from '@/lib/services/activityRetention';
import { evaluateForecastStockoutRisks } from '@/services/planning/stockout-risk-service';

// To prevent Vercel from caching this route, forcing it to run on every request
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // Run 90-day retention cleanup and evaluate stockout risk alerts in the background
    cleanupExpiredActivityLogs().catch(() => {});
    evaluateForecastStockoutRisks().catch(() => {});

    const { processedCount } = await processWebhookQueue();

    return NextResponse.json({
      success: true,
      message: `Processed ${processedCount} pending webhook jobs.`,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Cron] process-webhooks failed:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to process webhooks',
      error: error.message
    }, { status: 500 });
  }
}
