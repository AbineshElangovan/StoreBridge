-- CreateTable
CREATE TABLE "import_history" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "totalProducts" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL,
    "failedCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_history_storeId_idx" ON "import_history"("storeId");
CREATE INDEX "import_history_createdAt_idx" ON "import_history"("createdAt");

-- AddForeignKey
ALTER TABLE "import_history" ADD CONSTRAINT "import_history_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drift columns
ALTER TABLE "product_cache" ADD COLUMN IF NOT EXISTS "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "dataRetentionEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "stores" ALTER COLUMN "priceAdjustmentValue" SET DEFAULT 0;
ALTER TABLE "stores" ALTER COLUMN "priceAdjustmentValue" TYPE INTEGER USING "priceAdjustmentValue"::INTEGER;
