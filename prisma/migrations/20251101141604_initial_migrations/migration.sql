-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toNumber" TEXT NOT NULL,
    "fromNumber" TEXT NOT NULL,
    "twilioCallSid" TEXT,
    "amdStrategy" TEXT NOT NULL,
    "amdResult" TEXT,
    "amdConfidence" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "duration" INTEGER,
    "callStartedAt" TIMESTAMP(3),
    "callEndedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "rawAmdPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmdEvent" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DOUBLE PRECISION,
    "metadata" JSONB,

    CONSTRAINT "AmdEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Call_twilioCallSid_key" ON "Call"("twilioCallSid");

-- CreateIndex
CREATE INDEX "Call_userId_createdAt_idx" ON "Call"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Call_amdStrategy_idx" ON "Call"("amdStrategy");

-- CreateIndex
CREATE INDEX "AmdEvent_callId_timestamp_idx" ON "AmdEvent"("callId", "timestamp");

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmdEvent" ADD CONSTRAINT "AmdEvent_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
