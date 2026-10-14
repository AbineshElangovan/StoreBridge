import { NextRequest, NextResponse } from 'next/server';
import { authenticate, handleApiError } from '@/lib/shopify/authenticate';
import { PreorderService } from '@/services/preorder/preorder-service';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { store, isStandalone } = await authenticate(req);
    if (!isStandalone) {
      return NextResponse.json(
        { success: false, error: 'Pre-order is restricted to Standalone stores.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Record ID is required.' },
        { status: 400 }
      );
    }

    const result = await PreorderService.generateRemainingPaymentLink(id, store.id);

    return NextResponse.json({
      ...result,
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}
