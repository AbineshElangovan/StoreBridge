-- AlterTable
ALTER TABLE "preorder_configs" ADD COLUMN     "allowFullPayment" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowHalfPayment" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "defaultPaymentOption" TEXT NOT NULL DEFAULT 'HALF';

-- AlterTable
ALTER TABLE "preorder_records" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "finalPaymentDate" TIMESTAMP(3),
ADD COLUMN     "paymentLink" TEXT,
ADD COLUMN     "paymentOption" TEXT NOT NULL DEFAULT 'FULL',
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "productTitle" TEXT,
ADD COLUMN     "remainingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "variantTitle" TEXT;

-- CreateIndex
CREATE INDEX "preorder_records_paymentStatus_idx" ON "preorder_records"("paymentStatus");

-- CreateIndex
CREATE INDEX "preorder_records_paymentOption_idx" ON "preorder_records"("paymentOption");
