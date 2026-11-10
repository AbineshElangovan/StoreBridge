import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { EmailActivityService } from './email-activity-service';
import { EmailTemplateStore } from './email-template-store';
import { APP_NAME } from '@/lib/constants/app';

export interface SendEmailParams {
  to: string;
  productTitle: string;
  variantTitle?: string | null;
  productUrl?: string | null;
  imageUrl?: string | null;
  storeName?: string | null;
  price?: string | null;
  customerName?: string | null;
  orderNumber?: string | null;
  subject?: string | null;
  paymentOption?: string | null;
  depositAmount?: number | null;
  remainingBalance?: number | null;
  totalAmount?: number | null;
  // Enhanced tracking context
  storeId?: string | null;
  shopDomain?: string | null;
  merchantId?: string | null;
  emailType?: string | null;
  relatedEntityId?: string | null;
  relatedEntityType?: string | null;
  metadata?: Record<string, any> | null;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  activityId?: string | null;
}

export interface SesConfig {
  fromEmail: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region: string;
}

let cachedSesConfig: SesConfig | null = null;

export function getSesConfig(): SesConfig | null {
  if (cachedSesConfig) return cachedSesConfig;

  let fromEmail = process.env.SES_MAIL || process.env.AWS_SES_MAIL;
  let accessKeyId = process.env.SES_ACCESS_KEY_ID || process.env.AWS_SES_ACCESS_KEY_ID;
  let secretAccessKey = process.env.SES_SECRET_ACCESS_KEY || process.env.AWS_SES_SECRET_ACCESS_KEY;
  let region = process.env.SES_REGION || process.env.AWS_SES_REGION || process.env.AWS_REGION;

  if (!fromEmail || !accessKeyId || !secretAccessKey) {
    try {
      const fs = require('fs');
      const path = require('path');
      const envFiles = ['.env', '.env.local', '.env.production'];
      for (const file of envFiles) {
        const envPath = path.join(process.cwd(), file);
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, 'utf8');
          if (!fromEmail) {
            const m = content.match(/(?:SES_MAIL|AWS_SES_MAIL)=["']?([^"'\r\n]+)/);
            if (m) fromEmail = m[1].trim();
          }
          if (!accessKeyId) {
            const m = content.match(/(?:SES_ACCESS_KEY_ID|AWS_SES_ACCESS_KEY_ID)=["']?([^"'\r\n]+)/);
            if (m) accessKeyId = m[1].trim();
          }
          if (!secretAccessKey) {
            const m = content.match(/(?:SES_SECRET_ACCESS_KEY|AWS_SES_SECRET_ACCESS_KEY)=["']?([^"'\r\n]+)/);
            if (m) secretAccessKey = m[1].trim();
          }
          if (!region) {
            const m = content.match(/(?:SES_REGION|AWS_SES_REGION|AWS_REGION)=["']?([^"'\r\n]+)/);
            if (m) region = m[1].trim();
          }
        }
      }
    } catch {}
  }

  // Fallback to legacy EMAIL_FROM if SES_MAIL was not set
  if (!fromEmail && process.env.EMAIL_FROM) {
    fromEmail = process.env.EMAIL_FROM;
  }

  if (fromEmail) {
    const bracketMatch = fromEmail.match(/<([^>]+)>/);
    const cleanFrom = (bracketMatch ? bracketMatch[1] : fromEmail).replace(/["']/g, '').trim();

    cachedSesConfig = {
      fromEmail: cleanFrom,
      accessKeyId: accessKeyId ? accessKeyId.trim() : undefined,
      secretAccessKey: secretAccessKey ? secretAccessKey.trim() : undefined,
      region: (region || 'us-east-1').trim(),
    };
    return cachedSesConfig;
  }

  return null;
}

let sesClientInstance: SESClient | null = null;

export function getSesClient(): SESClient | null {
  const config = getSesConfig();
  if (!config) return null;

  if (!sesClientInstance) {
    const clientParams: any = {
      region: config.region,
    };
    if (config.accessKeyId && config.secretAccessKey) {
      clientParams.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      };
    }
    sesClientInstance = new SESClient(clientParams);
  }
  return sesClientInstance;
}

function stripHtmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&bull;/g, '•')
    .replace(/&copy;/g, '©')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#127881;/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function dispatchEmail(
  to: string,
  fromEmail: string,
  subject: string,
  html: string,
  fallbackUrl?: string,
  plainText?: string,
  trackingParams?: {
    storeId?: string | null;
    shopDomain?: string | null;
    merchantId?: string | null;
    emailType?: string | null;
    relatedEntityId?: string | null;
    relatedEntityType?: string | null;
    metadata?: Record<string, any> | null;
  }
): Promise<NotificationResult> {
  const cleanSubject = (subject && subject.replace(/[\r\n]+/g, ' ').replace(/["']/g, '').trim()) || `Product Notification | StoreOrbit`;
  const text = (plainText && plainText.trim()) || stripHtmlToPlainText(html);

  // 1. Resolve store domain if missing
  let resolvedShopDomain = trackingParams?.shopDomain;
  let resolvedStoreId = trackingParams?.storeId;

  if (!resolvedShopDomain && resolvedStoreId) {
    try {
      const { prisma } = await import('@/lib/db/prisma');
      const store = await prisma.store.findUnique({
        where: { id: resolvedStoreId },
        select: { shopDomain: true },
      });
      if (store?.shopDomain) resolvedShopDomain = store.shopDomain;
    } catch {}
  }

  if (!resolvedShopDomain) {
    try {
      const { prisma } = await import('@/lib/db/prisma');
      const firstStore = await prisma.store.findFirst({
        select: { id: true, shopDomain: true },
      });
      if (firstStore) {
        resolvedShopDomain = firstStore.shopDomain;
        if (!resolvedStoreId) resolvedStoreId = firstStore.id;
      }
    } catch {}
  }

  if (!resolvedShopDomain) {
    resolvedShopDomain = 'storeorbit.myshopify.com';
  }

  // 2. Record QUEUED email activity
  let activityId: string | null = null;
  try {
    activityId = await EmailActivityService.recordQueued({
      merchantId: trackingParams?.merchantId,
      storeId: resolvedStoreId,
      shopDomain: resolvedShopDomain,
      recipient: to,
      emailType: trackingParams?.emailType || 'NOTIFICATION',
      relatedEntityId: trackingParams?.relatedEntityId,
      relatedEntityType: trackingParams?.relatedEntityType,
      metadata: {
        subject: cleanSubject,
        ...(trackingParams?.metadata || {}),
      },
    });
  } catch (logErr: any) {
    console.warn('[EmailNotificationService:ActivityLog:QueuedError]', logErr.message);
  }

  const sesConfig = getSesConfig();
  const client = getSesClient();

  if (sesConfig && client) {
    try {
      // Build SES Source header: "Store Name" <AWS_SES_MAIL>
      let sourceHeader = sesConfig.fromEmail;
      const storeNameMatch = fromEmail.match(/^"?([^"<]+)"?\s*</);
      const storeName = storeNameMatch
        ? storeNameMatch[1].trim()
        : fromEmail.replace(/<.*>/, '').replace(/["']/g, '').trim();

      if (storeName && storeName !== sesConfig.fromEmail) {
        sourceHeader = `"${storeName.replace(/"/g, '')}" <${sesConfig.fromEmail}>`;
      }

      const command = new SendEmailCommand({
        Source: sourceHeader,
        Destination: {
          ToAddresses: [to],
        },
        Message: {
          Subject: {
            Data: cleanSubject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: html,
              Charset: 'UTF-8',
            },
            Text: {
              Data: text,
              Charset: 'UTF-8',
            },
          },
        },
        ReplyToAddresses: [sesConfig.fromEmail],
      });

      const response = await client.send(command);
      console.log(`[EmailNotificationService:SES:Success] To: ${to} | ID: ${response.MessageId}`);

      // Record SENT status with providerMessageId
      if (activityId && response.MessageId) {
        await EmailActivityService.recordSent(activityId, response.MessageId);
      }

      return { success: true, messageId: response.MessageId, activityId };
    } catch (sesErr: any) {
      console.error(`[EmailNotificationService:SES:Error] Failed to send to ${to}:`, sesErr.message);

      // Record FAILED status with error details
      if (activityId) {
        await EmailActivityService.recordFailed(activityId, sesErr.message || 'AWS SES delivery failed');
      }

      return {
        success: false,
        error: sesErr.message || 'AWS SES email delivery failed',
        activityId,
      };
    }
  }

  console.warn(`[EmailNotificationService:Simulated] AWS SES credentials not configured. Dispatched to: ${to} | Subject: "${cleanSubject}" | Target: ${fallbackUrl}`);
  const simMessageId = `ses_sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // Record SENT status for simulated/dev dispatch
  if (activityId) {
    await EmailActivityService.recordSent(activityId, simMessageId, { simulated: true });
  }

  return {
    success: true,
    messageId: simMessageId,
    activityId,
  };
}

function getEmailFrom(storeDisplayName?: string): string {
  const sesConfig = getSesConfig();
  const cleanEmail = sesConfig?.fromEmail || 'notifications@example.com';
  const brandName = storeDisplayName?.trim() || 'Online Store';
  return `"${brandName.replace(/"/g, '')}" <${cleanEmail}>`;
}

const VERIFIED_PRODUCT_FALLBACK_IMAGE = 'https://cdn.shopify.com/s/files/1/0836/6748/4891/files/cotton-t-shirt_924bced9-4b4d-4e4f-9f3b-b554623c9e69.png?v=1790857896';

async function resolveLiveImageUrl(url?: string | null): Promise<string> {
  if (!url || typeof url !== 'string' || !url.trim()) return VERIFIED_PRODUCT_FALLBACK_IMAGE;
  let clean = url.trim();
  if (clean.startsWith('//')) clean = `https:${clean}`;
  else if (!clean.startsWith('http://') && !clean.startsWith('https://')) clean = `https://${clean}`;

  try {
    const parsed = new URL(clean);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return clean;
    }
  } catch {}

  return VERIFIED_PRODUCT_FALLBACK_IMAGE;
}

function cleanTitleAndVariant(
  rawProductTitle?: string | null,
  rawVariantTitle?: string | null,
  storeName?: string | null
): { productTitle: string; variantTitle: string | null; fullTitle: string } {
  let pTitle = (rawProductTitle || 'Product').trim().replace(/["']/g, '');
  let vTitle = (rawVariantTitle && rawVariantTitle !== 'Default Title' && rawVariantTitle !== 'Default Variant')
    ? rawVariantTitle.trim().replace(/["']/g, '')
    : null;

  // Clean trailing store name like " - ESHAN Chennai Store" or " – ESHAN Chennai Store"
  if (storeName) {
    const cleanStore = storeName.trim().replace(/["']/g, '');
    const storeRegex = new RegExp(`\\s*[-–—|:]\\s*${cleanStore}$`, 'i');
    pTitle = pTitle.replace(storeRegex, '').trim();
    if (vTitle) {
      vTitle = vTitle.replace(storeRegex, '').trim();
    }
  }

  // Normalize en-dash / em-dash to " - "
  pTitle = pTitle.replace(/\s*[–—]\s*/g, ' - ');
  if (vTitle) {
    vTitle = vTitle.replace(/\s*[–—]\s*/g, ' - ');
  }

  // If productTitle already contains " - " (e.g. "Cotton T-shirt - White / M")
  if (pTitle.includes(' - ')) {
    const parts = pTitle.split(' - ');
    pTitle = parts[0].trim();
    if (!vTitle && parts.length > 1) {
      vTitle = parts.slice(1).join(' - ').trim();
    }
  }

  // If variantTitle is already inside productTitle or equals productTitle
  if (vTitle && pTitle.toLowerCase().includes(vTitle.toLowerCase())) {
    vTitle = null;
  }

  // De-duplicate any internal variant duplication (e.g. "White / M - White / M")
  if (vTitle && vTitle.includes(' - ')) {
    const vParts = vTitle.split(' - ').map(p => p.trim());
    const uniqueVParts = Array.from(new Set(vParts));
    vTitle = uniqueVParts.join(' - ');
  }

  const fullTitle = vTitle ? `${pTitle} - ${vTitle}` : pTitle;
  return { productTitle: pTitle, variantTitle: vTitle, fullTitle };
}

export class EmailNotificationService {
  /**
   * Send a Back in Stock notification email.
   * Renders a responsive, modern HTML template with Buy Now CTA direct to Shopify product.
   */
  static async sendBackInStockEmail(params: SendEmailParams): Promise<NotificationResult> {
    const { to, productTitle: rawProductTitle, variantTitle: rawVariantTitle, productUrl, imageUrl, storeName, price } = params;

    const storeDisplayName = (storeName || 'Online Store').replace(/["']/g, '');
    const { productTitle, variantTitle, fullTitle } = cleanTitleAndVariant(rawProductTitle, rawVariantTitle, storeDisplayName);
    const fallbackUrl = productUrl || '#';
    const displayPrice = price ? (price.startsWith('₹') || price.startsWith('Rs') || price.startsWith('$') ? price : `₹${price}`) : '₹1,240';
    const safeImageUrl = await resolveLiveImageUrl(imageUrl);
    const greetingName = params.customerName && params.customerName.trim() ? params.customerName.trim() : null;
    const orderDisplay = params.orderNumber ? (params.orderNumber.startsWith('#') ? params.orderNumber : `#${params.orderNumber}`) : null;

    const tmpl = EmailTemplateStore.getTemplates().notify_me;

    let emailSubject = params.subject?.trim() || tmpl.subject?.trim();
    if (emailSubject) {
      if (emailSubject.includes('Good news!')) {
        emailSubject = emailSubject.replace(/Good news!\s*/i, `[${storeDisplayName}] `);
      }
      emailSubject = emailSubject
        .replace(/\{\{product_title\}\}/gi, fullTitle)
        .replace(/\{\{product\}\}/gi, fullTitle)
        .replace(/\{\{store_name\}\}/gi, storeDisplayName)
        .replace(/\{\{store\}\}/gi, storeDisplayName)
        .replace(/["']/g, '');
    } else {
      emailSubject = `[${storeDisplayName}] Back in Stock: ${fullTitle} is now available`;
    }

    const subject = emailSubject;

    const bannerColor = tmpl.bannerColor || '#059669';
    const bannerText = tmpl.bannerText || 'Back in Stock • Available Now';
    const headline = tmpl.headline ? tmpl.headline.replace(/\{\{product_title\}\}/gi, fullTitle) : `${fullTitle} is Back in Stock`;
    const bodyMessage = tmpl.bodyMessage
      ? tmpl.bodyMessage.replace(/\{\{store_name\}\}/gi, storeDisplayName).replace(/\{\{product_title\}\}/gi, fullTitle)
      : 'The item you were waiting for is available again.';
    const rawBtn = (tmpl.buttonText || 'Shop Now').replace(/\s*[→➔➜>]\s*$/g, '').trim();
    const buttonLabel = `${rawBtn} &rarr;`;
    const buttonColor = tmpl.buttonColor || '#111827';

    const plainText = [
      `Hello,`,
      ``,
      `${fullTitle} is back in stock at ${storeDisplayName}.`,
      ``,
      `Product: ${fullTitle}`,
      `Price: ${displayPrice}`,
      `View Product: ${fallbackUrl}`,
      ``,
      `You received this email because you requested a restock notification on ${storeDisplayName}.`,
      `© ${new Date().getFullYear()} ${storeDisplayName}. All rights reserved.`,
    ].join('\n');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f7;padding:30px 10px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background:#ffffff;border-radius:14px;border:1px solid #e5e7eb;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,0.06);">
          <!-- Top Header -->
          <tr>
            <td style="background-color:#111827;padding:18px 24px;text-align:left;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="color:#ffffff;font-size:17px;font-weight:bold;letter-spacing:-0.02em;">
                    ${storeDisplayName}
                  </td>
                  <td align="right" style="color:#9ca3af;font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">
                    OFFICIAL STORE
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding:32px 24px;text-align:center;">
              <div style="background-color:${bannerColor};color:#ffffff;font-size:12px;font-weight:700;padding:6px 16px;border-radius:20px;display:inline-block;margin-bottom:14px;letter-spacing:0.02em;">
                ${bannerText}
              </div>
              <h1 style="margin:0 0 10px;font-size:22px;font-weight:800;color:#111827;line-height:1.3;">${headline}</h1>
              ${greetingName ? `
              <p style="margin:0 0 8px;font-size:15px;color:#111827;font-weight:600;">
                Hi ${greetingName},
              </p>
              ` : ''}
              ${orderDisplay ? `
              <div style="font-size:13px;color:#4b5563;margin-bottom:12px;">
                <strong>Order Number:</strong> <span style="color:#059669;font-weight:bold;">${orderDisplay}</span>
              </div>
              ` : ''}
              <p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.5;">
                ${bodyMessage}
              </p>

              <!-- Product Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafafa;border:1px solid #e5e7eb;border-radius:12px;padding:24px 16px;text-align:center;">
                ${safeImageUrl ? `
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;background-color:#ffffff!important;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                  <tr>
                        <td align="center" style="padding:12px;background-color:#ffffff!important;border-radius:12px;">
                          <img src="${safeImageUrl}" alt="${fullTitle.replace(/"/g, '&quot;')}" width="200" border="0" style="display:block;max-width:200px;width:100%;height:auto;border-radius:8px;background-color:#ffffff!important;margin:0 auto;" />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td align="center" style="font-size:19px;font-weight:bold;color:#111827;padding-bottom:6px;">
                    ${productTitle}
                  </td>
                </tr>
                ${variantTitle && variantTitle !== 'Default Title' ? `
                <tr>
                  <td align="center" style="padding-bottom:10px;">
                    <span style="display:inline-block;background-color:#e5e7eb;color:#374151;font-size:12px;font-weight:bold;padding:4px 12px;border-radius:20px;">
                      ${variantTitle}
                    </span>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td align="center" style="font-size:17px;font-weight:800;color:#111827;padding-bottom:20px;">
                    Price: ${displayPrice}
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:14px;">
                    <a href="${fallbackUrl}" target="_blank" style="display:inline-block;background-color:${buttonColor};color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
                      ${buttonLabel}
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:4px;font-size:12px;color:#4b5563;">
                    Available while current inventory lasts.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 24px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280;line-height:1.6;">
              You received this alert because you requested notifications on <strong>${storeDisplayName}</strong>.<br/>
              If you did not request this notification, you can safely disregard this email.<br/>
              &copy; ${new Date().getFullYear()} ${storeDisplayName}. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const fromEmail = getEmailFrom(storeDisplayName);
    return dispatchEmail(to, fromEmail, subject, html, fallbackUrl, plainText, { ...params, emailType: params.emailType || 'BACK_IN_STOCK' });
  }

  /**
   * Send an instant waitlist confirmation email as soon as customer clicks "Notify Me".
   * Includes product photo, variant, and promise to reach out as soon as restocked.
   */
  static async sendWaitlistConfirmationEmail(params: SendEmailParams): Promise<NotificationResult> {
    const { to, productTitle: rawProductTitle, variantTitle: rawVariantTitle, productUrl, imageUrl, storeName, price } = params;

    const storeDisplayName = (storeName || 'Online Store').replace(/["']/g, '');
    const { productTitle, variantTitle, fullTitle } = cleanTitleAndVariant(rawProductTitle, rawVariantTitle, storeDisplayName);
    const fallbackUrl = productUrl || '#';
    const displayPrice = price ? (price.startsWith('₹') || price.startsWith('Rs') || price.startsWith('$') ? price : `₹${price}`) : '₹1,240';
    const safeImageUrl = await resolveLiveImageUrl(imageUrl);

    let emailSubject = params.subject?.trim();
    if (emailSubject) {
      if (emailSubject.includes('Good news!')) {
        emailSubject = emailSubject.replace(/Good news!\s*/i, `[${storeDisplayName}] `);
      }
      emailSubject = emailSubject
        .replace(/\{\{product_title\}\}/gi, fullTitle)
        .replace(/\{\{product\}\}/gi, fullTitle)
        .replace(/\{\{store_name\}\}/gi, storeDisplayName)
        .replace(/\{\{store\}\}/gi, storeDisplayName)
        .replace(/["']/g, '');
    } else {
      emailSubject = `[${storeDisplayName}] Waitlist Confirmed: ${fullTitle}`;
    }

    const subject = emailSubject;

    const plainText = [
      `Hello,`,
      ``,
      `Waitlist confirmed for ${fullTitle} at ${storeDisplayName}.`,
      ``,
      `We have saved your request. As soon as this product is back in stock, we will send you an instant notification so you can get yours first.`,
      ``,
      `Product: ${fullTitle}`,
      `Price: ${displayPrice}`,
      `View Product: ${fallbackUrl}`,
      ``,
      `You received this confirmation because you signed up for notifications on ${storeDisplayName}.`,
      `© ${new Date().getFullYear()} ${storeDisplayName}. All rights reserved.`,
    ].join('\n');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f7;padding:30px 10px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background:#ffffff;border-radius:14px;border:1px solid #e5e7eb;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,0.06);">
          <!-- Top Header -->
          <tr>
            <td style="background-color:#111827;padding:18px 24px;text-align:left;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="color:#ffffff;font-size:17px;font-weight:bold;letter-spacing:-0.02em;">
                    ${storeDisplayName}
                  </td>
                  <td align="right" style="color:#9ca3af;font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">
                    OFFICIAL STORE
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding:32px 24px;text-align:center;">
              <div style="background-color:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;font-size:12px;font-weight:700;padding:6px 14px;border-radius:20px;display:inline-block;margin-bottom:14px;letter-spacing:0.02em;">
                Waitlist Confirmed
              </div>
              <h1 style="margin:0 0 10px;font-size:22px;font-weight:800;color:#111827;line-height:1.3;">Waitlist Confirmed</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.5;">
                We will notify you the moment this item is back in stock.
              </p>

              <!-- Product Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafafa;border:1px solid #e5e7eb;border-radius:12px;padding:24px 16px;text-align:center;">
                ${safeImageUrl ? `
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;background-color:#ffffff!important;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                      <tr>
                        <td align="center" style="padding:12px;background-color:#ffffff!important;border-radius:12px;">
                          <img src="${safeImageUrl}" alt="${fullTitle.replace(/"/g, '&quot;')}" width="200" border="0" style="display:block;max-width:200px;width:100%;height:auto;border-radius:8px;background-color:#ffffff!important;margin:0 auto;" />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td align="center" style="font-size:19px;font-weight:bold;color:#111827;padding-bottom:6px;">
                    ${productTitle}
                  </td>
                </tr>
                ${variantTitle && variantTitle !== 'Default Title' ? `
                <tr>
                  <td align="center" style="padding-bottom:10px;">
                    <span style="display:inline-block;background-color:#e5e7eb;color:#374151;font-size:12px;font-weight:bold;padding:4px 12px;border-radius:20px;">
                      ${variantTitle}
                    </span>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td align="center" style="font-size:17px;font-weight:800;color:#111827;padding-bottom:20px;">
                    Price: ${displayPrice}
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:14px;">
                    <a href="${fallbackUrl}" target="_blank" style="display:inline-block;background-color:#111827;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
                      View Product
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:4px;font-size:12px;color:#059669;font-weight:600;">
                    We will notify you as soon as inventory arrives.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 24px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280;line-height:1.6;">
              You received this alert because you requested notifications on <strong>${storeDisplayName}</strong>.<br/>
              If you did not request this notification, you can safely disregard this email.<br/>
              &copy; ${new Date().getFullYear()} ${storeDisplayName}. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const fromEmail = getEmailFrom(storeDisplayName);
    return dispatchEmail(to, fromEmail, subject, html, fallbackUrl, plainText, { ...params, emailType: params.emailType || 'WAITLIST_CONFIRMATION' });
  }

  /**
   * Send a notification to a customer who pre-ordered, letting them know
   * their item is now in stock and being prepared for fulfillment.
   */
  static async sendPreorderInStockEmail(params: SendEmailParams): Promise<NotificationResult> {
    const { to, productTitle: rawProductTitle, variantTitle: rawVariantTitle, productUrl, imageUrl, storeName, price, customerName, orderNumber } = params;

    const storeDisplayName = (storeName || 'Online Store').replace(/["']/g, '');
    const { productTitle, variantTitle, fullTitle } = cleanTitleAndVariant(rawProductTitle, rawVariantTitle, storeDisplayName);
    const fallbackUrl = productUrl || '#';
    const displayPrice = price ? (price.startsWith('₹') || price.startsWith('Rs') || price.startsWith('$') ? price : `₹${price}`) : '₹1,240';
    const safeImageUrl = await resolveLiveImageUrl(imageUrl);
    const greetingName = customerName && customerName.trim() ? customerName.trim() : 'Customer';
    const orderDisplay = orderNumber ? (orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`) : '#1234';

    const preorderTmpl = EmailTemplateStore.getTemplates().preorder;

    let emailSubjectPre = params.subject?.trim() || preorderTmpl.subject?.trim();
    if (emailSubjectPre) {
      emailSubjectPre = emailSubjectPre
        .replace(/\{\{product_title\}\}/gi, fullTitle)
        .replace(/\{\{product\}\}/gi, fullTitle)
        .replace(/\{\{store_name\}\}/gi, storeDisplayName)
        .replace(/\{\{store\}\}/gi, storeDisplayName)
        .replace(/["']/g, '');
    } else {
      emailSubjectPre = `Pre-order Ready: ${fullTitle} - ${storeDisplayName}`;
    }

    const subject = emailSubjectPre;

    const preorderBannerColor = preorderTmpl.bannerColor || '#7c3aed';
    const preorderBannerText = preorderTmpl.bannerText || 'PRE-ORDER ALLOCATED • READY FOR FULFILLMENT';
    const preorderHeadline = preorderTmpl.headline ? preorderTmpl.headline.replace(/\{\{product_title\}\}/gi, fullTitle) : 'Good News! Your Pre-order Is Ready for Fulfillment';
    const preorderBodyMessage = preorderTmpl.bodyMessage
      ? preorderTmpl.bodyMessage.replace(/\{\{store_name\}\}/gi, storeDisplayName).replace(/\{\{product_title\}\}/gi, fullTitle)
      : 'The product you pre-ordered is back in stock, and we are preparing to fulfill your order.';
    const rawPreorderBtn = (preorderTmpl.buttonText || 'View Order Status').replace(/\s*[→➔➜>]\s*$/g, '').trim();
    const preorderButtonLabel = `${rawPreorderBtn} &rarr;`;
    const preorderButtonColor = preorderTmpl.buttonColor || '#111827';

    const plainText = [
      `Hi ${greetingName},`,
      ``,
      preorderBodyMessage,
      ``,
      `Order Number: ${orderDisplay}`,
      `Product: ${fullTitle}`,
      `Price: ${displayPrice}`,
      `View Order: ${fallbackUrl}`,
      ``,
      `You received this message regarding your pre-order on ${storeDisplayName}.`,
      `© ${new Date().getFullYear()} ${storeDisplayName}. All rights reserved.`,
    ].join('\n');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f7;padding:30px 10px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background:#ffffff;border-radius:14px;border:1px solid #e5e7eb;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,0.06);">
          <!-- Top Header -->
          <tr>
            <td style="background-color:#111827;padding:18px 24px;text-align:left;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="color:#ffffff;font-size:17px;font-weight:bold;letter-spacing:-0.02em;">
                    ${storeDisplayName}
                  </td>
                  <td align="right" style="color:#9ca3af;font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">
                    PRE-ORDER PRIORITY
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding:32px 24px;text-align:left;">
              <div style="background-color:${preorderBannerColor};color:#ffffff;font-size:12px;font-weight:bold;padding:8px 16px;border-radius:8px;display:inline-block;margin-bottom:16px;">
                ${preorderBannerText}
              </div>
              <h1 style="margin:0 0 14px;font-size:22px;font-weight:800;color:#111827;line-height:1.3;">${preorderHeadline}</h1>
              <p style="margin:0 0 12px;font-size:15px;color:#111827;font-weight:600;">
                Hi ${greetingName},
              </p>
              <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.6;">
                ${preorderBodyMessage}
              </p>

              <!-- Order & Product Details -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafafa;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:20px;">
                <tr>
                  <td style="font-size:14px;color:#374151;padding:4px 0;">
                    <strong>Order Number:</strong> <span style="color:#2563eb;font-weight:bold;">${orderDisplay}</span>
                  </td>
                </tr>
                ${safeImageUrl ? `
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;background-color:#ffffff!important;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                      <tr>
                        <td align="center" style="padding:12px;background-color:#ffffff!important;border-radius:12px;">
                          <img src="${safeImageUrl}" alt="${fullTitle.replace(/"/g, '&quot;')}" width="200" border="0" style="display:block;max-width:200px;width:100%;height:auto;border-radius:8px;background-color:#ffffff!important;margin:0 auto;" />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td align="center" style="font-size:19px;font-weight:bold;color:#111827;padding-bottom:6px;">
                    ${productTitle}
                  </td>
                </tr>
                ${variantTitle && variantTitle !== 'Default Title' ? `
                <tr>
                  <td align="center" style="padding-bottom:10px;">
                    <span style="display:inline-block;background-color:#e5e7eb;color:#374151;font-size:12px;font-weight:bold;padding:4px 12px;border-radius:20px;">
                      Variant: ${variantTitle}
                    </span>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="font-size:14px;color:#374151;padding:4px 0;">
                    <strong>Price:</strong> ${displayPrice}
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:16px;padding-bottom:10px;">
                    <a href="${fallbackUrl}" target="_blank" style="display:inline-block;background-color:${preorderButtonColor};color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 32px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
                      ${preorderButtonLabel}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 10px;font-size:14px;color:#4b5563;line-height:1.5;">
                We will notify you once your order has been shipped.
              </p>
              <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.5;">
                Thank you for your patience and for shopping with us!
              </p>
              <p style="margin:0;font-size:14px;color:#111827;font-weight:bold;">
                ${storeDisplayName} Team
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 24px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280;line-height:1.6;">
              You received this message regarding your pre-order on ${storeDisplayName}.<br/>
              &copy; ${new Date().getFullYear()} ${storeDisplayName}. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const fromEmail = getEmailFrom(storeDisplayName);
    return dispatchEmail(to, fromEmail, subject, html, fallbackUrl, plainText, { ...params, emailType: params.emailType || 'PREORDER_IN_STOCK' });
  }

  /**
   * Send an instant confirmation email when customer completes a Pre-order at checkout.
   * Confirms order number, reserved product, and fulfillment promise.
   */
  static async sendPreorderConfirmationEmail(params: SendEmailParams): Promise<NotificationResult> {
    const { to, productTitle: rawProductTitle, variantTitle: rawVariantTitle, productUrl, imageUrl, storeName, price, customerName, orderNumber } = params;

    const storeDisplayName = (storeName || 'Online Store').replace(/["']/g, '');
    const { productTitle, variantTitle, fullTitle } = cleanTitleAndVariant(rawProductTitle, rawVariantTitle, storeDisplayName);
    const fallbackUrl = productUrl || '#';
    const displayPrice = price ? (price.startsWith('₹') || price.startsWith('Rs') || price.startsWith('$') ? price : `₹${price}`) : '₹1,240';
    const safeImageUrl = await resolveLiveImageUrl(imageUrl);
    const greetingName = customerName && customerName.trim() ? customerName.trim() : 'Customer';
    const orderDisplay = orderNumber ? (orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`) : '#1234';

    let emailSubject = params.subject?.trim();
    if (emailSubject) {
      if (emailSubject.includes('Good news!')) {
        emailSubject = emailSubject.replace(/Good news!\s*/i, `[${storeDisplayName}] `);
      }
      emailSubject = emailSubject
        .replace(/\{\{order_number\}\}/gi, orderDisplay)
        .replace(/\{\{product_title\}\}/gi, fullTitle)
        .replace(/\{\{product\}\}/gi, fullTitle)
        .replace(/\{\{store_name\}\}/gi, storeDisplayName)
        .replace(/\{\{store\}\}/gi, storeDisplayName)
        .replace(/["']/g, '');
    } else {
      emailSubject = `[${storeDisplayName}] Pre-order Confirmed: Order ${orderDisplay} - ${fullTitle}`;
    }

    const subject = emailSubject;

    const plainText = [
      `Hi ${greetingName},`,
      ``,
      `Your pre-order has been successfully placed at ${storeDisplayName}.`,
      ``,
      `Order Number: ${orderDisplay}`,
      `Product: ${fullTitle}`,
      `Price: ${displayPrice}`,
      `Status: Confirmed • Awaiting Restock`,
      `View Order Details: ${fallbackUrl}`,
      ``,
      `You are receiving this pre-order confirmation because you completed a pre-order on ${storeDisplayName}.`,
      `© ${new Date().getFullYear()} ${storeDisplayName}. All rights reserved.`,
    ].join('\n');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f7;padding:30px 10px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background:#ffffff;border-radius:14px;border:1px solid #e5e7eb;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,0.06);">
          <!-- Top Header -->
          <tr>
            <td style="background-color:#111827;padding:18px 24px;text-align:left;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="color:#ffffff;font-size:17px;font-weight:bold;letter-spacing:-0.02em;">
                    ${storeDisplayName}
                  </td>
                  <td align="right" style="color:#9ca3af;font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">
                    PRE-ORDER CONFIRMED
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding:32px 24px;text-align:left;">
              <div style="background-color:#fef3c7;border:1px solid #fde68a;color:#92400e;font-size:13px;font-weight:bold;padding:8px 16px;border-radius:8px;display:inline-block;margin-bottom:16px;">
                PRE-ORDER CONFIRMED
              </div>
              <h1 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#111827;letter-spacing:-0.02em;">PRE-ORDER CONFIRMED</h1>
              <p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.5;">
                Your pre-order has been successfully placed.
              </p>
              <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.6;">
                Hi ${greetingName}, thank you for your order! We have received your pre-order <strong>${orderDisplay}</strong>.<br/>
                Your items have been safely reserved. We will notify you by email the moment new stock arrives and your order is prepared for fulfillment.
              </p>

              <!-- Order & Product Details -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafafa;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:20px;">
                <tr>
                  <td style="font-size:14px;color:#374151;padding:4px 0;">
                    <strong>Order Number:</strong> <span style="color:#2563eb;font-weight:bold;">${orderDisplay}</span>
                  </td>
                </tr>
                <tr>
                  <td style="font-size:14px;color:#374151;padding:4px 0;">
                    <strong>Product:</strong> ${productTitle}
                  </td>
                </tr>
                ${variantTitle && variantTitle !== 'Default Title' ? `
                <tr>
                  <td style="font-size:14px;color:#374151;padding:4px 0;">
                    <strong>Variant:</strong> ${variantTitle}
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="font-size:14px;color:#374151;padding:4px 0;">
                    <strong>Status:</strong> <span style="color:#d97706;font-weight:bold;">Confirmed &bull; Awaiting Restock</span>
                  </td>
                </tr>
                ${params.paymentOption === 'HALF' ? `
                <tr>
                  <td style="font-size:14px;color:#374151;padding:4px 0;">
                    <strong>Payment Plan:</strong> <span style="color:#059669;font-weight:bold;">Half Payment (50% Deposit)</span>
                  </td>
                </tr>
                <tr>
                  <td style="font-size:14px;color:#374151;padding:4px 0;">
                    <strong>Deposit Paid:</strong> ₹${Number(params.depositAmount || 0).toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td style="font-size:14px;color:#374151;padding:4px 0;">
                    <strong>Remaining Due:</strong> <span style="color:#b45309;font-weight:bold;">₹${Number(params.remainingBalance || 0).toFixed(2)} (Due upon restock)</span>
                  </td>
                </tr>
                ` : `
                <tr>
                  <td style="font-size:14px;color:#374151;padding:4px 0;">
                    <strong>Payment:</strong> <span style="color:#059669;font-weight:bold;">Full Payment (100% Paid)</span>
                  </td>
                </tr>
                `}
              </table>

              ${safeImageUrl ? `
              <div style="text-align:center;padding:12px 0 20px;">
                <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;background-color:#ffffff!important;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                  <tr>
                    <td align="center" style="padding:12px;background-color:#ffffff!important;border-radius:12px;">
                      <img src="${safeImageUrl}" alt="${fullTitle}" width="180" style="display:block;max-width:180px;width:100%;height:auto;border-radius:8px;background-color:#ffffff!important;margin:0 auto;" />
                    </td>
                  </tr>
                </table>
              </div>
              ` : ''}

              <div style="text-align:center;padding-top:10px;">
                <a href="${fallbackUrl}" target="_blank" style="display:inline-block;background-color:#111827;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
                  View Order Details
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:20px 24px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#6b7280;">
                You are receiving this pre-order confirmation because you completed a pre-order on <strong>${storeDisplayName}</strong>.
              </p>
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                &copy; ${new Date().getFullYear()} ${storeDisplayName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const fromEmail = getEmailFrom(storeDisplayName);
    return dispatchEmail(to, fromEmail, subject, html, fallbackUrl, plainText, { ...params, emailType: params.emailType || 'PREORDER_CONFIRMATION' });
  }
}

