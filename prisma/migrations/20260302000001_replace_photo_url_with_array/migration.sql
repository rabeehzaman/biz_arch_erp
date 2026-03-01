-- Replace single photoUrl with photoUrls array
ALTER TABLE "mobile_devices" DROP COLUMN IF EXISTS "photoUrl";
ALTER TABLE "mobile_devices" ADD COLUMN "photoUrls" TEXT[] NOT NULL DEFAULT '{}';
