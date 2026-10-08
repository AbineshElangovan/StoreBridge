import { NotificationResult } from './email-notification-service';

export interface SendWhatsAppParams {
  to: string;
  productTitle: string;
  variantTitle?: string | null;
  productUrl?: string | null;
  imageUrl?: string | null;
  storeName?: string | null;
  price?: string | null;
  customerName?: string | null;
  orderNumber?: string | null;
}

/**
 * Mobile numbers are collected strictly as customer leads.
 * External messaging is disabled; numbers are safely stored in DB for merchant contact.
 */
export class WhatsAppNotificationService {
  static async sendBackInStockWhatsApp(params: SendWhatsAppParams): Promise<NotificationResult> {
    console.log(`[WhatsAppNotificationService:LeadOnly] Contact recorded as lead only: ${params.to}`);
    return {
      success: true,
      messageId: `lead_${Date.now()}`,
    };
  }

  static async sendWaitlistConfirmationWhatsApp(params: SendWhatsAppParams): Promise<NotificationResult> {
    console.log(`[WhatsAppNotificationService:LeadOnly] Waitlist mobile recorded as lead only: ${params.to}`);
    return {
      success: true,
      messageId: `lead_${Date.now()}`,
    };
  }

  static async sendPreorderInStockWhatsApp(params: SendWhatsAppParams): Promise<NotificationResult> {
    console.log(`[WhatsAppNotificationService:LeadOnly] Pre-order mobile recorded as lead only: ${params.to}`);
    return {
      success: true,
      messageId: `lead_${Date.now()}`,
    };
  }
}
