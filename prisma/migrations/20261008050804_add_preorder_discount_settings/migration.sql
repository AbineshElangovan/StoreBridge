-- AlterTable
ALTER TABLE "preorder_configs" ADD COLUMN     "discountType" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0;
