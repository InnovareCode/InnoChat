-- Rollback manual da fase 2 (Prisma nao roda DOWN). Destrutivo: apaga historico e leituras.
DROP TABLE IF EXISTS "platform_notification_reads";
DROP TABLE IF EXISTS "chat_messages";
DROP TYPE IF EXISTS "ChatDirection";
DROP INDEX IF EXISTS "appointments_status_reminderSentAt_startsAt_idx";
ALTER TABLE "appointments" DROP COLUMN IF EXISTS "reminderSentAt";
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "reminderEnabled", DROP COLUMN IF EXISTS "reminderHoursBefore";
ALTER TABLE "users" DROP COLUMN IF EXISTS "name", DROP COLUMN IF EXISTS "platformNotificationsReadAllAt";
-- BotTextKey.REMINDER: Postgres nao remove valor de enum; e inofensivo deixar (apagar antes as linhas
-- bot_texts com key = 'REMINDER' se quiser recriar o tipo).
