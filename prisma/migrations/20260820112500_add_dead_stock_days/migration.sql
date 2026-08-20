-- AlterTable
ALTER TABLE "stores" ADD COLUMN "deadStockDays" INTEGER;

-- Update existing records with default initial value
UPDATE "stores" SET "deadStockDays" = 90 WHERE "deadStockDays" IS NULL;

-- Enforce NOT NULL constraint
ALTER TABLE "stores" ALTER COLUMN "deadStockDays" SET NOT NULL;
