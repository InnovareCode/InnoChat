-- Central de notificações. 100% aditiva e segura com o código antigo rodando: só colunas nulas,
-- tabela nova e índices; nada é alterado ou removido.

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN "notificationsReadAllAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "whatsapp_instances" ADD COLUMN "disconnectedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "appointment_events" ADD COLUMN "tenantId" TEXT;

-- Backfill dos eventos existentes.
UPDATE "appointment_events" e SET "tenantId" = a."tenantId"
FROM "appointments" a WHERE a."id" = e."appointmentId" AND e."tenantId" IS NULL;

-- Trigger: todo INSERT de evento (painel, API do bot, código antigo durante o deploy) recebe o
-- tenantId do agendamento sem depender da aplicação.
CREATE OR REPLACE FUNCTION appointment_event_fill_tenant() RETURNS trigger AS $$
BEGIN
  IF NEW."tenantId" IS NULL THEN
    SELECT a."tenantId" INTO NEW."tenantId" FROM "appointments" a WHERE a."id" = NEW."appointmentId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointment_events_fill_tenant ON "appointment_events";
CREATE TRIGGER appointment_events_fill_tenant
  BEFORE INSERT ON "appointment_events"
  FOR EACH ROW EXECUTE FUNCTION appointment_event_fill_tenant();

-- CreateIndex
CREATE INDEX "appointment_events_tenantId_createdAt_idx" ON "appointment_events"("tenantId", "createdAt");

-- CreateTable
CREATE TABLE "notification_reads" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "notificationKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_reads_membershipId_notificationKey_key" ON "notification_reads"("membershipId", "notificationKey");

-- CreateIndex
CREATE INDEX "notification_reads_readAt_idx" ON "notification_reads"("readAt");

-- AddForeignKey
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
