-- AlterTable: Add form config fields to users table
ALTER TABLE "users" ADD COLUMN "formDefaults" TEXT;
ALTER TABLE "users" ADD COLUMN "landingPage" TEXT;
