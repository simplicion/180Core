-- CreateTable
CREATE TABLE "VerificationSession" (
    "id" TEXT NOT NULL,
    "appId" TEXT,
    "clientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "environment" TEXT NOT NULL,
    "documents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "strictNameMatching" BOOLEAN NOT NULL DEFAULT true,
    "parentOrigin" TEXT,
    "redirectUri" TEXT,
    "tokenJti" TEXT NOT NULL,
    "steps" JSONB NOT NULL DEFAULT '{}',
    "docAttempts" JSONB NOT NULL DEFAULT '{}',
    "bankAttempts" INTEGER NOT NULL DEFAULT 0,
    "completeAttempts" INTEGER NOT NULL DEFAULT 0,
    "challengeId" TEXT,
    "challengeSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "challengeExpiresAt" TIMESTAMP(3),
    "challengeUsedAt" TIMESTAMP(3),
    "challengeCount" INTEGER NOT NULL DEFAULT 0,
    "verdict" JSONB,
    "failureCode" TEXT,
    "signedResult" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "resultFetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationAuditEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationSession_appId_createdAt_idx" ON "VerificationSession"("appId", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationSession_clientId_createdAt_idx" ON "VerificationSession"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationSession_status_expiresAt_idx" ON "VerificationSession"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "VerificationAuditEvent_sessionId_createdAt_idx" ON "VerificationAuditEvent"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "VerificationSession" ADD CONSTRAINT "VerificationSession_appId_fkey" FOREIGN KEY ("appId") REFERENCES "OAuthApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationAuditEvent" ADD CONSTRAINT "VerificationAuditEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VerificationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

