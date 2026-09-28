-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN     "n8nApiKey" TEXT,
ADD COLUMN     "n8nBaseUrl" TEXT,
ADD COLUMN     "n8nCredApiId" TEXT,
ADD COLUMN     "n8nCredEvolutionId" TEXT,
ADD COLUMN     "n8nCredPainelId" TEXT,
ADD COLUMN     "n8nWorkflowBotId" TEXT,
ADD COLUMN     "n8nWorkflowErrosId" TEXT,
ADD COLUMN     "publicBaseUrl" TEXT;

-- CreateTable
CREATE TABLE "platform_install_codes" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_install_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_install_codes_codeHash_key" ON "platform_install_codes"("codeHash");
