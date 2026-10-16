-- Sprint 11b (2026-10-16): Home Setup. One empty date on each membership: the
-- day the person moves in. Until then they count like someone away; empty
-- means living there already, so nothing existing changes. Applied on
-- production by hand.
\set ON_ERROR_STOP on
BEGIN;
SET ROLE apptmasters;

ALTER TABLE "ApartmentMember" ADD COLUMN "moveInDate" TIMESTAMP(3);

COMMIT;
