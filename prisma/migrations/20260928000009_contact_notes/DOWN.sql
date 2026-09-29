-- Rollback manual (Prisma não roda DOWN automaticamente).
ALTER TABLE "contacts" DROP COLUMN "notes";
