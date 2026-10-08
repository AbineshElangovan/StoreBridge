-- AlterTable
ALTER TABLE "notification_jobs" ALTER COLUMN "registrationId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "preorder_records" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'UNFULFILLED',
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preorder_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "preorder_records_storeId_idx" ON "preorder_records"("storeId");

-- CreateIndex
CREATE INDEX "preorder_records_shopifyVariantId_idx" ON "preorder_records"("shopifyVariantId");

-- CreateIndex
CREATE INDEX "preorder_records_status_idx" ON "preorder_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "preorder_records_storeId_shopifyOrderId_shopifyVariantId_key" ON "preorder_records"("storeId", "shopifyOrderId", "shopifyVariantId");

-- AddForeignKey
ALTER TABLE "preorder_records" ADD CONSTRAINT "preorder_records_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
