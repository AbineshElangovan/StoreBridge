-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('SHOPIFY_USER', 'WEBHOOK', 'SYSTEM', 'UNKNOWN');

-- CreateTable
CREATE TABLE "user_activities" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "merchantId" TEXT,
    "storeId" TEXT,
    "shopDomain" TEXT NOT NULL,
    "userId" TEXT,
    "userType" TEXT DEFAULT 'UNKNOWN',
    "actorType" "ActorType" NOT NULL DEFAULT 'UNKNOWN',
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_activities_idempotencyKey_key" ON "user_activities"("idempotencyKey");

-- CreateIndex
CREATE INDEX "user_activities_storeId_idx" ON "user_activities"("storeId");

-- CreateIndex
CREATE INDEX "user_activities_merchantId_idx" ON "user_activities"("merchantId");

-- CreateIndex
CREATE INDEX "user_activities_userId_idx" ON "user_activities"("userId");

-- CreateIndex
CREATE INDEX "user_activities_action_idx" ON "user_activities"("action");

-- CreateIndex
CREATE INDEX "user_activities_createdAt_idx" ON "user_activities"("createdAt");

-- CreateIndex
CREATE INDEX "user_activities_shopDomain_idx" ON "user_activities"("shopDomain");

-- AddForeignKey
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

