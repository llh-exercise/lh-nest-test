-- CreateTable
CREATE TABLE "types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT ''
);
