-- Step O1 (2026-10-18): "What brings you to ApptMasters?", asked right after
-- the email is confirmed (/welcome). One empty column on the users table:
-- FIND_HOME | HAVE_HOME | RENT_OUT, or empty for accounts that haven't answered
-- (every existing account). Nothing existing changes. See src/lib/intent.ts.
-- Applied on production by hand, after the owner's explicit yes (2026-10-18).
\set ON_ERROR_STOP on
BEGIN;
SET ROLE apptmasters;

ALTER TABLE "User" ADD COLUMN "intent" TEXT;

COMMIT;
