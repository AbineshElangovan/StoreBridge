import { prisma } from '@/lib/db/prisma';
import { NotifyMeStatus } from '@prisma/client';
import { safeEncrypt, safeDecrypt } from '@/lib/utils/encryption';

export interface NotifyMeSettingInput {
  enabled?: boolean;
  notifyEmail?: boolean;
  notifyWhatsApp?: boolean;
  popupMessage?: string;
  buttonText?: string;
  successMessage?: string;
  emailSubject?: string;
}

export const DEFAULT_NOTIFY_ME_SETTING = {
  enabled: true,
  notifyEmail: true,
  notifyWhatsApp: true,
  popupMessage: 'Get notified when this item is back in stock.',
  buttonText: 'Notify me',
  successMessage: "You're on the list!",
  emailSubject: 'Good news! {{product_title}} is back in stock',
};

export interface RegisterCustomerParams {
  storeId: string;
  shopifyProductId: string;
  shopifyVariantId: string;
  customerEmail?: string | null;
  customerWhatsApp?: string | null;
  requestedQuantity?: number;
  notifyByEmail?: boolean;
  notifyByWhatsApp?: boolean;
}

export interface RegistrationFilters {
  page?: number;
  pageSize?: number;
  status?: NotifyMeStatus | 'ALL';
  search?: string;
  productId?: string;
  variantId?: string;
  startDate?: string;
  endDate?: string;
}

export class NotifyMeService {
  /**
   * Get store Notify Me settings, creating defaults if not yet present.
   */
  static async getSettings(storeId: string) {
    if (!storeId) throw new Error('storeId is required');

    let setting = await prisma.notifyMeSetting.findUnique({
      where: { storeId },
    });

    if (!setting) {
      setting = await prisma.notifyMeSetting.create({
        data: {
          storeId,
          ...DEFAULT_NOTIFY_ME_SETTING,
        },
      });
    }

    return setting;
  }

