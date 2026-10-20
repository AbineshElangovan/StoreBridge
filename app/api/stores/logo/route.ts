import { NextRequest, NextResponse } from "next/server";
import { authenticate, handleApiError } from "@/lib/shopify/authenticate";
import { prisma } from "@/lib/db/prisma";

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest) {
  try {
    const { store, sessionStore, isMasterSession } = await authenticate(req);
    const body = await req.json();
    const { storeId, logoUrl } = body;

    const targetStoreId = storeId || store.id;

    // Authorization check
    if (targetStoreId !== store.id) {
      const isMaster = isMasterSession || store.isMaster || sessionStore?.isMaster;
      if (!isMaster) {
        return NextResponse.json({ success: false, error: "Unauthorized store logo update" }, { status: 403 });
      }

      const connection = await (prisma as any).storeConnection.findFirst({
        where: {
          OR: [
            { sourceStoreId: store.id, targetStoreId },
            { sourceStoreId: sessionStore?.id || '', targetStoreId }
          ]
        }
      });

      if (!connection && targetStoreId !== sessionStore?.id) {
        return NextResponse.json({ success: false, error: "Unauthorized store access" }, { status: 403 });
      }
    }

    const cleanLogoUrl = (typeof logoUrl === 'string' && logoUrl.trim().length > 0)
      ? logoUrl.trim()
      : null;

    const updated = await prisma.store.update({
      where: { id: targetStoreId },
      data: { logoUrl: cleanLogoUrl },
      select: { id: true, shopDomain: true, label: true, logoUrl: true }
    });

    return NextResponse.json({
      success: true,
      store: updated
    });
  } catch (error: any) {
    console.error("[API:stores:logo] Error updating logo:", error.message);
    return handleApiError(error);
  }
}
