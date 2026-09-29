-- Fase 2 (correcoes pre-deploy). Aditiva; NAO altera a 20260930400000.
-- 1) Empresas que ja existem no momento do deploy ficam com o lembrete DESLIGADO: o dono liga em
--    Configuracoes. O default da coluna continua true, entao empresas NOVAS nascem ligadas.
UPDATE "tenants" SET "reminderEnabled" = false;

-- 2) Indices do historico: purga por data (retencao de 90 dias) e cascade/deleteMany por contato.
CREATE INDEX "chat_messages_createdAt_idx" ON "chat_messages"("createdAt");
CREATE INDEX "chat_messages_contactId_idx" ON "chat_messages"("contactId");
