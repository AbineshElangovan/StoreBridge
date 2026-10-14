import { NextRequest, NextResponse } from 'next/server';
import { authenticate, handleApiError } from '@/lib/shopify/authenticate';
import { EmailTemplateStore } from '@/services/notifications/email-template-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    let storeId: string | undefined;
    try {
      const auth = await authenticate(req);
      storeId = auth.store?.id;
    } catch {
      // Fallback for non-authenticated or preview contexts
    }

    const templates = EmailTemplateStore.getTemplates(storeId);
    return NextResponse.json({ success: true, templates });
  } catch (error: any) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    let storeId: string | undefined;
    try {
      const auth = await authenticate(req);
      storeId = auth.store?.id;
    } catch {
      // Fallback
    }

    const body = await req.json();
    if (!body || !body.templates) {
      return NextResponse.json({ success: false, error: 'Templates payload is required' }, { status: 400 });
    }

    const ok = EmailTemplateStore.saveTemplates(body.templates, storeId);
    return NextResponse.json({ success: ok, templates: body.templates });
  } catch (error: any) {
    return handleApiError(error);
  }
}
