-- Sprint 4a round 2 (2026-10-09): inventory step, total and receipt on each trip.
-- Applied on production by hand.
\set ON_ERROR_STOP on
BEGIN;
SET ROLE apptmasters;
ALTER TABLE "ShoppingTrip" ADD COLUMN "homeCheck" TEXT, ADD COLUMN "totalAmount" DOUBLE PRECISION, ADD COLUMN "receiptUrl" TEXT, ADD COLUMN "checkedOutAt" TIMESTAMP(3);
COMMIT;
