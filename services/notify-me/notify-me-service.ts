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
}

export const DEFAULT_NOTIFY_ME_SETTING = {
  enabled: true,
  notifyEmail: true,
  notifyWhatsApp: true,
  popupMessage: 'Get notified when this item is back in stock.',
  buttonText: 'Notify me when available',
  successMessage: "You're on the list!",
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
      },
      update: {
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.notifyEmail !== undefined && { notifyEmail: data.notifyEmail }),
        ...(data.notifyWhatsApp !== undefined && { notifyWhatsApp: data.notifyWhatsApp }),
        ...(data.popupMessage !== undefined && { popupMessage: data.popupMessage.trim() }),
        ...(data.buttonText !== undefined && { buttonText: data.buttonText.trim() }),
        ...(data.successMessage !== undefined && { successMessage: data.successMessage.trim() }),
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

    const isDuplicate = existingPendingList.some((reg) => {
      const decEmail = safeDecrypt(reg.customerEmail)?.toLowerCase();
      const decWhatsApp = safeDecrypt(reg.customerWhatsApp);
      if (cleanEmail && decEmail && decEmail === cleanEmail) return true;
      if (cleanWhatsApp && decWhatsApp && decWhatsApp === cleanWhatsApp) return true;
      return false;
    });

    if (isDuplicate) {
      return {
        success: false,
        alreadyRegistered: true,
        message: "We'll let you know when this product is back in stock.",
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
   * Default: 15 per page server-side.
   */
  static async getRegistrations(storeId: string, filters: RegistrationFilters = {}) {
    if (!storeId) throw new Error('storeId is required');

    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.max(1, Math.min(100, filters.pageSize || 15));
    const skip = (page - 1) * pageSize;

    const baseWhere: any = { storeId };

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

    let total = 0;
    let paginatedData: any[] = [];

    if (filters.search) {
      const q = filters.search.trim().toLowerCase();
      // Fetch matching candidate set for the store and filter in memory over decrypted fields
      const candidates = await prisma.notifyMeRegistration.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
      });

      const matched = candidates.filter((item) => {
        const email = (safeDecrypt(item.customerEmail) || '').toLowerCase();
        const wa = (safeDecrypt(item.customerWhatsApp) || '').toLowerCase();
        const prod = (item.shopifyProductId || '').toLowerCase();
        const variant = (item.shopifyVariantId || '').toLowerCase();
        return email.includes(q) || wa.includes(q) || prod.includes(q) || variant.includes(q);
      });

      total = matched.length;
      paginatedData = matched.slice(skip, skip + pageSize).map((item) => ({
        ...item,
        customerEmail: safeDecrypt(item.customerEmail),
        customerWhatsApp: safeDecrypt(item.customerWhatsApp),
      }));
    } else {
      const [count, rows] = await Promise.all([
        prisma.notifyMeRegistration.count({ where: baseWhere }),
        prisma.notifyMeRegistration.findMany({
          where: baseWhere,
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
        }),
      ]);

      total = count;
      paginatedData = rows.map((item) => ({
        ...item,
        customerEmail: safeDecrypt(item.customerEmail),
        customerWhatsApp: safeDecrypt(item.customerWhatsApp),
      }));
    }

    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      data: paginatedData,
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
