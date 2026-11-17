-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('in_stock', 'with_patient', 'maintenance', 'out_of_stock');

-- CreateEnum
CREATE TYPE "DeviceStage" AS ENUM ('doctor_review', 'research_review', 'decisions_review', 'awaiting_stock', 'awaiting_delivery', 'with_patient', 'returned', 'cancelled');

-- AlterEnum
ALTER TYPE "TicketType" ADD VALUE 'device_request';

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "internalPacking" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'in_stock',
    "notes" TEXT,
    "currentTicketId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceEvent" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "DeviceStatus",
    "toStatus" "DeviceStatus",
    "ticketId" TEXT,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceRequest" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "stage" "DeviceStage" NOT NULL DEFAULT 'doctor_review',
    "religion" TEXT,
    "governorate" TEXT,
    "city" TEXT,
    "area" TEXT,
    "address" TEXT,
    "nursingVisit" BOOLEAN NOT NULL DEFAULT false,
    "nursingFrequency" TEXT,
    "socialDecision" TEXT,
    "socialDecisionEnd" TIMESTAMP(3),
    "socialEndNotifiedAt" TIMESTAMP(3),
    "hasContribution" BOOLEAN NOT NULL DEFAULT false,
    "contributionType" TEXT,
    "contributionAmount" DOUBLE PRECISION,
    "deviceId" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_serial_key" ON "Device"("serial");

-- CreateIndex
CREATE INDEX "Device_type_status_idx" ON "Device"("type", "status");

-- CreateIndex
CREATE INDEX "DeviceEvent_deviceId_createdAt_idx" ON "DeviceEvent"("deviceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceRequest_ticketId_key" ON "DeviceRequest"("ticketId");

-- CreateIndex
CREATE INDEX "DeviceRequest_stage_deviceType_idx" ON "DeviceRequest"("stage", "deviceType");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_currentTicketId_fkey" FOREIGN KEY ("currentTicketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceEvent" ADD CONSTRAINT "DeviceEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceEvent" ADD CONSTRAINT "DeviceEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceEvent" ADD CONSTRAINT "DeviceEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceRequest" ADD CONSTRAINT "DeviceRequest_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
