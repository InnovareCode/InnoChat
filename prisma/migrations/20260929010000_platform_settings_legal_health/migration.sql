-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN     "backupRetentionDays" INTEGER,
ADD COLUMN     "companyAddress" TEXT,
ADD COLUMN     "companyCnpj" TEXT,
ADD COLUMN     "companyLegalName" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "dpoEmail" TEXT,
ADD COLUMN     "dpoName" TEXT,
ADD COLUMN     "forumCity" TEXT,
ADD COLUMN     "hostingRegion" TEXT,
ADD COLUMN     "lastBillingTickAt" TIMESTAMP(3),
ADD COLUMN     "lastBillingTickResult" JSONB,
ADD COLUMN     "lastMaintenanceTickAt" TIMESTAMP(3),
ADD COLUMN     "lastMaintenanceTickResult" JSONB;
