-- Existing credentials and roles are deliberately preserved.
ALTER TABLE "Account" ADD COLUMN "emailVerifiedAt" TIMESTAMPTZ(3);

CREATE TABLE "PendingRegistration" (
  "id" UUID NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "otpHash" VARCHAR(64) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMPTZ(3) NOT NULL,
  "sendCount" INTEGER NOT NULL DEFAULT 1,
  "windowStart" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "PendingRegistration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PendingRegistration_college_email" CHECK ("email" = lower(trim("email")) AND "email" LIKE '%@coeptech.ac.in'),
  CONSTRAINT "PendingRegistration_attempts_valid" CHECK ("attempts" BETWEEN 0 AND 5),
  CONSTRAINT "PendingRegistration_send_count_valid" CHECK ("sendCount" BETWEEN 1 AND 5)
);
CREATE UNIQUE INDEX "PendingRegistration_email_key" ON "PendingRegistration"("email");
CREATE INDEX "PendingRegistration_expiresAt_idx" ON "PendingRegistration"("expiresAt");
