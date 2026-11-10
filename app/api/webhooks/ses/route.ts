import { NextRequest, NextResponse } from 'next/server';
import { EmailActivityService } from '@/services/notifications/email-activity-service';

export const dynamic = 'force-dynamic';

/**
 * AWS SES / SNS Webhook Handler.
 * Processes Delivery, Bounce, and Complaint events from AWS SES.
 * Automatically confirms AWS SNS topic subscriptions.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!rawBody) {
      return NextResponse.json({ error: 'Empty body' }, { status: 400 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // 1. Handle AWS SNS SubscriptionConfirmation
    if (payload.Type === 'SubscriptionConfirmation' && payload.SubscribeURL) {
      console.log('[SES Webhook] Received AWS SNS SubscriptionConfirmation for Topic:', payload.TopicArn);
      try {
        const confirmRes = await fetch(payload.SubscribeURL);
        console.log('[SES Webhook] SNS Subscription confirmed. HTTP status:', confirmRes.status);
      } catch (subErr: any) {
        console.error('[SES Webhook] Failed to auto-confirm SNS subscription:', subErr.message);
      }
      return NextResponse.json({
        success: true,
        message: 'Subscription confirmation received and processed',
        topicArn: payload.TopicArn,
      });
    }

    // 2. Extract SES message object from SNS wrapper or direct payload
    let sesEvent: any = payload;
    if (payload.Type === 'Notification' && payload.Message) {
      if (typeof payload.Message === 'string') {
        try {
          sesEvent = JSON.parse(payload.Message);
        } catch {
          sesEvent = { rawMessage: payload.Message };
        }
      } else {
        sesEvent = payload.Message;
      }
    }

    // Determine event type (AWS SES supports eventType or notificationType)
    const eventType = (sesEvent.eventType || sesEvent.notificationType || '').toLowerCase();
    const messageId = sesEvent.mail?.messageId;

    if (!messageId) {
      console.warn('[SES Webhook] Received SES event without messageId:', eventType);
      return NextResponse.json({
        success: true,
        message: 'Event acknowledged (no messageId found)',
        eventType,
      });
    }

    console.log(`[SES Webhook] Processing SES event: ${eventType} | Message ID: ${messageId}`);

    // 3. Process Delivery Events
    if (eventType === 'delivery') {
      const delivery = sesEvent.delivery || {};
      const result = await EmailActivityService.recordDeliveryEvent(messageId, {
        timestamp: delivery.timestamp || sesEvent.mail?.timestamp,
        smtpResponse: delivery.smtpResponse,
        recipients: delivery.recipients || sesEvent.mail?.destination,
        raw: delivery,
      });

      return NextResponse.json({
        success: true,
        event: 'delivery',
        messageId,
        isDuplicate: result.isDuplicate || false,
      });
    }

    // 4. Process Bounce Events
    if (eventType === 'bounce') {
      const bounce = sesEvent.bounce || {};
      const firstBounced = bounce.bouncedRecipients?.[0] || {};
      const result = await EmailActivityService.recordBounceEvent(messageId, {
        bounceType: bounce.bounceType || 'Undetermined',
        bounceSubType: bounce.bounceSubType || 'General',
        diagnostics: firstBounced.diagnosticCode || bounce.feedbackId,
        bouncedRecipients: bounce.bouncedRecipients || [],
        raw: bounce,
      });

      return NextResponse.json({
        success: true,
        event: 'bounce',
        messageId,
        isDuplicate: result.isDuplicate || false,
      });
    }

    // 5. Process Complaint Events
    if (eventType === 'complaint') {
      const complaint = sesEvent.complaint || {};
      const result = await EmailActivityService.recordBounceEvent(messageId, {
        bounceType: 'Complaint',
        bounceSubType: complaint.complaintFeedbackType || 'Spam',
        diagnostics: 'Customer marked email as spam / complaint registered with provider',
        bouncedRecipients: complaint.complainedRecipients || [],
        raw: complaint,
      });

      return NextResponse.json({
        success: true,
        event: 'complaint',
        messageId,
        isDuplicate: result.isDuplicate || false,
      });
    }

    // Other SES events (e.g. 'send', 'reject', 'open', 'click')
    return NextResponse.json({
      success: true,
      message: `Event acknowledged: ${eventType}`,
      messageId,
    });
  } catch (err: any) {
    console.error('[SES Webhook] Unhandled error processing webhook:', err?.message || err);
    return NextResponse.json({ error: 'Internal server error processing webhook' }, { status: 500 });
  }
}

/**
 * Health check endpoint for verifying webhook availability.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ACTIVE',
    service: 'StoreOrbit AWS SES Webhook Receiver',
    supportedEvents: ['Delivery', 'Bounce', 'Complaint', 'SubscriptionConfirmation'],
    timestamp: new Date().toISOString(),
  });
}

