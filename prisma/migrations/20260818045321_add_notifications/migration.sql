-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LOW_STOCK', 'CONNECTED_STORE_UPDATE', 'INVENTORY_UPDATE', 'PRICE_UPDATE', 'SYNC_UPDATE', 'SYNC_FAILURE');

-- AlterTable
ALTER TABLE "store_settings" ADD COLUMN     "notifyInventoryUpdate" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyLowStock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyPriceUpdate" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyStoreUpdate" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifySyncFailure" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifySyncUpdate" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "recipientStoreId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "productId" TEXT,
    "productTitle" TEXT,
    "sourceStoreId" TEXT,
    "targetStoreId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_recipientStoreId_idx" ON "notifications"("recipientStoreId");

-- CreateIndex
CREATE INDEX "notifications_recipientStoreId_isRead_idx" ON "notifications"("recipientStoreId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_recipientStoreId_createdAt_idx" ON "notifications"("recipientStoreId", "createdAt");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientStoreId_fkey" FOREIGN KEY ("recipientStoreId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
