-- CreateEnum
CREATE TYPE "NotifyMeStatus" AS ENUM ('PENDING', 'NOTIFIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "preorder_configs" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopifyProductId" TEXT,
    "shopifyVariantId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "inventoryThreshold" INTEGER NOT NULL DEFAULT 0,
    "maxQuantity" INTEGER,
    "customerMessage" TEXT NOT NULL DEFAULT 'Pre-order before it''s gone.',
    "shippingMessage" TEXT NOT NULL DEFAULT 'Shipping: As soon as possible',
    "fulfillmentMessage" TEXT NOT NULL DEFAULT 'We will fulfill the item as soon as it becomes available',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preorder_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notify_me_settings" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyWhatsApp" BOOLEAN NOT NULL DEFAULT true,
    "popupMessage" TEXT NOT NULL DEFAULT 'Get notified when this item is back in stock.',
    "buttonText" TEXT NOT NULL DEFAULT 'Notify me when available',
    "successMessage" TEXT NOT NULL DEFAULT 'You''re on the list!',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notify_me_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notify_me_registrations" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerWhatsApp" TEXT,
    "requestedQuantity" INTEGER NOT NULL DEFAULT 1,
    "notifyByEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyByWhatsApp" BOOLEAN NOT NULL DEFAULT false,
    "status" "NotifyMeStatus" NOT NULL DEFAULT 'PENDING',
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notify_me_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_jobs" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerWhatsApp" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "productTitle" TEXT NOT NULL,
    "variantTitle" TEXT,
    "imageUrl" TEXT,
    "productUrl" TEXT,
    "status" "NotificationJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "preorder_configs_storeId_idx" ON "preorder_configs"("storeId");

-- CreateIndex
CREATE INDEX "preorder_configs_shopifyProductId_idx" ON "preorder_configs"("shopifyProductId");

-- CreateIndex
CREATE INDEX "preorder_configs_shopifyVariantId_idx" ON "preorder_configs"("shopifyVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "preorder_configs_storeId_shopifyProductId_shopifyVariantId_key" ON "preorder_configs"("storeId", "shopifyProductId", "shopifyVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "notify_me_settings_storeId_key" ON "notify_me_settings"("storeId");

-- CreateIndex
CREATE INDEX "notify_me_registrations_storeId_idx" ON "notify_me_registrations"("storeId");

-- CreateIndex
CREATE INDEX "notify_me_registrations_shopifyProductId_idx" ON "notify_me_registrations"("shopifyProductId");

-- CreateIndex
CREATE INDEX "notify_me_registrations_shopifyVariantId_idx" ON "notify_me_registrations"("shopifyVariantId");

-- CreateIndex
CREATE INDEX "notify_me_registrations_status_idx" ON "notify_me_registrations"("status");

-- CreateIndex
CREATE INDEX "notify_me_registrations_storeId_shopifyVariantId_customerEm_idx" ON "notify_me_registrations"("storeId", "shopifyVariantId", "customerEmail");

-- CreateIndex
CREATE INDEX "notification_jobs_storeId_idx" ON "notification_jobs"("storeId");

-- CreateIndex
CREATE INDEX "notification_jobs_registrationId_idx" ON "notification_jobs"("registrationId");

-- CreateIndex
CREATE INDEX "notification_jobs_status_idx" ON "notification_jobs"("status");

-- CreateIndex
CREATE INDEX "notification_jobs_shopifyVariantId_idx" ON "notification_jobs"("shopifyVariantId");

-- AddForeignKey
ALTER TABLE "preorder_configs" ADD CONSTRAINT "preorder_configs_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notify_me_settings" ADD CONSTRAINT "notify_me_settings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notify_me_registrations" ADD CONSTRAINT "notify_me_registrations_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "notify_me_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
