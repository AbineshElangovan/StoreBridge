-- AlterTable
ALTER TABLE "webhook_queue" ADD COLUMN     "eventId" TEXT;

-- CreateIndex
CREATE INDEX "webhook_queue_eventId_idx" ON "webhook_queue"("eventId");
