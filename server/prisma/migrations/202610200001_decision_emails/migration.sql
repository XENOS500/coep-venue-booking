CREATE TABLE "DecisionEmail" (
  "id" UUID NOT NULL,
  "actionId" UUID NOT NULL,
  "recipient" VARCHAR(254) NOT NULL,
  "subject" VARCHAR(200) NOT NULL,
  "body" TEXT NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMPTZ(3),
  "sentAt" TIMESTAMPTZ(3),
  "lastErrorCode" VARCHAR(64),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DecisionEmail_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DecisionEmail_status_check" CHECK ("status" IN ('PENDING', 'SENDING', 'SENT', 'FAILED')),
  CONSTRAINT "DecisionEmail_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "DecisionEmail_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "BookingAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DecisionEmail_actionId_key" ON "DecisionEmail"("actionId");
CREATE INDEX "DecisionEmail_status_nextAttemptAt_idx" ON "DecisionEmail"("status", "nextAttemptAt");
