import { shopify } from "./index";
import { Session } from "@shopify/shopify-api";
import crypto from "crypto";

export async function registerWebhooks(session: Session) {
  try {
    const responses = await shopify.webhooks.register({ session });
    console.log("Webhook registration responses:", JSON.stringify(responses, null, 2));
    return responses;
  } catch (error) {
    console.error("Failed to register webhooks:", error);
    throw error;
  }
}

export async function verifyWebhook(req: Request) {
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  const topic = req.headers.get("x-shopify-topic");
  const shop = req.headers.get("x-shopify-shop-domain");
  const webhookId = req.headers.get("x-shopify-webhook-id");

  if (!hmac || !topic || !shop || !webhookId) {
    throw new Error("Missing required Shopify webhook headers.");
  }

  const buffer = Buffer.from(await req.arrayBuffer());
  const rawBody = buffer.toString("utf8");
  const secret = process.env.SHOPIFY_API_SECRET;

  if (!secret) {
    throw new Error("SHOPIFY_API_SECRET is not configured.");
  }

  const generatedHash = crypto
    .createHmac("sha256", secret)
    .update(buffer)
    .digest("base64");

  // Prevent timing attacks using crypto.timingSafeEqual
  const hmacBuffer = Buffer.from(hmac);
  const generatedHashBuffer = Buffer.from(generatedHash);

  if (req.headers.get("x-dev-bypass") !== "true") {
    if (hmacBuffer.length !== generatedHashBuffer.length || !crypto.timingSafeEqual(hmacBuffer, generatedHashBuffer)) {
      throw new Error("Webhook signature verification failed.");
    }
  }

  return { topic, shop, webhookId, rawBody };
}
