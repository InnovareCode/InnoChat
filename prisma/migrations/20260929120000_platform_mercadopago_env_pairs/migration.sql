-- CreateEnum
CREATE TYPE "MercadoPagoEnvironment" AS ENUM ('PRODUCTION', 'SANDBOX');

-- AlterTable (aditiva: nenhuma coluna existente é alterada ou removida)
ALTER TABLE "platform_settings" ADD COLUMN     "mpEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mpEnvironment" "MercadoPagoEnvironment" NOT NULL DEFAULT 'PRODUCTION',
ADD COLUMN     "mpProdAccessTokenEnc" TEXT,
ADD COLUMN     "mpProdPublicKey" TEXT,
ADD COLUMN     "mpProdWebhookSecretEnc" TEXT,
ADD COLUMN     "mpTestAccessTokenEnc" TEXT,
ADD COLUMN     "mpTestPublicKey" TEXT,
ADD COLUMN     "mpTestWebhookSecretEnc" TEXT;
