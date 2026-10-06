ALTER TABLE "ContentRequest" ADD COLUMN "fulfilledMediaId" TEXT, ADD COLUMN "completedAt" TIMESTAMP(3);
CREATE INDEX "ContentRequest_fulfilledMediaId_userId_status_idx" ON "ContentRequest"("fulfilledMediaId","userId","status");
