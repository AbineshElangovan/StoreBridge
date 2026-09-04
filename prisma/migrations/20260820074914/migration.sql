-- Create columns if not exists
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "forecastPeriodDays" INTEGER DEFAULT 7;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "salesHistoryPeriodDays" INTEGER DEFAULT 30;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "supplierLeadTimeDays" INTEGER DEFAULT 7;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "safetyStockDays" INTEGER DEFAULT 3;

-- Alter defaults
ALTER TABLE "stores" ALTER COLUMN "forecastPeriodDays" SET DEFAULT 7;
ALTER TABLE "stores" ALTER COLUMN "salesHistoryPeriodDays" SET DEFAULT 30;
ALTER TABLE "stores" ALTER COLUMN "supplierLeadTimeDays" SET DEFAULT 7;
ALTER TABLE "stores" ALTER COLUMN "safetyStockDays" SET DEFAULT 3;
