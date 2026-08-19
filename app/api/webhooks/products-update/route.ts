import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/shopify/webhooks";
import { prisma } from "@/lib/db/prisma";
import { processWebhookQueue } from "@/services/webhook-worker";

export async function POST(req: NextRequest) {
  try {
    const { topic, shop, webhookId, eventId, rawBody } = await verifyWebhook(req);
    const apiVersion = req.headers.get("x-shopify-api-version") || null;
    const timeISO = new Date().toISOString();

    console.log(`[Webhook:Received] Time: ${timeISO} | Shop: ${shop} | Topic: ${topic} | WebhookId: ${webhookId} | EventId: ${eventId}`);

    try {
      const existingJob = await prisma.webhookQueue.findUnique({
        where: { webhookId },
        select: { id: true }
      });

      if (existingJob) {
        console.log(`[Webhook:Ignored] WebhookId: ${webhookId} | Reason: duplicate_webhook_id`);
        return new NextResponse("Webhook processed successfully", { status: 200 });
      }

      await prisma.webhookQueue.create({
        data: {
          webhookId,
          eventId,
          topic,
          shopDomain: shop,
          apiVersion,
          payload: JSON.parse(rawBody),
          status: "PENDING",
        },
      });
      console.log(`[Webhook:${topic}] Queued ${webhookId} (Event: ${eventId}) for ${shop}`);
      processWebhookQueue().catch(console.error);
    } catch (e: any) {
      if (e.code === 'P2002') {
        console.log(`[Webhook:Ignored] WebhookId: ${webhookId} | Reason: duplicate_webhook_id`);
      } else {
        throw e;
      }
    }

    return new NextResponse("Webhook processed successfully", { status: 200 });
  } catch (error: any) {
    console.error("[Webhook:products-update] error:", error.message);
    if (error.message === "Webhook signature verification failed.") {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    // Return 200 even on internal errors to prevent Shopify from deleting the webhook subscription
    return new NextResponse("Internal Server Error Handled", { status: 200 });
  }
}
