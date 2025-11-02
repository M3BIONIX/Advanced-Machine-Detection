-- Drop existing unique index on Twilio call SID
DROP INDEX IF EXISTS "Call_twilioCallSid_key";

-- Add new callSid column and backfill from existing data
ALTER TABLE "Call" ADD COLUMN "callSid" TEXT;
UPDATE "Call" SET "callSid" = COALESCE("twilioCallSid", "id");
ALTER TABLE "Call" ALTER COLUMN "callSid" SET NOT NULL;
ALTER TABLE "Call" ADD CONSTRAINT "Call_callSid_key" UNIQUE ("callSid");

-- Remove deprecated Twilio SID column
ALTER TABLE "Call" DROP COLUMN IF EXISTS "twilioCallSid";

-- Add new metadata columns
ALTER TABLE "Call" ADD COLUMN "detectedAt" TIMESTAMP(3);
ALTER TABLE "Call" ADD COLUMN "cost" DOUBLE PRECISION;

-- Refresh indexes to match new query patterns
DROP INDEX IF EXISTS "Call_userId_createdAt_idx";
CREATE INDEX "Call_userId_idx" ON "Call"("userId");
CREATE INDEX "Call_status_idx" ON "Call"("status");
