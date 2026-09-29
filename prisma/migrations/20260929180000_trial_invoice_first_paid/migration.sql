-- Aditiva e segura com o código antigo rodando: só colunas novas, nulas/com default; nada é
-- alterado ou removido. O código antigo ignora as colunas.

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "firstPaidAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "isTrialConversion" BOOLEAN NOT NULL DEFAULT false;

-- Backfill 1: primeiro pagamento = menor paidAt entre as faturas PAID da assinatura.
UPDATE "subscriptions" s
SET "firstPaidAt" = p.first_paid
FROM (
  SELECT "subscriptionId", MIN("paidAt") AS first_paid
  FROM "invoices"
  WHERE "status" = 'PAID' AND "paidAt" IS NOT NULL
  GROUP BY "subscriptionId"
) p
WHERE p."subscriptionId" = s."id" AND s."firstPaidAt" IS NULL;

-- Backfill 2: a fatura do cadastro é a primeira (menor periodStart) de cada assinatura.
-- Idempotente: pode ser reexecutado à mão depois do deploy para pegar cadastros feitos pelo
-- código antigo na janela entre a migration e o push (ver docs/runbook.md).
UPDATE "invoices" i
SET "isTrialConversion" = true
FROM (
  SELECT DISTINCT ON ("subscriptionId") "id"
  FROM "invoices"
  ORDER BY "subscriptionId", "periodStart" ASC
) f
WHERE f."id" = i."id" AND i."isTrialConversion" = false;
