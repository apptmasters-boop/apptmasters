-- CreateTable
CREATE TABLE "FeedItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isAnnouncement" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "apartmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "FeedItem_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeedReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emoji" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feedItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "FeedReaction_feedItemId_fkey" FOREIGN KEY ("feedItemId") REFERENCES "FeedItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeedReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuleVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vote" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "houseRuleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "RuleVote_houseRuleId_fkey" FOREIGN KEY ("houseRuleId") REFERENCES "HouseRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RuleVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'EVENT',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "apartmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "CalendarEvent_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SharedAgreement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "apartmentId" TEXT NOT NULL,
    CONSTRAINT "SharedAgreement_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HouseRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" DATETIME,
    "proposedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "votingEndsAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "apartmentId" TEXT NOT NULL,
    CONSTRAINT "HouseRule_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_HouseRule" ("apartmentId", "archivedAt", "content", "createdAt", "id", "version") SELECT "apartmentId", "archivedAt", "content", "createdAt", "id", "version" FROM "HouseRule";
DROP TABLE "HouseRule";
ALTER TABLE "new_HouseRule" RENAME TO "HouseRule";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "FeedReaction_feedItemId_userId_key" ON "FeedReaction"("feedItemId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RuleVote_houseRuleId_userId_key" ON "RuleVote"("houseRuleId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedAgreement_apartmentId_key_key" ON "SharedAgreement"("apartmentId", "key");
