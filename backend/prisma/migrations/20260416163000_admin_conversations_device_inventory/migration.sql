-- AlterEnum
ALTER TYPE "DeviceStatus" ADD VALUE IF NOT EXISTS 'AVAILABLE';

-- CreateEnum
CREATE TYPE "ConversationMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ConversationMessageKind" AS ENUM (
    'INITIAL_PROMPT',
    'REPORT',
    'FOLLOW_UP_QUESTION',
    'FOLLOW_UP_ANSWER',
    'SYSTEM_NOTE'
);

-- AlterTable
ALTER TABLE "Device"
ADD COLUMN "deviceCode" TEXT;

UPDATE "Device"
SET "deviceCode" = "serialNumber"
WHERE "deviceCode" IS NULL;

ALTER TABLE "Device"
ALTER COLUMN "deviceCode" SET NOT NULL,
ALTER COLUMN "serialNumber" DROP NOT NULL,
ALTER COLUMN "vehicleId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DiagnosticConversation" (
    "id" TEXT NOT NULL,
    "diagnosticRequestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticConversationMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "ConversationMessageRole" NOT NULL,
    "kind" "ConversationMessageKind" NOT NULL,
    "content" TEXT NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosticConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceCode_key" ON "Device"("deviceCode");

-- CreateIndex
CREATE INDEX "Device_status_idx" ON "Device"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticConversation_diagnosticRequestId_key" ON "DiagnosticConversation"("diagnosticRequestId");

-- CreateIndex
CREATE INDEX "DiagnosticConversation_userId_idx" ON "DiagnosticConversation"("userId");

-- CreateIndex
CREATE INDEX "DiagnosticConversation_vehicleId_idx" ON "DiagnosticConversation"("vehicleId");

-- CreateIndex
CREATE INDEX "DiagnosticConversationMessage_conversationId_createdAt_idx" ON "DiagnosticConversationMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "DiagnosticConversation" ADD CONSTRAINT "DiagnosticConversation_diagnosticRequestId_fkey"
FOREIGN KEY ("diagnosticRequestId") REFERENCES "DiagnosticRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticConversation" ADD CONSTRAINT "DiagnosticConversation_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticConversation" ADD CONSTRAINT "DiagnosticConversation_vehicleId_fkey"
FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticConversationMessage" ADD CONSTRAINT "DiagnosticConversationMessage_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "DiagnosticConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- UpdateForeignKey
ALTER TABLE "Device" DROP CONSTRAINT "Device_vehicleId_fkey";

ALTER TABLE "Device" ADD CONSTRAINT "Device_vehicleId_fkey"
FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
