-- CreateTable
CREATE TABLE "GithubEvent" (
    "id" TEXT NOT NULL,
    "connectedRepoId" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "action" TEXT,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'received',
    "processedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "GithubEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GithubEvent_deliveryId_key" ON "GithubEvent"("deliveryId");

-- AddForeignKey
ALTER TABLE "GithubEvent" ADD CONSTRAINT "GithubEvent_connectedRepoId_fkey" FOREIGN KEY ("connectedRepoId") REFERENCES "ConnectedRepo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