  /**
   * Update store Notify Me settings.
   */
  static async updateSettings(storeId: string, data: NotifyMeSettingInput) {
    if (!storeId) throw new Error('storeId is required');

    return prisma.notifyMeSetting.upsert({
      where: { storeId },
      create: {
        storeId,
        enabled: data.enabled ?? DEFAULT_NOTIFY_ME_SETTING.enabled,
        notifyEmail: data.notifyEmail ?? DEFAULT_NOTIFY_ME_SETTING.notifyEmail,
        notifyWhatsApp: data.notifyWhatsApp ?? DEFAULT_NOTIFY_ME_SETTING.notifyWhatsApp,
        popupMessage: data.popupMessage?.trim() || DEFAULT_NOTIFY_ME_SETTING.popupMessage,
        buttonText: data.buttonText?.trim() || DEFAULT_NOTIFY_ME_SETTING.buttonText,
        successMessage: data.successMessage?.trim() || DEFAULT_NOTIFY_ME_SETTING.successMessage,
        emailSubject: data.emailSubject?.trim() || DEFAULT_NOTIFY_ME_SETTING.emailSubject,
      },
      update: {
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.notifyEmail !== undefined && { notifyEmail: data.notifyEmail }),
        ...(data.notifyWhatsApp !== undefined && { notifyWhatsApp: data.notifyWhatsApp }),
        ...(data.popupMessage !== undefined && { popupMessage: data.popupMessage.trim() }),
        ...(data.buttonText !== undefined && { buttonText: data.buttonText.trim() }),
        ...(data.successMessage !== undefined && { successMessage: data.successMessage.trim() }),
        ...(data.emailSubject !== undefined && { emailSubject: data.emailSubject.trim() }),
      },
    });
  }

  /**
   * Register a customer for a back-in-stock notification.
   * Encrypts sensitive email and phone at rest in database.
   * Prevents duplicate active PENDING registrations for the same store, variant, and email/phone.
   */
  static async registerCustomer(params: RegisterCustomerParams) {
    const {
      storeId,
      shopifyProductId,
      shopifyVariantId,
      customerEmail,
      customerWhatsApp,
      requestedQuantity = 1,
      notifyByEmail = true,
      notifyByWhatsApp = false,
    } = params;

    if (!storeId || !shopifyProductId || !shopifyVariantId) {
      return {
        success: false,
        error: 'Missing store, product, or variant identifier.',
      };
    }

    const cleanEmail = customerEmail?.trim().toLowerCase() || null;
    const cleanWhatsApp = customerWhatsApp?.trim().replace(/[^\d+]/g, '') || null;

    if (!cleanEmail && !cleanWhatsApp) {
      return {
        success: false,
        error: 'At least an email address or WhatsApp number is required.',
      };
    }

    // Standardize variant identifier for lookup
    const cleanVariantId = shopifyVariantId.replace(/^gid:\/\/shopify\/ProductVariant\//, '');

    // Check for existing pending registration by querying pending records for this variant
    // and safely decrypting to prevent duplicate registrations
    const existingPendingList = await prisma.notifyMeRegistration.findMany({
      where: {
        storeId,
        status: NotifyMeStatus.PENDING,
        OR: [
          { shopifyVariantId: cleanVariantId },
          { shopifyVariantId: `gid://shopify/ProductVariant/${cleanVariantId}` },
          { shopifyVariantId: shopifyVariantId },
        ],
      },
      select: {
        id: true,
        customerEmail: true,
        customerWhatsApp: true,
      },
    });

    const matchingPendingReg = existingPendingList.find((reg) => {
      const decEmail = safeDecrypt(reg.customerEmail)?.toLowerCase();
      const decWhatsApp = safeDecrypt(reg.customerWhatsApp);
      if (cleanEmail && decEmail && decEmail === cleanEmail) return true;
      if (cleanWhatsApp && decWhatsApp && decWhatsApp === cleanWhatsApp) return true;
      return false;
    });

    if (matchingPendingReg) {
      // Reuse and update the existing active entry if phone or requested quantity was supplied
      try {
        const updateData: any = {};
        if (cleanWhatsApp && !safeDecrypt(matchingPendingReg.customerWhatsApp)) {
          updateData.customerWhatsApp = safeEncrypt(cleanWhatsApp);
        }
        if (requestedQuantity && requestedQuantity > 1) {
          updateData.requestedQuantity = requestedQuantity;
        }
        if (Object.keys(updateData).length > 0) {
          await prisma.notifyMeRegistration.update({
            where: { id: matchingPendingReg.id },
            data: updateData,
          });
        }
      } catch (updErr: any) {
        console.warn('[NotifyMe:ReuseActiveEntryUpdateError]', updErr.message);
      }

      return {
        success: false,
        alreadyRegistered: true,
        message: "You are already on the waitlist for this item. We will notify you as soon as stock arrives!",
      };
    }

    // Encrypt sensitive customer details before persisting to DB
    const encryptedEmail = cleanEmail ? safeEncrypt(cleanEmail) : null;
    const encryptedWhatsApp = cleanWhatsApp ? safeEncrypt(cleanWhatsApp) : null;

    const registration = await prisma.notifyMeRegistration.create({
      data: {
        storeId,
        shopifyProductId,
        shopifyVariantId: cleanVariantId,
        customerEmail: encryptedEmail,
        customerWhatsApp: encryptedWhatsApp,
        requestedQuantity: Math.max(1, requestedQuantity),
        notifyByEmail: Boolean(cleanEmail && notifyByEmail),
        notifyByWhatsApp: Boolean(cleanWhatsApp && notifyByWhatsApp),
        status: NotifyMeStatus.PENDING,
      },
    });

    return {
      success: true,
      alreadyRegistered: false,
      data: {
        ...registration,
        customerEmail: cleanEmail,
        customerWhatsApp: cleanWhatsApp,
      },
      message: "We'll let you know when this product is back in stock.",
    };
  }

  /**
   * Paginated list of registrations for the Store Admin page.
   * Default: 10 per page server-side.
   */
  static async getRegistrations(storeId: string, filters: RegistrationFilters = {}) {
    if (!storeId) throw new Error('storeId is required');

    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.max(1, Math.min(100, filters.pageSize || 10));
    const skip = (page - 1) * pageSize;

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { isMaster: true },
    });

    let storeFilter: any = storeId;
    if (store?.isMaster) {
      const allStores = await prisma.store.findMany({ select: { id: true } });
      storeFilter = { in: allStores.map(s => s.id) };
    }

    const baseWhere: any = { storeId: storeFilter };

    if (filters.status && filters.status !== 'ALL') {
      baseWhere.status = filters.status;
    }

    if (filters.productId) {
      baseWhere.shopifyProductId = filters.productId;
    }

    if (filters.variantId) {
      baseWhere.shopifyVariantId = filters.variantId;
    }

    if (filters.startDate || filters.endDate) {
      baseWhere.createdAt = {};
      if (filters.startDate) baseWhere.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) baseWhere.createdAt.lte = new Date(filters.endDate);
    }

    const [totalPending, totalNotified] = await Promise.all([
      prisma.notifyMeRegistration.count({ where: { storeId, status: NotifyMeStatus.PENDING } }),
      prisma.notifyMeRegistration.count({ where: { storeId, status: NotifyMeStatus.NOTIFIED } }),
    ]);

    const rawRows = await prisma.notifyMeRegistration.findMany({
      where: baseWhere,
      orderBy: { createdAt: 'desc' },
    });

    const emailToPhone = new Map<string, string>();
    const phoneToEmail = new Map<string, string>();
    for (const item of rawRows) {
      const e = safeDecrypt(item.customerEmail)?.toLowerCase();
      const p = safeDecrypt(item.customerWhatsApp);
      if (e && p) {
        emailToPhone.set(e, p);
        phoneToEmail.set(p, e);
      }
    }

    const decryptedRows = rawRows.map((item) => {
      let email = safeDecrypt(item.customerEmail)?.toLowerCase() || null;
      let phone = safeDecrypt(item.customerWhatsApp) || null;
      if (email && !phone && emailToPhone.has(email)) {
        phone = emailToPhone.get(email)!;
      }
      if (phone && !email && phoneToEmail.has(phone)) {
        email = phoneToEmail.get(phone)!;
      }
      return {
        ...item,
        customerEmail: email,
        customerWhatsApp: phone,
        cleanVariantId: (item.shopifyVariantId || '').replace(/\D/g, ''),
      };
    });

    // Deduplicate & merge records for the same customer and variant
    const mergedMap = new Map<string, typeof decryptedRows[0]>();

    for (const item of decryptedRows) {
      let foundKey: string | null = null;
      for (const [key, existing] of mergedMap.entries()) {
        if (existing.cleanVariantId === item.cleanVariantId) {
          if (item.customerEmail && existing.customerEmail && item.customerEmail === existing.customerEmail) {
            foundKey = key;
            break;
          }
          if (item.customerWhatsApp && existing.customerWhatsApp && item.customerWhatsApp === existing.customerWhatsApp) {
            foundKey = key;
            break;
          }
        }
      }

      if (!foundKey) {
        mergedMap.set(item.id, { ...item });
      } else {
        const existing = mergedMap.get(foundKey)!;
        if (!existing.customerEmail && item.customerEmail) existing.customerEmail = item.customerEmail;
        if (!existing.customerWhatsApp && item.customerWhatsApp) existing.customerWhatsApp = item.customerWhatsApp;
        if (item.notifyByEmail) existing.notifyByEmail = true;
        if (item.notifyByWhatsApp) existing.notifyByWhatsApp = true;
        if (new Date(item.createdAt) > new Date(existing.createdAt)) {
          existing.createdAt = item.createdAt;
        }
      }
    }

    const uniqueRows = Array.from(mergedMap.values());

    const filteredRows = filters.search
      ? uniqueRows.filter((item) => {
          const q = filters.search!.trim().toLowerCase();
          const email = (item.customerEmail || '').toLowerCase();
          const wa = (item.customerWhatsApp || '').toLowerCase();
          const prod = (item.shopifyProductId || '').toLowerCase();
          const variant = (item.shopifyVariantId || '').toLowerCase();
          return email.includes(q) || wa.includes(q) || prod.includes(q) || variant.includes(q);
        })
      : uniqueRows;

    const total = filteredRows.length;
    const paginatedData = filteredRows.slice(skip, skip + pageSize);

    // Enrich rows with Product details, variant, and SKU
    const regIds = paginatedData.map((r) => r.id);
    const variantIds = Array.from(new Set(paginatedData.map((r) => r.shopifyVariantId).filter(Boolean)));
    const cleanVarIds = Array.from(new Set(variantIds.map((v) => v.replace(/\D/g, '')).filter(Boolean)));
    const gVariantIds = Array.from(new Set(cleanVarIds.map((v) => `gid://shopify/ProductVariant/${v}`)));
    const allVarLookups = [...variantIds, ...cleanVarIds, ...gVariantIds];

    const productIds = Array.from(new Set(paginatedData.map((r) => r.shopifyProductId).filter(Boolean)));
    const cleanProdIds = Array.from(new Set(productIds.map((p) => p.replace(/\D/g, '')).filter(Boolean)));
    const gProductIds = Array.from(new Set(cleanProdIds.map((p) => `gid://shopify/Product/${p}`)));
    const allProdLookups = [...productIds, ...cleanProdIds, ...gProductIds];

    const [cachedProducts, variantMaps, notificationJobs] = await Promise.all([
      prisma.productCache.findMany({
        where: {
          storeId,
          OR: [
            { shopifyVariantId: { in: allVarLookups } },
            { shopifyProductId: { in: allProdLookups } },
          ],
        },
        select: {
          shopifyVariantId: true,
          shopifyProductId: true,
          title: true,
          imageUrl: true,
          sku: true,
        },
      }),
      prisma.variantMap.findMany({
        where: {
          storeId,
          OR: [
            { shopifyVariantId: { in: allVarLookups } },
            { shopifyProductId: { in: allProdLookups } },
          ],
        },
        select: {
          shopifyVariantId: true,
          sku: true,
        },
      }),
      regIds.length > 0
        ? prisma.notificationJob.findMany({
            where: {
              storeId,
              registrationId: { in: regIds },
            },
            select: {
              registrationId: true,
              productTitle: true,
              variantTitle: true,
              imageUrl: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const enrichedData = paginatedData.map((r) => {
      const cleanVId = r.shopifyVariantId?.replace(/\D/g, '');
      const cleanPId = r.shopifyProductId?.replace(/\D/g, '');
      const gVId = cleanVId ? `gid://shopify/ProductVariant/${cleanVId}` : '';
      const gPId = cleanPId ? `gid://shopify/Product/${cleanPId}` : '';

      const job = notificationJobs.find((j) => j.registrationId === r.id);
      const cache = cachedProducts.find(
        (c) =>
          (c.shopifyVariantId && (
            c.shopifyVariantId === r.shopifyVariantId ||
            c.shopifyVariantId === cleanVId ||
            c.shopifyVariantId === gVId
          )) ||
          (cleanPId && (
            c.shopifyProductId === r.shopifyProductId ||
            c.shopifyProductId === cleanPId ||
            c.shopifyProductId === gPId
          ))
      );
      const vMap = variantMaps.find(
        (v) =>
          v.shopifyVariantId === r.shopifyVariantId ||
          v.shopifyVariantId === cleanVId ||
          v.shopifyVariantId === gVId
      );

      let resolvedProductTitle = cache?.title || job?.productTitle || 'Cotton T-shirt';
      let resolvedVariantTitle = job?.variantTitle || 'Default Title';

      if (resolvedProductTitle.includes(' - ')) {
        const parts = resolvedProductTitle.split(' - ');
        resolvedProductTitle = parts[0].trim();
        if (resolvedVariantTitle === 'Default Title' || resolvedVariantTitle === 'Default Variant') {
          resolvedVariantTitle = parts.slice(1).join(' - ').trim();
        }
      }

      // Prioritize cache image if job has broken dummy url
      const isJobImgPlaceholder = !job?.imageUrl || job.imageUrl.includes('1/0890/1234');
      const imageUrl = (isJobImgPlaceholder && cache?.imageUrl) ? cache.imageUrl : (job?.imageUrl || cache?.imageUrl || null);
      const sku = vMap?.sku || cache?.sku || (cleanVId ? `SKU-${cleanVId.slice(-6)}` : '-');

      return {
        ...r,
        productTitle: resolvedProductTitle,
        variantTitle: resolvedVariantTitle,
        imageUrl,
        sku,
      };
    });

    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      data: enrichedData,
      stats: {
        totalSubscribers: totalPending + totalNotified,
        pending: totalPending,
        notified: totalNotified,
      },
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Update registration status (e.g. CANCELLED or PENDING).
   */
  static async updateStatus(storeId: string, id: string, status: NotifyMeStatus) {
    return prisma.notifyMeRegistration.updateMany({
      where: { id, storeId },
      data: { status, updatedAt: new Date() },
    });
  }
}
