-- Sprint 3b (2026-10-09): "Can't clean this week?" swap requests. Applied on production by hand.
\set ON_ERROR_STOP on
BEGIN;
SET ROLE apptmasters;

-- CreateTable
CREATE TABLE "CleaningSwapRequest" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "apartmentId" TEXT NOT NULL,
    "rotationId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,

    CONSTRAINT "CleaningSwapRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CleaningSwapRequest_rotationId_status_idx" ON "CleaningSwapRequest"("rotationId", "status");

-- AddForeignKey
ALTER TABLE "CleaningSwapRequest" ADD CONSTRAINT "CleaningSwapRequest_rotationId_fkey" FOREIGN KEY ("rotationId") REFERENCES "CleaningRotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningSwapRequest" ADD CONSTRAINT "CleaningSwapRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningSwapRequest" ADD CONSTRAINT "CleaningSwapRequest_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
