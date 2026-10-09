-- AlterTable
ALTER TABLE "notify_me_settings" ADD COLUMN     "emailSubject" TEXT DEFAULT 'Good news! {{product_title}} is back in stock',
ALTER COLUMN "buttonText" SET DEFAULT 'Notify me';
