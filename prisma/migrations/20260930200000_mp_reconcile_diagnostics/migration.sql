-- Conciliação ativa de Pix + diagnóstico do webhook do Mercado Pago. 100% aditiva (só colunas
-- nulas): segura com o código antigo rodando durante o deploy.

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "mpEnvironment" "MercadoPagoEnvironment",
ADD COLUMN "mpLastCheckedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "platform_settings"
ADD COLUMN "lastMpWebhookAt" TIMESTAMP(3),
ADD COLUMN "lastMpWebhookResult" JSONB,
ADD COLUMN "lastMpWebhookRejectedAt" TIMESTAMP(3),
ADD COLUMN "lastMpWebhookRejection" JSONB;
