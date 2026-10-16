-- Sprint 11a (2026-10-16): "Have you found your new home?". Two empty dates on
-- each person: when the daily job last asked, and their last "I'm still
-- looking". Nothing existing changes. Applied on production by hand.
\set ON_ERROR_STOP on
BEGIN;
SET ROLE apptmasters;

ALTER TABLE "User"
  ADD COLUMN "homeAskedAt" TIMESTAMP(3),
  ADD COLUMN "stillLookingAt" TIMESTAMP(3);

COMMIT;
