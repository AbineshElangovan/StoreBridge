-- AlterTable
ALTER TABLE "preorder_configs" ADD COLUMN     "selectedCollectionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "selectedProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "selectionMode" TEXT NOT NULL DEFAULT 'ALL_PRODUCTS';
