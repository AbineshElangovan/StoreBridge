-- AlterTable
ALTER TABLE "stores" ADD COLUMN "forecastPeriodDays" INTEGER;
ALTER TABLE "stores" ADD COLUMN "salesHistoryPeriodDays" INTEGER;
ALTER TABLE "stores" ADD COLUMN "supplierLeadTimeDays" INTEGER;
ALTER TABLE "stores" ADD COLUMN "safetyStockDays" INTEGER;

-- Update existing records with default initial values
UPDATE "stores" SET "forecastPeriodDays" = 7 WHERE "forecastPeriodDays" IS NULL;
UPDATE "stores" SET "salesHistoryPeriodDays" = 30 WHERE "salesHistoryPeriodDays" IS NULL;
UPDATE "stores" SET "supplierLeadTimeDays" = 7 WHERE "supplierLeadTimeDays" IS NULL;
UPDATE "stores" SET "safetyStockDays" = 3 WHERE "safetyStockDays" IS NULL;

-- Enforce NOT NULL constraints
ALTER TABLE "stores" ALTER COLUMN "forecastPeriodDays" SET NOT NULL;
ALTER TABLE "stores" ALTER COLUMN "salesHistoryPeriodDays" SET NOT NULL;
ALTER TABLE "stores" ALTER COLUMN "supplierLeadTimeDays" SET NOT NULL;
ALTER TABLE "stores" ALTER COLUMN "safetyStockDays" SET NOT NULL;
