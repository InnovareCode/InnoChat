-- Aditiva e segura com o código antigo rodando: só colunas novas, nulas; nada é alterado ou
-- removido. O código antigo ignora as colunas.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "onboardingTourCompletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "onboardingChecklistDismissedAt" TIMESTAMP(3);
