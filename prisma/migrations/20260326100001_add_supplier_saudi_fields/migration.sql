-- AlterTable: Add Saudi-specific fields to suppliers table
ALTER TABLE "suppliers" ADD COLUMN "ccNo" TEXT;
ALTER TABLE "suppliers" ADD COLUMN "buildingNo" TEXT;
ALTER TABLE "suppliers" ADD COLUMN "addNo" TEXT;
ALTER TABLE "suppliers" ADD COLUMN "district" TEXT;
