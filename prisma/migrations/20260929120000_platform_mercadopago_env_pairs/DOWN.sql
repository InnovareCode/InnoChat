-- Reverte 20260929120000_platform_mercadopago_env_pairs (manual; o Prisma não roda DOWN).
-- ATENÇÃO: depois da migração preguiçosa, o token/segredo de produção vive em
-- mpProdAccessTokenEnc/mpProdWebhookSecretEnc (cifrados) e as colunas legadas ficam zeradas —
-- reverter apaga as credenciais; será preciso recadastrá-las.
ALTER TABLE "platform_settings" DROP COLUMN "mpEnabled",
DROP COLUMN "mpEnvironment",
DROP COLUMN "mpProdAccessTokenEnc",
DROP COLUMN "mpProdPublicKey",
DROP COLUMN "mpProdWebhookSecretEnc",
DROP COLUMN "mpTestAccessTokenEnc",
DROP COLUMN "mpTestPublicKey",
DROP COLUMN "mpTestWebhookSecretEnc";
DROP TYPE "MercadoPagoEnvironment";
