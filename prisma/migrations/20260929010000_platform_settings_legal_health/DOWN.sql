-- Rollback manual (Prisma não roda isto automaticamente) — convenção do projeto desde
-- 0002_appointment_exclude_no_overlap.
ALTER TABLE "platform_settings" DROP COLUMN "backupRetentionDays",
DROP COLUMN "companyAddress",
DROP COLUMN "companyCnpj",
DROP COLUMN "companyLegalName",
DROP COLUMN "contactEmail",
DROP COLUMN "dpoEmail",
DROP COLUMN "dpoName",
DROP COLUMN "forumCity",
DROP COLUMN "hostingRegion",
DROP COLUMN "lastBillingTickAt",
DROP COLUMN "lastBillingTickResult",
DROP COLUMN "lastMaintenanceTickAt",
DROP COLUMN "lastMaintenanceTickResult";
