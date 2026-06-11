-- CreateTable
CREATE TABLE "ExpenseEditRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "proposedTitle" TEXT,
    "proposedAmount" REAL,
    "proposedCategory" TEXT,
    "proposedNotes" TEXT,
    "originalTitle" TEXT NOT NULL,
    "originalAmount" REAL NOT NULL,
    "originalCategory" TEXT NOT NULL,
    "originalNotes" TEXT,
    "requiredApprovals" INTEGER NOT NULL,
    "appliedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expenseId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    CONSTRAINT "ExpenseEditRequest_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExpenseEditRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExpenseEditRequest_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExpenseEditApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    CONSTRAINT "ExpenseEditApproval_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ExpenseEditRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExpenseEditApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseEditApproval_requestId_approverId_key" ON "ExpenseEditApproval"("requestId", "approverId");
