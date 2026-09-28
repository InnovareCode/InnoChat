-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "dueReminderEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "dueTodayEmailSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "suspendedEmailSentAt" TIMESTAMP(3);

