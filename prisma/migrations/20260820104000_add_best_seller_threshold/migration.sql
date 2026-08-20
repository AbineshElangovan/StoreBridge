-- AlterTable
ALTER TABLE "stores" ADD COLUMN "bestSellerThreshold" INTEGER;
UPDATE "stores" SET "bestSellerThreshold" = 20 WHERE "bestSellerThreshold" IS NULL;
ALTER TABLE "stores" ALTER COLUMN "bestSellerThreshold" SET NOT NULL;
