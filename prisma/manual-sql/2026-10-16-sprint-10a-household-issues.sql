-- Sprint 10a (2026-10-16): household issues replace disputes: a topic, a private
-- option, a proposed resolution, and a kind for each timeline entry. Existing
-- disputes carry over: dismissed become closed; open ones with replies are in
-- discussion. Applied on production by hand.
\set ON_ERROR_STOP on
BEGIN;
SET ROLE apptmasters;

ALTER TABLE "Dispute"
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "proposal" TEXT,
  ADD COLUMN "proposedById" TEXT,
  ADD COLUMN "proposedAt" TIMESTAMP(3);
ALTER TABLE "DisputeComment" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'COMMENT';

UPDATE "Dispute" SET "status" = 'CLOSED' WHERE "status" = 'DISMISSED';
UPDATE "Dispute" d SET "status" = 'DISCUSSION'
  WHERE d."status" = 'OPEN' AND EXISTS (SELECT 1 FROM "DisputeComment" c WHERE c."disputeId" = d."id");

COMMIT;
