-- Fase 2: nome do usuario, lembrete de vespera, historico de conversas, notificacoes do admin.
-- 100% aditiva (colunas nulas/com default, tabelas novas, sem DROP/RENAME): compativel com o codigo anterior no ar durante o deploy.
-- ADD VALUE nao e USADO nesta migration (exigencia do Postgres dentro de transacao).
-- CreateEnum
CREATE TYPE "ChatDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- AlterEnum
ALTER TYPE "BotTextKey" ADD VALUE IF NOT EXISTS 'REMINDER';

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "reminderSentAt" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reminderHoursBefore" INTEGER NOT NULL DEFAULT 24;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "name" TEXT,
ADD COLUMN     "platformNotificationsReadAllAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "whatsappInstanceId" TEXT,
    "direction" "ChatDirection" NOT NULL,
    "body" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_notification_reads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_notification_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_messages_tenantId_contactId_createdAt_idx" ON "chat_messages"("tenantId", "contactId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_tenantId_providerMessageId_key" ON "chat_messages"("tenantId", "providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_notification_reads_userId_notificationKey_key" ON "platform_notification_reads"("userId", "notificationKey");

-- CreateIndex
CREATE INDEX "appointments_status_reminderSentAt_startsAt_idx" ON "appointments"("status", "reminderSentAt", "startsAt");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_whatsappInstanceId_fkey" FOREIGN KEY ("whatsappInstanceId") REFERENCES "whatsapp_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_notification_reads" ADD CONSTRAINT "platform_notification_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

