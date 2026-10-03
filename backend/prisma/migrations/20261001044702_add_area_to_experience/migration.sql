-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Experience" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT NOT NULL DEFAULT '',
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Experience" ("category", "city", "description", "durationMinutes", "id", "isAvailable", "latitude", "longitude", "price", "title") SELECT "category", "city", "description", "durationMinutes", "id", "isAvailable", "latitude", "longitude", "price", "title" FROM "Experience";
DROP TABLE "Experience";
ALTER TABLE "new_Experience" RENAME TO "Experience";
PRAGMA foreign_key_check("Experience");
PRAGMA foreign_keys=ON;
