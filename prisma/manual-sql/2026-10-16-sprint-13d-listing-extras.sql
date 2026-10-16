-- Sprint 13d (2026-10-16): four more listing details shown in the owner's
-- pictures (docs/mockups/filters-mobile.jpg, listing-details-mobile.jpg):
-- air conditioning, heat included, dishwasher and the size in square feet.
-- All empty for existing listings ("not stated"). Nothing existing changes.
-- Owner's decision to add them: 2026-10-16. Applied on production by hand,
-- only after the owner's OK.
\set ON_ERROR_STOP on
BEGIN;
SET ROLE apptmasters;

ALTER TABLE "Listing" ADD COLUMN     "airConditioning" BOOLEAN,
ADD COLUMN     "dishwasher" BOOLEAN,
ADD COLUMN     "heatIncluded" BOOLEAN,
ADD COLUMN     "squareFeet" INTEGER;

COMMIT;
