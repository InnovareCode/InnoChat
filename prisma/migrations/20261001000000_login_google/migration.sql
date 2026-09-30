-- Login com Google. Aditiva e compatível com o código antigo rodando durante o deploy:
-- colunas novas com default/nulas e DROP NOT NULL (o código antigo só escreve hash, nunca lê nulo).
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "googleSub" TEXT;
CREATE UNIQUE INDEX "users_googleSub_key" ON "users"("googleSub");

ALTER TABLE "platform_settings" ADD COLUMN "googleAuthEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "platform_settings" ADD COLUMN "googleClientId" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN "googleClientSecretEnc" TEXT;
