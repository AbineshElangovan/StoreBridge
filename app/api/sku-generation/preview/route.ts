import { NextRequest, NextResponse } from "next/server";
import { authenticate, handleApiError } from "@/lib/shopify/authenticate";
import { generateSkuPreview } from "@/services/sku/sku-preview-service";

export async function POST(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    const body = await req.json();
    const { shopifyProductId, options } = body;

    if (!shopifyProductId || !options || !Array.isArray(options)) {
      return NextResponse.json(
        { success: false, error: "shopifyProductId and options array are required." },
        { status: 400 }
      );
    }

    const preview = await generateSkuPreview(store.id, shopifyProductId, options);
    return NextResponse.json(preview);
  } catch (err: any) {
    console.error("[SKU API] Preview Error:", err.message);
    return handleApiError(err);
  }
}
