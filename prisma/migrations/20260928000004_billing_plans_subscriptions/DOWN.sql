-- Rollback manual (Prisma não roda DOWN automaticamente; ver 0002_appointment_exclude_no_overlap
-- para o mesmo procedimento). Ordem inversa de dependência: FKs → tabelas → enums.

ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_subscriptionId_fkey";
ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_pendingPlanId_fkey";
ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_planId_fkey";
ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_tenantId_fkey";
ALTER TABLE "trial_claims" DROP CONSTRAINT IF EXISTS "trial_claims_tenantId_fkey";

DROP TABLE IF EXISTS "invoices";
DROP TABLE IF EXISTS "subscriptions";
DROP TABLE IF EXISTS "plans";
DROP TABLE IF EXISTS "provider_events";
DROP TABLE IF EXISTS "trial_claims";

DROP TYPE IF EXISTS "InvoiceStatus";
DROP TYPE IF EXISTS "SubscriptionStatus";
