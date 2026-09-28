-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accessToken" TEXT;

-- CreateTable
CREATE TABLE "BotAction" (
    "id" TEXT NOT NULL,
    "githubEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotAction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BotAction" ADD CONSTRAINT "BotAction_githubEventId_fkey" FOREIGN KEY ("githubEventId") REFERENCES "GithubEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
