-- Sprint 8b (2026-10-15): "Is it fixed?" The resident's answer after a repair is marked
-- completed. Applied on production by hand.
\set ON_ERROR_STOP on
BEGIN;
SET ROLE apptmasters;

ALTER TABLE "MaintenanceRequest" ADD COLUMN "resolvedAt" TIMESTAMP(3), ADD COLUMN "residentFeedback" TEXT;

COMMIT;
