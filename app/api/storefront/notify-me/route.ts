import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { NotifyMeService } from '@/services/notify-me/notify-me-service';
import { EmailNotificationService } from '@/services/notifications/email-notification-service';
import { z } from 'zod';

import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

export const dynamic = 'force-dynamic';

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Shopify-Shop-Domain, X-Tunnel-Skip-Anti-Phishing-Page, Accept',
  };
}

const mobileSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .or(z.literal(''))
  .refine(
    (val) => {
      if (!val || val.trim() === '') return true; // Optional: empty/omitted is valid
      if (val.startsWith('+')) {
        return isValidPhoneNumber(val);
      }
      const digits = val.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 10; // Exactly 10 digits
    },
    {
      message: 'Mobile number must be exactly 10 digits',
    }
  );

const StorefrontNotifyMeSchema = z.object({
  shop: z.string().min(1, 'Shop domain is required'),
  shopifyProductId: z.string().min(1, 'Product ID is required'),
  shopifyVariantId: z.string().min(1, 'Variant ID is required'),
  productTitle: z.string().optional(),
  variantTitle: z.string().optional(),
  productUrl: z.string().optional(),
  imageUrl: z.string().optional(),
  price: z.string().optional(),
  email: z
    .string()
    .trim()
    .min(1, 'Please enter a valid email address')
    .regex(
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      'Please enter a valid email address'
    ),
  mobile: mobileSchema,
  whatsapp: mobileSchema,
  quantity: z.number().int().min(1).optional().default(1),
});

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  try {
    const body = await req.json();

    const parsed = StorefrontNotifyMeSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors).flat()[0] || 'Validation failed. Please enter a valid email and 10-digit mobile number.';
      return NextResponse.json(
        {
          success: false,
          error: firstError,
          details: parsed.error.format(),
        },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const {
      shop,
      shopifyProductId,
      shopifyVariantId,
      productTitle,
      variantTitle,
      productUrl,
      imageUrl,
      price,
      email,
      mobile,
      whatsapp,
      quantity,
    } = parsed.data;

    // Securely resolve store by domain
    const cleanShop = shop.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];

    const store = await prisma.store.findFirst({
      where: {
        isActive: true,
        OR: [
          { shopDomain: cleanShop },
          { shopDomain: { contains: cleanShop.split('.')[0], mode: 'insensitive' } },
        ],
      },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: 'Store not found or inactive' },
        { status: 404, headers: corsHeaders(origin) }
      );
    }

    // Extract optional mobile lead formatted in standard E.164 (e.g. +919876543210)
    let cleanPhoneLead: string | null = null;
    const rawMobile = (mobile || whatsapp || '').trim();
    if (rawMobile) {
      try {
        if (rawMobile.startsWith('+') && isValidPhoneNumber(rawMobile)) {
          cleanPhoneLead = parsePhoneNumber(rawMobile).number;
        } else {
          const digits = rawMobile.replace(/\D/g, '');
          if (digits.length === 10) {
            cleanPhoneLead = `+91${digits}`;
          }
        }
      } catch {
        const digits = rawMobile.replace(/\D/g, '');
        cleanPhoneLead = digits ? `+91${digits.slice(-10)}` : null;
      }
    }

    const result = await NotifyMeService.registerCustomer({
      storeId: store.id,
      shopifyProductId,
      shopifyVariantId,
      customerEmail: email || null,
      customerWhatsApp: cleanPhoneLead || null, // Stored strictly as contact lead
      requestedQuantity: quantity,
      notifyByEmail: Boolean(email),
      notifyByWhatsApp: false, // Absolutely no WhatsApp messages dispatched, lead only
    });

    if (!result.success && !result.alreadyRegistered) {
      return NextResponse.json(
        {
          success: false,
          alreadyRegistered: false,
          message: result.message || result.error || 'Registration could not be completed.',
        },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // Lookup cached product in DB for complete image and price data
    let finalImageUrl = imageUrl || null;
    let finalPrice = price || null;
    let finalProductTitle = productTitle || '';
    let finalVariantTitle = variantTitle || '';

    try {
      const cleanVarId = shopifyVariantId.replace(/\D/g, '');
      const cleanProdId = shopifyProductId.replace(/\D/g, '');

      // 1. Look up by variant ID
      let cached = await prisma.productCache.findFirst({
        where: {
          storeId: store.id,
          OR: [
            { shopifyVariantId: shopifyVariantId },
            { shopifyVariantId: `gid://shopify/ProductVariant/${cleanVarId}` },
            { shopifyVariantId: cleanVarId },
          ],
        },
      });

      // 2. If not found by variant, look up by product ID
      if (!cached) {
        cached = await prisma.productCache.findFirst({
          where: {
            storeId: store.id,
            OR: [
              { shopifyProductId: shopifyProductId },
              { shopifyProductId: `gid://shopify/Product/${cleanProdId}` },
              { shopifyProductId: cleanProdId },
            ],
          },
        });
      }

      // 3. If not found, look up by title prefix
      if (!cached && productTitle) {
        cached = await prisma.productCache.findFirst({
          where: {
            storeId: store.id,
            title: { contains: productTitle.split('-')[0].trim(), mode: 'insensitive' },
          },
        });
      }

      if (cached) {
        if (!finalImageUrl && cached.imageUrl) finalImageUrl = cached.imageUrl;
        if (!finalPrice && cached.price) finalPrice = `₹${cached.price}`;
        if (cached.title) {
          if (cached.title.includes(' - ')) {
            const parts = cached.title.split(' - ');
            if (!finalProductTitle || finalProductTitle.includes(' - ')) {
              finalProductTitle = parts[0].trim();
            }
            if (!finalVariantTitle) {
              finalVariantTitle = parts.slice(1).join(' - ').trim();
            }
          } else if (!finalProductTitle) {
            finalProductTitle = cached.title.trim();
          }
        }
      }

      // If finalProductTitle still contains " - ", clean it up so variant is not duplicated
      if (finalProductTitle.includes(' - ')) {
        const parts = finalProductTitle.split(' - ');
        finalProductTitle = parts[0].trim();
        if (!finalVariantTitle) {
          finalVariantTitle = parts.slice(1).join(' - ').trim();
        }
      }

      // 4. If image is STILL null, fallback to any valid product image in the store
      if (!finalImageUrl) {
        const anyCached = await prisma.productCache.findFirst({
          where: {
            storeId: store.id,
            imageUrl: { not: null },
          },
        });
        if (anyCached?.imageUrl) {
          finalImageUrl = anyCached.imageUrl;
        }
      }
    } catch (cacheErr) {
      console.warn('[NotifyMe:ProductCacheLookup:Error]', cacheErr);
    }

    if (!finalProductTitle) finalProductTitle = 'Cotton T-shirt';
    if (!finalVariantTitle || finalVariantTitle === 'Default Title' || finalVariantTitle === 'Default Variant') {
      finalVariantTitle = '';
    }
    if (!finalPrice) finalPrice = '₹1,240';

    const storeDisplayName = store.label || store.shopDomain;

    let emailDelivered = false;
    // Dispatch waitlist confirmation email whenever customer provides an email
    if (email) {
      try {
        const emailRes = await EmailNotificationService.sendWaitlistConfirmationEmail({
          to: email,
          productTitle: finalProductTitle,
          variantTitle: finalVariantTitle,
          productUrl: productUrl || `https://${store.shopDomain}`,
          imageUrl: finalImageUrl,
          price: finalPrice,
          storeName: storeDisplayName,
        });
        if (emailRes.success) {
          emailDelivered = true;
          console.log(`[NotifyMe:ConfirmationEmail:Success] To: ${email} | ID: ${emailRes.messageId}`);
        } else {
          console.warn('[NotifyMe:ConfirmationEmail:Unsuccessful]', emailRes.error);
        }
      } catch (err: any) {
        console.warn('[NotifyMe:ConfirmationEmail:Failed]', err.message);
      }
    }

    // Create in-app notification in StoreBridge Dashboard for new subscribers
    if (!result.alreadyRegistered) {
      try {
        await prisma.notification.create({
          data: {
            recipientStoreId: store.id,
            type: 'INVENTORY_UPDATE',
            title: `New Restock Subscriber: ${finalProductTitle}`,
            message: `${email || cleanPhoneLead || 'A customer'} joined the waitlist for ${finalProductTitle}${finalVariantTitle ? ` (${finalVariantTitle})` : ''}.`,
            productId: shopifyVariantId,
            productTitle: finalProductTitle,
            sourceStoreId: store.id,
            isRead: false,
          },
        });
      } catch (_) {}
    }

    return NextResponse.json(
      {
        success: true,
        alreadyRegistered: result.alreadyRegistered || false,
        emailSent: emailDelivered,
        message: result.alreadyRegistered
          ? "You are already on the waitlist for this item. We will notify you as soon as stock arrives!"
          : (result.message || "We will notify you when this product is back in stock."),
      },
      { status: 200, headers: corsHeaders(origin) }
    );
  } catch (error: any) {
    console.error('[Storefront:NotifyMe:Error]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error processing notification registration' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
