-- CreateTable
CREATE TABLE "TelegramLinkToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "telegramUserId" BIGINT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLinkToken_codeHash_key" ON "TelegramLinkToken"("codeHash");

-- CreateIndex
CREATE INDEX "TelegramLinkToken_userId_idx" ON "TelegramLinkToken"("userId");

-- CreateIndex
CREATE INDEX "NotificationLog_recipientId_idx" ON "NotificationLog"("recipientId");

-- CreateIndex
CREATE INDEX "NotificationLog_eventType_entityId_idx" ON "NotificationLog"("eventType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_eventType_entityId_recipientId_key" ON "NotificationLog"("eventType", "entityId", "recipientId");

-- AddForeignKey
ALTER TABLE "TelegramLinkToken" ADD CONSTRAINT "TelegramLinkToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
