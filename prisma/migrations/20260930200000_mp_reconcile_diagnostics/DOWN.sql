ALTER TABLE "platform_settings" DROP COLUMN "lastMpWebhookAt", DROP COLUMN "lastMpWebhookResult", DROP COLUMN "lastMpWebhookRejectedAt", DROP COLUMN "lastMpWebhookRejection";
ALTER TABLE "invoices" DROP COLUMN "mpEnvironment", DROP COLUMN "mpLastCheckedAt";
