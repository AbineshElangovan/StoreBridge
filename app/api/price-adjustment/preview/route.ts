import { NextRequest, NextResponse } from "next/server";
import { authenticate, handleApiError } from "@/lib/shopify/authenticate";
import { generatePriceAdjustmentPreview } from "@/services/price-adjustment/price-adjustment-preview-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    const body = await req.json();
    const { storeId, adjustments } = body;

    const targetStoreId = storeId || store.id;

    if (!adjustments || !Array.isArray(adjustments)) {
      return NextResponse.json(
        { success: false, error: "Invalid adjustments payload." },
        { status: 400 }
      );
    }

    const preview = await generatePriceAdjustmentPreview(targetStoreId, adjustments);
    return NextResponse.json(preview);
  } catch (err: any) {
    console.error("[Price Adjustment API] Preview Error:", err.message);
    return handleApiError(err);
  }
}
