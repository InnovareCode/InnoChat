-- Rollback manual (Prisma não roda isto automaticamente).
ALTER TABLE "subscriptions" DROP COLUMN "suspendedEmailSentAt";

ALTER TABLE "invoices"
  DROP COLUMN "dueReminderEmailSentAt",
  DROP COLUMN "dueTodayEmailSentAt";
