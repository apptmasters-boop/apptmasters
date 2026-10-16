-- Sprint 12 (2026-10-16): Find a Home. The listing details the search filters
-- need (docs/MARKETPLACE_FLOW.md §4–§5, owner's OK 2026-10-16), all empty for
-- existing listings ("not stated"), and saved listings. Nothing existing
-- changes. Applied on production by hand.
\set ON_ERROR_STOP on
BEGIN;
SET ROLE apptmasters;

ALTER TABLE "Listing" ADD COLUMN     "accessible" BOOLEAN,
ADD COLUMN     "applicationFee" DOUBLE PRECISION,
ADD COLUMN     "brokerFee" DOUBLE PRECISION,
ADD COLUMN     "elevator" BOOLEAN,
ADD COLUMN     "furnished" BOOLEAN,
ADD COLUMN     "internetIncluded" BOOLEAN,
ADD COLUMN     "laundry" TEXT,
ADD COLUMN     "leaseMonths" INTEGER,
ADD COLUMN     "maxOccupants" INTEGER,
ADD COLUMN     "neighborhood" TEXT,
ADD COLUMN     "parking" BOOLEAN,
ADD COLUMN     "petsAllowed" BOOLEAN,
ADD COLUMN     "privateBathroom" BOOLEAN,
ADD COLUMN     "propertyType" TEXT,
ADD COLUMN     "roomType" TEXT,
ADD COLUMN     "smokingAllowed" BOOLEAN,
ADD COLUMN     "utilitiesIncluded" BOOLEAN,
ADD COLUMN     "zipCode" TEXT;

CREATE TABLE "SavedListing" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,

    CONSTRAINT "SavedListing_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SavedListing_userId_listingId_key" ON "SavedListing"("userId", "listingId");
ALTER TABLE "SavedListing" ADD CONSTRAINT "SavedListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedListing" ADD CONSTRAINT "SavedListing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
