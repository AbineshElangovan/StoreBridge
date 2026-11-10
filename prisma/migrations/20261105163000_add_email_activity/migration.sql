-- CreateEnum
CREATE TYPE "EmailActivityStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED');

-- CreateTable
CREATE TABLE "email_activities" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT,
    "storeId" TEXT,
    "shopDomain" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "emailType" TEXT NOT NULL DEFAULT 'NOTIFICATION',
    "relatedEntityId" TEXT,
    "relatedEntityType" TEXT,
    "status" "EmailActivityStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_activities_storeId_idx" ON "email_activities"("storeId");

-- CreateIndex
CREATE INDEX "email_activities_merchantId_idx" ON "email_activities"("merchantId");

-- CreateIndex
CREATE INDEX "email_activities_shopDomain_idx" ON "email_activities"("shopDomain");

-- CreateIndex
CREATE INDEX "email_activities_emailType_idx" ON "email_activities"("emailType");

-- CreateIndex
CREATE INDEX "email_activities_status_idx" ON "email_activities"("status");

-- CreateIndex
CREATE INDEX "email_activities_providerMessageId_idx" ON "email_activities"("providerMessageId");

-- CreateIndex
CREATE INDEX "email_activities_createdAt_idx" ON "email_activities"("createdAt");

-- AddForeignKey
ALTER TABLE "email_activities" ADD CONSTRAINT "email_activities_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

