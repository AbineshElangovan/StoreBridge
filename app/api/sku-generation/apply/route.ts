import { NextRequest, NextResponse } from "next/server";
import { authenticate, handleApiError } from "@/lib/shopify/authenticate";
import { applySkuGeneration } from "@/services/sku/sku-application-service";

export async function POST(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    const body = await req.json();
    const { shopifyProductId, options, customPrice, customQuantity } = body;

    if (!shopifyProductId || !options || !Array.isArray(options)) {
      return NextResponse.json(
        { success: false, error: "shopifyProductId and options array are required." },
        { status: 400 }
      );
    }

    const result = await applySkuGeneration(
      store.id,
      shopifyProductId,
      options,
      customPrice,
      customQuantity
    );

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[SKU API] Apply Error:", err.message);
    return handleApiError(err);
  }
}
