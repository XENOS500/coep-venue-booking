-- CreateEnum
CREATE TYPE "Role" AS ENUM ('REQUESTER', 'APPROVER', 'ADMIN');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" UUID NOT NULL,
    "sourceSerial" INTEGER,
    "name" VARCHAR(160) NOT NULL,
    "buildingName" VARCHAR(200),
    "floor" VARCHAR(160),
    "venueType" VARCHAR(160),
    "roomReferenceRaw" TEXT,
    "capacity" INTEGER,
    "features" TEXT,
    "allowedUses" TEXT,
    "imageSourceUrl" TEXT,
    "imageSourceLabel" TEXT,
    "imageUrl" TEXT,
    "sourceRaw" JSONB,
    "reviewNotes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "bookingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "openingTime" VARCHAR(5),
    "closingTime" VARCHAR(5),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueApprover" (
    "venueId" UUID NOT NULL,
    "approverId" UUID NOT NULL,
    "assignedBy" UUID NOT NULL,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueApprover_pkey" PRIMARY KEY ("venueId","approverId")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "eventTitle" VARCHAR(160) NOT NULL,
    "eventType" VARCHAR(80) NOT NULL,
    "contactName" VARCHAR(120) NOT NULL,
    "contactEmail" VARCHAR(254) NOT NULL,
    "contactPhone" VARCHAR(25) NOT NULL,
    "guestCount" INTEGER NOT NULL,
    "eventDetails" VARCHAR(2000) NOT NULL,
    "purpose" VARCHAR(500) NOT NULL,
    "startDate" VARCHAR(10) NOT NULL,
    "endDate" VARCHAR(10) NOT NULL,
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "localStartTime" VARCHAR(5) NOT NULL,
    "localEndTime" VARCHAR(5) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingOccurrence" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BookingOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingAction" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "entityType" VARCHAR(32) NOT NULL,
    "entityId" UUID NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Venue_sourceSerial_key" ON "Venue"("sourceSerial");

-- CreateIndex
CREATE INDEX "Venue_isActive_buildingName_venueType_idx" ON "Venue"("isActive", "buildingName", "venueType");

-- CreateIndex
CREATE INDEX "VenueApprover_approverId_idx" ON "VenueApprover"("approverId");

-- CreateIndex
CREATE INDEX "Booking_requesterId_status_createdAt_idx" ON "Booking"("requesterId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_venueId_status_idx" ON "Booking"("venueId", "status");

-- CreateIndex
CREATE INDEX "BookingOccurrence_venueId_startsAt_endsAt_idx" ON "BookingOccurrence"("venueId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "BookingOccurrence_bookingId_idx" ON "BookingOccurrence"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingOccurrence_bookingId_startsAt_key" ON "BookingOccurrence"("bookingId", "startsAt");

-- CreateIndex
CREATE INDEX "BookingAction_bookingId_createdAt_idx" ON "BookingAction"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "VenueApprover" ADD CONSTRAINT "VenueApprover_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueApprover" ADD CONSTRAINT "VenueApprover_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueApprover" ADD CONSTRAINT "VenueApprover_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "BookingOccurrence" ADD CONSTRAINT "BookingOccurrence_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAction" ADD CONSTRAINT "BookingAction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAction" ADD CONSTRAINT "BookingAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Business invariants that Prisma schema syntax cannot express.
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_capacity_positive" CHECK ("capacity" IS NULL OR "capacity" > 0);
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_hours_valid" CHECK (
  ("openingTime" IS NULL AND "closingTime" IS NULL) OR
  ("openingTime" IS NOT NULL AND "closingTime" IS NOT NULL AND
   "openingTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND
   "closingTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "closingTime" > "openingTime")
);
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_enabled_configuration" CHECK (
  NOT "bookingEnabled" OR ("capacity" IS NOT NULL AND "openingTime" IS NOT NULL AND "closingTime" IS NOT NULL)
);
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_guestCount_positive" CHECK ("guestCount" > 0);
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_schedule_order" CHECK ("endDate" >= "startDate" AND "localEndTime" > "localStartTime");
ALTER TABLE "BookingOccurrence" ADD CONSTRAINT "BookingOccurrence_end_after_start" CHECK ("endsAt" > "startsAt");
ALTER TABLE "Account" ADD CONSTRAINT "Account_email_normalized" CHECK ("email" = lower(trim("email")));

-- Enforce that the occurrence and its parent booking refer to the same venue.
CREATE UNIQUE INDEX "Booking_id_venueId_integrity" ON "Booking" ("id", "venueId");
ALTER TABLE "BookingOccurrence" ADD CONSTRAINT "BookingOccurrence_booking_venue_integrity"
  FOREIGN KEY ("bookingId", "venueId") REFERENCES "Booking" ("id", "venueId") ON DELETE RESTRICT ON UPDATE CASCADE;
