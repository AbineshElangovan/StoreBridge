import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { safeDecrypt } from '../lib/utils/encryption';

function getDatabaseUrls(): { primary: string; fallback?: string } {
  let primary = process.env.DATABASE_URL || '';
  let fallback: string | undefined;

  try {
    const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
    const match = envContent.match(/(?:#\s*)?DIRECT_URL="([^"]+)"/) || envContent.match(/(?:#\s*)?DATABASE_URL="([^"]+)"/);
    if (match && match[1]) {
      fallback = match[1];
    }
  } catch {}

  return { primary, fallback };
}

async function fetchWithClient(url: string, label: string) {
  const client = new PrismaClient({
    datasourceUrl: url.includes('connection_limit') ? url : `${url}${url.includes('?') ? '&' : '?'}connection_limit=3`,
  });

  try {
    const activities = await client.userActivity.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: {
        store: { select: { label: true, shopDomain: true, isMaster: true } },
      },
    });
    console.log(`[Connected to: ${label}]`);
    return { client, activities };
  } catch (err) {
    await client.$disconnect();
    throw err;
  }
}

function formatActor(actorType: string, rawUserId?: string | null): string {
  const userId = rawUserId ? safeDecrypt(rawUserId) || rawUserId : null;
  if (actorType === 'SHOPIFY_USER') {
    const cleanId = userId ? userId.replace(/^gid:\/\/shopify\/User\//, '') : '';
    return cleanId ? `Staff (#${cleanId})` : 'Staff Member';
  }
  if (actorType === 'WEBHOOK') return 'Shopify Webhook';
  if (actorType === 'SYSTEM') return 'System Worker';
  return 'System';
}

function formatAction(action: string): string {
  return action
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatTime(d: Date): string {
  const date = new Date(d);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  let relative = '';
  if (diffSec < 60) relative = 'Just now';
  else if (diffSec < 3600) relative = `${Math.floor(diffSec / 60)}m ago`;
  else if (diffSec < 86400) relative = `${Math.floor(diffSec / 3600)}h ago`;
  else relative = `${Math.floor(diffSec / 86400)}d ago`;

  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return `${formattedTime} (${relative})`;
}

function formatStore(activity: any): string {
  if (activity.store?.label) {
    return activity.store.label.trim();
  }
  const clean = activity.shopDomain.replace('.myshopify.com', '');
  return clean
    .split(/[-_]/)
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function decryptMetadata(metadata: any): any {
  if (!metadata) return null;
  if (typeof metadata === 'object' && metadata._encrypted && metadata.payload) {
    try {
      const decrypted = safeDecrypt(metadata.payload);
      if (decrypted) return JSON.parse(decrypted);
    } catch {}
  }
  return metadata;
}

async function main() {
  console.log('\n========================================================================');
  console.log('              STOREORBIT DEVELOPER ACTIVITY LOG (DECRYPTED)             ');
  console.log('  Security: Encrypted at rest (AES-256-GCM) | Decrypted live for dev   ');
  console.log('========================================================================\n');

  const { primary, fallback } = getDatabaseUrls();
  let client: PrismaClient | null = null;
  let activities: any[] = [];

  const useNeonDirect = process.argv.includes('--neon') || process.argv.includes('--cloud');
  const showVerbose = process.argv.includes('--verbose') || process.argv.includes('-v');

  if (useNeonDirect && fallback) {
    const res = await fetchWithClient(fallback, 'Neon Cloud PostgreSQL (AWS)');
    client = res.client;
    activities = res.activities;
  } else {
    try {
      const res = await fetchWithClient(primary, primary.includes('localhost') ? 'Local Database (localhost:5432)' : 'Primary Database');
      client = res.client;
      activities = res.activities;
    } catch (primaryErr: any) {
      if (fallback && (primary.includes('localhost') || primaryErr.message?.includes('localhost:5432'))) {
        console.log('Local database not reachable. Falling back to Neon Cloud...\n');
        const res = await fetchWithClient(fallback, 'Neon Cloud PostgreSQL (AWS)');
        client = res.client;
        activities = res.activities;
      } else {
        throw primaryErr;
      }
    }
  }

  if (activities.length === 0) {
    console.log('\nNo activity logs recorded yet.');
    console.log('Actions performed by users, webhooks, or background tasks will be logged here.\n');
  } else {
    const tableData = activities.map((a, index) => {
      // Decrypt description if encrypted
      const decryptedDescription = safeDecrypt(a.description) || a.description;

      return {
        '#': index + 1,
        Time: formatTime(a.createdAt),
        Store: formatStore(a),
        'Who': formatActor(a.actorType, a.userId),
        Action: formatAction(a.action),
        'What Happened': decryptedDescription,
      };
    });

    console.log('');
    console.table(tableData);
    console.log(`\nShowing latest ${activities.length} activity record(s).`);

    if (showVerbose) {
      console.log('\n--- DETAILED METADATA BREAKDOWN ---');
      activities.forEach((a, i) => {
        const decryptedDesc = safeDecrypt(a.description) || a.description;
        const meta = decryptMetadata(a.metadata);
        console.log(`\n[#${i + 1}] ${formatAction(a.action)} - ${formatStore(a)} (${formatTime(a.createdAt)})`);
        console.log(`Summary: ${decryptedDesc}`);
        if (meta && Object.keys(meta).length > 0) {
          console.log('Details:', JSON.stringify(meta, null, 2));
        }
      });
    } else {
      console.log('Tip: Run "npm run inspect:activity -- --verbose" to view complete metadata details.\n');
    }
  }

  if (client) {
    await client.$disconnect();
  }
}

main().catch((e) => {
  console.error('Error fetching activities:', e.message || e);
  process.exit(1);
});
