-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- Enable TimescaleDB for measurement hypertables.
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('LINKED', 'OFFLINE', 'ERROR', 'DISABLED');

-- CreateEnum
CREATE TYPE "DiagnosticRequestStatus" AS ENUM ('CREATED', 'DISCOVERING_CAPABILITIES', 'PLANNED', 'QUEUED', 'DISPATCHED', 'RUNNING', 'GENERATING_REPORT', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DiagnosticRunStatus" AS ENUM ('QUEUED', 'SENT', 'RESPONDED', 'TIMEOUT', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "MeasurementStatus" AS ENUM ('OK', 'UNSUPPORTED', 'TIMEOUT', 'ERROR', 'MISSING');

-- CreateEnum
CREATE TYPE "ValueType" AS ENUM ('NUMBER', 'STRING', 'BOOLEAN', 'JSON');

-- CreateEnum
CREATE TYPE "DtcState" AS ENUM ('STORED', 'PENDING', 'PERMANENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mqttCarId" TEXT NOT NULL,
    "vin" TEXT,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "firmwareVersion" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'LINKED',
    "capabilitiesDiscoveredAt" TIMESTAMP(3),
    "capabilitiesResponseJson" JSONB,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticProfile" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultRequestedPidsJson" JSONB NOT NULL,
    "includeDtcsByDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObdPidCatalog" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "pidCode" TEXT NOT NULL,
    "fullCode" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT,
    "valueType" "ValueType" NOT NULL,
    "description" TEXT,
    "formula" TEXT,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObdPidCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleSupportedPid" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "pidCatalogId" TEXT NOT NULL,
    "isSupported" BOOLEAN NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleSupportedPid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "complaintText" TEXT NOT NULL,
    "debugConfigJson" JSONB,
    "classifiedProfileId" TEXT,
    "classificationConfidence" DOUBLE PRECISION,
    "classificationRationale" TEXT,
    "status" "DiagnosticRequestStatus" NOT NULL DEFAULT 'CREATED',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DiagnosticRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticPlan" (
    "id" TEXT NOT NULL,
    "diagnosticRequestId" TEXT NOT NULL,
    "profileId" TEXT,
    "requestedPidsJson" JSONB NOT NULL,
    "includeDtcs" BOOLEAN NOT NULL DEFAULT false,
    "plannerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticRun" (
    "id" TEXT NOT NULL,
    "diagnosticPlanId" TEXT NOT NULL,
    "deviceId" TEXT,
    "mqttJobId" TEXT,
    "status" "DiagnosticRunStatus" NOT NULL DEFAULT 'QUEUED',
    "mqttCommandJson" JSONB,
    "rawResponseJson" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticMeasurement" (
    "id" TEXT NOT NULL,
    "diagnosticRunId" TEXT NOT NULL,
    "pidCatalogId" TEXT,
    "measurementKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valueNumber" DOUBLE PRECISION,
    "valueText" TEXT,
    "valueBoolean" BOOLEAN,
    "valueJson" JSONB,
    "unit" TEXT,
    "status" "MeasurementStatus" NOT NULL DEFAULT 'OK',
    "rawValue" TEXT,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosticMeasurement_pkey" PRIMARY KEY ("id","measuredAt")
);

-- CreateTable
CREATE TABLE "DiagnosticDtc" (
    "id" TEXT NOT NULL,
    "diagnosticRunId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT,
    "state" "DtcState" NOT NULL,
    "sourceMode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosticDtc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticReport" (
    "id" TEXT NOT NULL,
    "diagnosticRequestId" TEXT NOT NULL,
    "diagnosticRunId" TEXT NOT NULL,
    "structuredSummaryJson" JSONB NOT NULL,
    "reportJson" JSONB NOT NULL,
    "reportText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_mqttCarId_key" ON "Vehicle"("mqttCarId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vin_key" ON "Vehicle"("vin");

-- CreateIndex
CREATE INDEX "Vehicle_userId_idx" ON "Vehicle"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_vehicleId_key" ON "Device"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_serialNumber_key" ON "Device"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticProfile_code_key" ON "DiagnosticProfile"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ObdPidCatalog_fullCode_key" ON "ObdPidCatalog"("fullCode");

-- CreateIndex
CREATE UNIQUE INDEX "ObdPidCatalog_key_key" ON "ObdPidCatalog"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ObdPidCatalog_mode_pidCode_key" ON "ObdPidCatalog"("mode", "pidCode");

-- CreateIndex
CREATE INDEX "VehicleSupportedPid_vehicleId_idx" ON "VehicleSupportedPid"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleSupportedPid_vehicleId_pidCatalogId_key" ON "VehicleSupportedPid"("vehicleId", "pidCatalogId");

-- CreateIndex
CREATE INDEX "DiagnosticRequest_userId_idx" ON "DiagnosticRequest"("userId");

-- CreateIndex
CREATE INDEX "DiagnosticRequest_vehicleId_idx" ON "DiagnosticRequest"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticPlan_diagnosticRequestId_key" ON "DiagnosticPlan"("diagnosticRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticRun_mqttJobId_key" ON "DiagnosticRun"("mqttJobId");

-- CreateIndex
CREATE INDEX "DiagnosticRun_diagnosticPlanId_idx" ON "DiagnosticRun"("diagnosticPlanId");

-- CreateIndex
CREATE INDEX "DiagnosticMeasurement_diagnosticRunId_idx" ON "DiagnosticMeasurement"("diagnosticRunId");

-- CreateIndex
CREATE INDEX "DiagnosticMeasurement_measurementKey_idx" ON "DiagnosticMeasurement"("measurementKey");

-- CreateIndex
CREATE INDEX "DiagnosticMeasurement_measuredAt_idx" ON "DiagnosticMeasurement"("measuredAt");

-- CreateIndex
CREATE INDEX "DiagnosticDtc_diagnosticRunId_idx" ON "DiagnosticDtc"("diagnosticRunId");

-- CreateIndex
CREATE INDEX "DiagnosticDtc_code_idx" ON "DiagnosticDtc"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticReport_diagnosticRequestId_key" ON "DiagnosticReport"("diagnosticRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticReport_diagnosticRunId_key" ON "DiagnosticReport"("diagnosticRunId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSupportedPid" ADD CONSTRAINT "VehicleSupportedPid_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSupportedPid" ADD CONSTRAINT "VehicleSupportedPid_pidCatalogId_fkey" FOREIGN KEY ("pidCatalogId") REFERENCES "ObdPidCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticRequest" ADD CONSTRAINT "DiagnosticRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticRequest" ADD CONSTRAINT "DiagnosticRequest_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticRequest" ADD CONSTRAINT "DiagnosticRequest_classifiedProfileId_fkey" FOREIGN KEY ("classifiedProfileId") REFERENCES "DiagnosticProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticPlan" ADD CONSTRAINT "DiagnosticPlan_diagnosticRequestId_fkey" FOREIGN KEY ("diagnosticRequestId") REFERENCES "DiagnosticRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticPlan" ADD CONSTRAINT "DiagnosticPlan_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DiagnosticProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticRun" ADD CONSTRAINT "DiagnosticRun_diagnosticPlanId_fkey" FOREIGN KEY ("diagnosticPlanId") REFERENCES "DiagnosticPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticRun" ADD CONSTRAINT "DiagnosticRun_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticMeasurement" ADD CONSTRAINT "DiagnosticMeasurement_diagnosticRunId_fkey" FOREIGN KEY ("diagnosticRunId") REFERENCES "DiagnosticRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticMeasurement" ADD CONSTRAINT "DiagnosticMeasurement_pidCatalogId_fkey" FOREIGN KEY ("pidCatalogId") REFERENCES "ObdPidCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticDtc" ADD CONSTRAINT "DiagnosticDtc_diagnosticRunId_fkey" FOREIGN KEY ("diagnosticRunId") REFERENCES "DiagnosticRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticReport" ADD CONSTRAINT "DiagnosticReport_diagnosticRequestId_fkey" FOREIGN KEY ("diagnosticRequestId") REFERENCES "DiagnosticRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticReport" ADD CONSTRAINT "DiagnosticReport_diagnosticRunId_fkey" FOREIGN KEY ("diagnosticRunId") REFERENCES "DiagnosticRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Convert the flexible measurement table into a Timescale hypertable.
SELECT create_hypertable('"DiagnosticMeasurement"', 'measuredAt', if_not_exists => TRUE);

