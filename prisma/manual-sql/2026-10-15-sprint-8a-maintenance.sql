-- Sprint 8a (2026-10-15): maintenance steps, where in the home, the repair visit, and a
-- timeline of updates. Requests that said "OPEN" become "REPORTED", with a first
-- timeline entry. Applied on production by hand.
\set ON_ERROR_STOP on
BEGIN;
SET ROLE apptmasters;

ALTER TABLE "MaintenanceRequest" ADD COLUMN "location" TEXT, ADD COLUMN "scheduledStart" TIMESTAMP(3), ADD COLUMN "scheduledEnd" TIMESTAMP(3), ADD COLUMN "calendarEventId" TEXT, ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "MaintenanceRequest" ALTER COLUMN "status" SET DEFAULT 'REPORTED';

-- CreateTable
CREATE TABLE "MaintenanceUpdate" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "byRole" TEXT NOT NULL,
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT NOT NULL,
    "byUserId" TEXT NOT NULL,

    CONSTRAINT "MaintenanceUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceUpdate_requestId_createdAt_idx" ON "MaintenanceUpdate"("requestId", "createdAt");

-- AddForeignKey
ALTER TABLE "MaintenanceUpdate" ADD CONSTRAINT "MaintenanceUpdate_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceUpdate" ADD CONSTRAINT "MaintenanceUpdate_byUserId_fkey" FOREIGN KEY ("byUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Existing requests: the new step names, and the report as the first timeline entry.
UPDATE "MaintenanceRequest" SET "status" = 'REPORTED' WHERE "status" = 'OPEN';
INSERT INTO "MaintenanceUpdate" ("id", "status", "byRole", "createdAt", "requestId", "byUserId")
  SELECT 'mu_' || gen_random_uuid(), 'REPORTED', 'RESIDENT', r."createdAt", r."id", r."submittedById" FROM "MaintenanceRequest" r;

COMMIT;
