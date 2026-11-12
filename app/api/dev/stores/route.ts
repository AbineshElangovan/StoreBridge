import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { isStoreStandalone } from '@/lib/shopify/authenticate';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Strictly disabled in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, error: 'Local dev store switcher is disabled in production' },
      { status: 403 }
    );
  }

  // Hostname guard: Only allow localhost, 127.0.0.1, or Microsoft Dev Tunnel
  const host = req.headers.get('host') || '';
  const isAllowedDevHost = 
    host.includes('localhost') || 
    host.includes('127.0.0.1') || 
    host.includes('devtunnels.ms');

  if (!isAllowedDevHost) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized host' },
      { status: 403 }
    );
  }

  try {
    const stores = await prisma.store.findMany({
      where: { isActive: true },
      select: {
        id: true,
        shopDomain: true,
        label: true,
        isMaster: true,
      },
      orderBy: [{ isMaster: 'desc' }, { label: 'asc' }],
    });

    const enriched = await Promise.all(
      stores.map(async (s) => {
        const standalone = await isStoreStandalone(s.id);
        let role: 'MASTER' | 'CONNECTED' | 'STANDALONE' = 'STANDALONE';
        if (s.isMaster) {
          role = 'MASTER';
        } else if (!standalone) {
          role = 'CONNECTED';
        }
        return {
          id: s.id,
          shopDomain: s.shopDomain,
          label: s.label || s.shopDomain.split('.')[0],
          isMaster: s.isMaster,
          isStandalone: standalone,
          role,
        };
      })
    );

    return NextResponse.json({
      success: true,
      stores: enriched,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

