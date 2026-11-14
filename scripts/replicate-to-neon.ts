import { PrismaClient } from '@prisma/client';
import { prisma as localPrisma } from '../lib/db/prisma';

const VERCEL_NEON_URL =
  process.env.VERCEL_NEON_URL ||
  'postgresql://neondb_owner:npg_7rDw2gJtlEeU@ep-restless-sun-b5m5tyc8-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const AWS_NEON_URL =
  process.env.AWS_NEON_URL ||
  'postgresql://neondb_owner:npg_U2vAaDoV4OKg@ep-patient-dream-bbqakoyb-pooler.c-15.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function syncTarget(targetName: string, dbUrl: string) {
  console.log(`\n=====================================================`);
  console.log(`🚀 REPLICATING LOCAL DATABASE TO: ${targetName.toUpperCase()}`);
  console.log(`=====================================================`);
  console.log(`Local DB: ${process.env.DATABASE_URL?.split('@')[1] || 'localhost:5432/shopify_sync'}`);
  console.log(`Neon DB:  ${dbUrl.split('@')[1] || 'neon.tech'}`);

  const neonPrisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });

  try {
    // 1. Replicate Stores
    console.log('\n[1/7] Syncing Store table...');
    const localStores = await localPrisma.store.findMany();
    let storeSynced = 0;
    for (const store of localStores) {
      await neonPrisma.store.upsert({
        where: { shopDomain: store.shopDomain },
        create: {
          id: store.id,
          shopifyStoreId: store.shopifyStoreId,
          shopDomain: store.shopDomain,
          accessToken: store.accessToken,
          refreshToken: store.refreshToken,
          expiresAt: store.expiresAt,
          refreshTokenExpiresAt: store.refreshTokenExpiresAt,
          scope: store.scope,
          isActive: store.isActive,
          label: store.label,
          bestSellerThreshold: store.bestSellerThreshold,
          deadStockDays: store.deadStockDays,
          uniqueStoreId: store.uniqueStoreId,
          authStatus: store.authStatus,
          lastAuthFailure: store.lastAuthFailure,
          authFailureReason: store.authFailureReason,
        },
        update: {
          shopifyStoreId: store.shopifyStoreId,
          accessToken: store.accessToken,
          refreshToken: store.refreshToken,
          expiresAt: store.expiresAt,
          refreshTokenExpiresAt: store.refreshTokenExpiresAt,
          scope: store.scope,
          isActive: store.isActive,
          label: store.label,
          bestSellerThreshold: store.bestSellerThreshold,
          deadStockDays: store.deadStockDays,
          uniqueStoreId: store.uniqueStoreId,
          authStatus: store.authStatus,
          lastAuthFailure: store.lastAuthFailure,
          authFailureReason: store.authFailureReason,
        },
      });
      storeSynced++;
    }
    console.log(`  ✓ Synced ${storeSynced}/${localStores.length} stores to ${targetName}.`);

    // 2. Replicate Sessions
    console.log('\n[2/7] Syncing Session table...');
    const localSessions = await localPrisma.session.findMany();
    let sessionSynced = 0;
    for (const session of localSessions) {
      await neonPrisma.session.upsert({
        where: { id: session.id },
        create: { ...session },
        update: { ...session },
      });
      sessionSynced++;
    }
    console.log(`  ✓ Synced ${sessionSynced}/${localSessions.length} sessions to ${targetName}.`);

    // 3. Replicate PreorderConfig
    console.log('\n[3/7] Syncing PreorderConfig table...');
    try {
      await neonPrisma.$executeRawUnsafe(`
        ALTER TABLE "preorder_configs" 
        ADD COLUMN IF NOT EXISTS "timerHeadingEnd" text DEFAULT 'Hurry up! Pre-order ending soon',
        ADD COLUMN IF NOT EXISTS "timerTextColorEnd" text DEFAULT '#000000',
        ADD COLUMN IF NOT EXISTS "timerBgColorEnd" text DEFAULT '#fee2e2',
        ADD COLUMN IF NOT EXISTS "timerStartDateMode" text DEFAULT 'USE_STATUS_DATE',
        ADD COLUMN IF NOT EXISTS "timerCustomStartDate" timestamp without time zone;
      `);
    } catch {}
    const localPreorderConfigs = await localPrisma.preorderConfig.findMany();
    let configSynced = 0;
    for (const config of localPreorderConfigs) {
      const storeExists = await neonPrisma.store.findUnique({ where: { id: config.storeId } });
      if (!storeExists) {
        console.warn(`  ⚠️ Skipping config ${config.id}: Store ${config.storeId} not found in ${targetName}.`);
        continue;
      }

      try {
        await neonPrisma.$executeRawUnsafe(`
          INSERT INTO "preorder_configs" (
            "id", "storeId", "shopifyProductId", "shopifyVariantId", "enabled", "inventoryThreshold",
            "customerMessage", "shippingMessage", "fulfillmentMessage", "maxQuantity", "discountType", "discountValue",
            "selectionMode", "selectedProductIds", "selectedCollectionIds", "allowHalfPayment", "allowFullPayment",
            "defaultPaymentOption", "statusScheduleType", "startDate", "endDate", "showTimer", "timerDisplayMode",
            "timerStartDateMode", "timerCustomStartDate", "timerDateMode", "timerCustomDate", "timerHeading",
            "timerTextColor", "timerBgColor", "timerHeadingEnd", "timerTextColorEnd", "timerBgColorEnd",
            "timerBorderRadius", "timerShowDays", "timerShowHours", "timerShowMinutes", "timerShowSeconds",
            "timerDaysLabel", "timerHoursLabel", "timerMinutesLabel", "timerSecondsLabel", "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
            $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, NOW(), NOW()
          )
          ON CONFLICT ("id") DO UPDATE SET
            "shopifyProductId" = EXCLUDED."shopifyProductId",
            "shopifyVariantId" = EXCLUDED."shopifyVariantId",
            "enabled" = EXCLUDED."enabled",
            "inventoryThreshold" = EXCLUDED."inventoryThreshold",
            "customerMessage" = EXCLUDED."customerMessage",
            "shippingMessage" = EXCLUDED."shippingMessage",
            "fulfillmentMessage" = EXCLUDED."fulfillmentMessage",
            "maxQuantity" = EXCLUDED."maxQuantity",
            "discountType" = EXCLUDED."discountType",
            "discountValue" = EXCLUDED."discountValue",
            "selectionMode" = EXCLUDED."selectionMode",
            "selectedProductIds" = EXCLUDED."selectedProductIds",
            "selectedCollectionIds" = EXCLUDED."selectedCollectionIds",
            "allowHalfPayment" = EXCLUDED."allowHalfPayment",
            "allowFullPayment" = EXCLUDED."allowFullPayment",
            "defaultPaymentOption" = EXCLUDED."defaultPaymentOption",
            "statusScheduleType" = EXCLUDED."statusScheduleType",
            "startDate" = EXCLUDED."startDate",
            "endDate" = EXCLUDED."endDate",
            "showTimer" = EXCLUDED."showTimer",
            "timerDisplayMode" = EXCLUDED."timerDisplayMode",
            "timerStartDateMode" = EXCLUDED."timerStartDateMode",
            "timerCustomStartDate" = EXCLUDED."timerCustomStartDate",
            "timerDateMode" = EXCLUDED."timerDateMode",
            "timerCustomDate" = EXCLUDED."timerCustomDate",
            "timerHeading" = EXCLUDED."timerHeading",
            "timerTextColor" = EXCLUDED."timerTextColor",
            "timerBgColor" = EXCLUDED."timerBgColor",
            "timerHeadingEnd" = EXCLUDED."timerHeadingEnd",
            "timerTextColorEnd" = EXCLUDED."timerTextColorEnd",
            "timerBgColorEnd" = EXCLUDED."timerBgColorEnd",
            "timerBorderRadius" = EXCLUDED."timerBorderRadius",
            "timerShowDays" = EXCLUDED."timerShowDays",
            "timerShowHours" = EXCLUDED."timerShowHours",
            "timerShowMinutes" = EXCLUDED."timerShowMinutes",
            "timerShowSeconds" = EXCLUDED."timerShowSeconds",
            "timerDaysLabel" = EXCLUDED."timerDaysLabel",
            "timerHoursLabel" = EXCLUDED."timerHoursLabel",
            "timerMinutesLabel" = EXCLUDED."timerMinutesLabel",
            "timerSecondsLabel" = EXCLUDED."timerSecondsLabel",
            "updatedAt" = NOW()
        `,
          config.id, config.storeId, config.shopifyProductId, config.shopifyVariantId, config.enabled, config.inventoryThreshold,
          config.customerMessage, config.shippingMessage, config.fulfillmentMessage, config.maxQuantity, config.discountType, config.discountValue,
          config.selectionMode, config.selectedProductIds, config.selectedCollectionIds, config.allowHalfPayment, config.allowFullPayment,
          config.defaultPaymentOption, config.statusScheduleType, config.startDate, config.endDate, config.showTimer, config.timerDisplayMode,
          (config as any).timerStartDateMode || 'USE_STATUS_DATE', (config as any).timerCustomStartDate || null, config.timerDateMode, config.timerCustomDate, config.timerHeading,
          config.timerTextColor, config.timerBgColor, (config as any).timerHeadingEnd || 'Hurry up! Pre-order ending soon', (config as any).timerTextColorEnd || '#000000', (config as any).timerBgColorEnd || '#fee2e2',
          config.timerBorderRadius, config.timerShowDays, config.timerShowHours, config.timerShowMinutes, config.timerShowSeconds,
          config.timerDaysLabel, config.timerHoursLabel, config.timerMinutesLabel, config.timerSecondsLabel
        );
      } catch (err: any) {
        console.warn(`  ⚠️ Failed to sync PreorderConfig ${config.id}:`, err.message);
      }
      configSynced++;
    }
    console.log(`  ✓ Synced ${configSynced}/${localPreorderConfigs.length} PreorderConfigs to ${targetName}.`);

    // 4. Replicate NotifyMeSetting
    console.log('\n[4/7] Syncing NotifyMeSetting table...');
    const localNotifySettings = await localPrisma.notifyMeSetting.findMany();
    let notifySynced = 0;
    for (const setting of localNotifySettings) {
      const storeExists = await neonPrisma.store.findUnique({ where: { id: setting.storeId } });
      if (!storeExists) continue;

      await neonPrisma.notifyMeSetting.upsert({
        where: { id: setting.id },
        create: { ...setting },
        update: { ...setting },
      });
      notifySynced++;
    }
    console.log(`  ✓ Synced ${notifySynced}/${localNotifySettings.length} NotifyMeSettings to ${targetName}.`);

    // 5. Replicate NotifyMeRegistration
    console.log('\n[5/7] Syncing NotifyMeRegistration table...');
    const localRegistrations = await localPrisma.notifyMeRegistration.findMany();
    let regSynced = 0;
    for (const reg of localRegistrations) {
      const storeExists = await neonPrisma.store.findUnique({ where: { id: reg.storeId } });
      if (!storeExists) continue;

      await neonPrisma.notifyMeRegistration.upsert({
        where: { id: reg.id },
        create: { ...reg },
        update: { ...reg },
      });
      regSynced++;
    }
    console.log(`  ✓ Synced ${regSynced}/${localRegistrations.length} NotifyMeRegistrations to ${targetName}.`);

    // 6. Replicate PreorderRecord
    console.log('\n[6/7] Syncing PreorderRecord table...');
    const localPreorderRecords = await localPrisma.preorderRecord.findMany();
    let preorderSynced = 0;
    for (const po of localPreorderRecords) {
      const storeExists = await neonPrisma.store.findUnique({ where: { id: po.storeId } });
      if (!storeExists) continue;

      await neonPrisma.preorderRecord.upsert({
        where: {
          storeId_shopifyOrderId_shopifyVariantId: {
            storeId: po.storeId,
            shopifyOrderId: po.shopifyOrderId,
            shopifyVariantId: po.shopifyVariantId,
          },
        },
        create: { ...po },
        update: {
          customerName: po.customerName,
          customerEmail: po.customerEmail,
          customerPhone: po.customerPhone,
          quantity: po.quantity,
          whatsappOptIn: po.whatsappOptIn,
          status: po.status,
          notifiedAt: po.notifiedAt,
          productTitle: po.productTitle,
          variantTitle: po.variantTitle,
          paymentOption: po.paymentOption,
          totalAmount: po.totalAmount,
          depositAmount: po.depositAmount,
          remainingBalance: po.remainingBalance,
          paymentStatus: po.paymentStatus,
          paymentLink: po.paymentLink,
          finalPaymentDate: po.finalPaymentDate,
          currency: po.currency,
        },
      });
      preorderSynced++;
    }
    console.log(`  ✓ Synced ${preorderSynced}/${localPreorderRecords.length} PreorderRecords to ${targetName}.`);

    // 7. Replicate ProductCache
    console.log('\n[7/7] Syncing ProductCache table...');
    const localProducts = await localPrisma.productCache.findMany();
    let prodSynced = 0;
    for (const prod of localProducts) {
      const storeExists = await neonPrisma.store.findUnique({ where: { id: prod.storeId } });
      if (!storeExists) continue;

      await neonPrisma.productCache.upsert({
        where: {
          storeId_shopifyVariantId: {
            storeId: prod.storeId,
            shopifyVariantId: prod.shopifyVariantId,
          },
        },
        create: {
          id: prod.id,
          storeId: prod.storeId,
          shopifyProductId: prod.shopifyProductId,
          shopifyVariantId: prod.shopifyVariantId,
          sku: prod.sku,
          title: prod.title,
          tags: prod.tags,
          imageUrl: prod.imageUrl,
          price: prod.price,
          basePrice: prod.basePrice,
          inventoryQuantity: prod.inventoryQuantity,
          optionsJson: prod.optionsJson as any,
        },
        update: {
          shopifyProductId: prod.shopifyProductId,
          sku: prod.sku,
          title: prod.title,
          tags: prod.tags,
          imageUrl: prod.imageUrl,
          price: prod.price,
          basePrice: prod.basePrice,
          inventoryQuantity: prod.inventoryQuantity,
          optionsJson: prod.optionsJson as any,
        },
      });
      prodSynced++;
    }
    console.log(`  ✓ Synced ${prodSynced}/${localProducts.length} ProductCaches to ${targetName}.`);

    console.log(`✓ Replication to ${targetName} completed successfully!`);
  } finally {
    await neonPrisma.$disconnect();
  }
}

async function main() {
  const arg = (process.argv[2] || process.env.NEON_TARGET || 'all').toLowerCase();
  const customUrl = process.env.REMOTE_NEON_URL || process.env.NEON_DATABASE_URL;

  try {
    if (customUrl) {
      await syncTarget('Custom Neon DB', customUrl);
    } else if (arg === 'aws') {
      await syncTarget('AWS Amplify Neon DB', AWS_NEON_URL);
    } else if (arg === 'vercel') {
      await syncTarget('Vercel Neon DB', VERCEL_NEON_URL);
    } else {
      // Replicate to both AWS Amplify and Vercel
      await syncTarget('Vercel Neon DB', VERCEL_NEON_URL);
      await syncTarget('AWS Amplify Neon DB', AWS_NEON_URL);
    }

    console.log('\n=====================================================');
    console.log('🎉 ALL REQUESTED NEON DB REPLICATIONS COMPLETED!');
    console.log('=====================================================');
  } catch (err: any) {
    console.error('\n❌ Fatal error during replication:', err);
    process.exit(1);
  } finally {
    await (localPrisma as any).$disconnect?.();
  }
}

main();
