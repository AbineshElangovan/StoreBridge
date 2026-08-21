-- AlterTable
ALTER TABLE "stores" ALTER COLUMN "forecastPeriodDays" SET DEFAULT 7,
ALTER COLUMN "salesHistoryPeriodDays" SET DEFAULT 30,
ALTER COLUMN "supplierLeadTimeDays" SET DEFAULT 7,
ALTER COLUMN "safetyStockDays" SET DEFAULT 3;
