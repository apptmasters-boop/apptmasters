-- Sprint 1b (2026-10-08): "I found a place" date on User. Applied on production by hand.
\set ON_ERROR_STOP on
BEGIN;
SET ROLE apptmasters;
ALTER TABLE "User" ADD COLUMN "foundHomeAt" TIMESTAMP(3);
COMMIT;
