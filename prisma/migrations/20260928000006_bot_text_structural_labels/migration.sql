-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BotTextKey" ADD VALUE 'LABEL_CONFIRM';
ALTER TYPE "BotTextKey" ADD VALUE 'LABEL_OTHER_TIME';
ALTER TYPE "BotTextKey" ADD VALUE 'LABEL_CANCEL_YES';
ALTER TYPE "BotTextKey" ADD VALUE 'LABEL_CANCEL_NO';
ALTER TYPE "BotTextKey" ADD VALUE 'LABEL_MORE_DAYS';
ALTER TYPE "BotTextKey" ADD VALUE 'LABEL_MORE_TIMES';
ALTER TYPE "BotTextKey" ADD VALUE 'LABEL_MORE';
ALTER TYPE "BotTextKey" ADD VALUE 'LABEL_BACK_TO_MENU';

