import { NextRequest, NextResponse } from 'next/server';
import { authenticate, handleApiError } from '@/lib/shopify/authenticate';
import { NotifyMeService } from '@/services/notify-me/notify-me-service';
import { NotifyMeStatus } from '@prisma/client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const NotifyMeSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  notifyWhatsApp: z.boolean().optional(),
  popupMessage: z.string().max(255).optional(),
  buttonText: z.string().max(100).optional(),
  successMessage: z.string().max(255).optional(),
  emailSubject: z.string().max(255).optional(),
});

const StatusUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.nativeEnum(NotifyMeStatus),
});

export async function GET(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    const searchParams = req.nextUrl.searchParams;

    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const status = (searchParams.get('status') || 'ALL') as any;
    const search = searchParams.get('search') || undefined;
    const productId = searchParams.get('productId') || undefined;
    const variantId = searchParams.get('variantId') || undefined;

    const [settings, registrationData] = await Promise.all([
      NotifyMeService.getSettings(store.id),
      NotifyMeService.getRegistrations(store.id, {
        page,
        pageSize,
        status,
        search,
        productId,
        variantId,
      }),
    ]);

    return NextResponse.json({
      success: true,
      settings,
      registrations: registrationData.data,
      stats: registrationData.stats,
      pagination: registrationData.pagination,
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    const body = await req.json();

    const parsed = NotifyMeSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await NotifyMeService.updateSettings(store.id, parsed.data);

    return NextResponse.json({
      success: true,
      settings: updated,
      message: 'Notify Me settings updated successfully',
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    const body = await req.json();

    const parsed = StatusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    await NotifyMeService.updateStatus(store.id, parsed.data.id, parsed.data.status);

    return NextResponse.json({
      success: true,
      message: `Registration marked as ${parsed.data.status}`,
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}
