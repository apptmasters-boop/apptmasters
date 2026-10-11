-- Sprint 4a (2026-10-09): one household shopping turn, shopping trips, items bought on a trip.
-- Applied on production by hand.
\set ON_ERROR_STOP on
BEGIN;
SET ROLE apptmasters;
ALTER TABLE "GroceryItem" ADD COLUMN "tripId" TEXT;
CREATE TABLE "ShoppingRotation" ("id" TEXT NOT NULL, "memberOrder" TEXT NOT NULL, "currentIndex" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "apartmentId" TEXT NOT NULL, CONSTRAINT "ShoppingRotation_pkey" PRIMARY KEY ("id"));
CREATE TABLE "ShoppingTrip" ("id" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PREPARING', "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "atStoreAt" TIMESTAMP(3), "leftStoreAt" TIMESTAMP(3), "endedAt" TIMESTAMP(3), "apartmentId" TEXT NOT NULL, "shopperId" TEXT NOT NULL, CONSTRAINT "ShoppingTrip_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ShoppingRotation_apartmentId_key" ON "ShoppingRotation"("apartmentId");
CREATE INDEX "ShoppingTrip_apartmentId_status_idx" ON "ShoppingTrip"("apartmentId", "status");
ALTER TABLE "GroceryItem" ADD CONSTRAINT "GroceryItem_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "ShoppingTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShoppingRotation" ADD CONSTRAINT "ShoppingRotation_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShoppingTrip" ADD CONSTRAINT "ShoppingTrip_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShoppingTrip" ADD CONSTRAINT "ShoppingTrip_shopperId_fkey" FOREIGN KEY ("shopperId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;
SELECT tablename, tableowner FROM pg_tables WHERE tablename IN ('ShoppingRotation','ShoppingTrip','GroceryItem');
