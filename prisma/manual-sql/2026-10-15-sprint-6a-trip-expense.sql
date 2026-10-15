-- Sprint 6a (2026-10-15): a shopping trip records who shares it and the grocery
-- expense it created. Applied on production by hand.
\set ON_ERROR_STOP on
BEGIN;
SET ROLE apptmasters;

ALTER TABLE "ShoppingTrip" ADD COLUMN "splitWith" TEXT;
ALTER TABLE "ShoppingTrip" ADD COLUMN "expenseId" TEXT;
CREATE UNIQUE INDEX "ShoppingTrip_expenseId_key" ON "ShoppingTrip"("expenseId");
ALTER TABLE "ShoppingTrip" ADD CONSTRAINT "ShoppingTrip_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
