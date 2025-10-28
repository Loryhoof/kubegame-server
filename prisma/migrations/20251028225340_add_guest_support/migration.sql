/*
  Warnings:

  - A unique constraint covering the columns `[deviceHash]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deviceHash" TEXT,
ADD COLUMN     "isGuest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "provider" SET DEFAULT 'guest',
ALTER COLUMN "providerId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_deviceHash_key" ON "User"("deviceHash");
