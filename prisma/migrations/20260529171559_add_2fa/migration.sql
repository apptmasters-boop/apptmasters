-- CreateTable
CREATE TABLE "TwoFactorCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "TwoFactorCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "photo" TEXT,
    "roomAssignment" TEXT,
    "moveInDate" DATETIME,
    "dietaryFlags" TEXT NOT NULL DEFAULT '[]',
    "systemRole" TEXT NOT NULL DEFAULT 'USER',
    "notifPrefs" TEXT NOT NULL DEFAULT '{}',
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "dietaryFlags", "email", "id", "moveInDate", "name", "notifPrefs", "password", "photo", "roomAssignment", "systemRole", "updatedAt") SELECT "createdAt", "dietaryFlags", "email", "id", "moveInDate", "name", "notifPrefs", "password", "photo", "roomAssignment", "systemRole", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
