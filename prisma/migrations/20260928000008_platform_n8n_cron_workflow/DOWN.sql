-- Rollback manual (Prisma não roda isto automaticamente)
ALTER TABLE "platform_settings" DROP COLUMN "n8nWorkflowCronId";
