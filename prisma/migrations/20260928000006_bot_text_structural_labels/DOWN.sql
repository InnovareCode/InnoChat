-- Rollback manual (Prisma não roda DOWN automaticamente).
-- Postgres não tem "ALTER TYPE ... DROP VALUE": só dá para remover um valor de enum recriando o
-- tipo. Só faz sentido rodar isto se NENHUMA linha de "bot_texts" usar as chaves novas (elas só
-- existem em "bot_texts" quando o tenant edita o texto padrão) e nenhuma versão do código ainda
-- as referencia.
BEGIN;

DELETE FROM "bot_texts" WHERE "key" IN (
  'LABEL_CONFIRM', 'LABEL_OTHER_TIME', 'LABEL_CANCEL_YES', 'LABEL_CANCEL_NO',
  'LABEL_MORE_DAYS', 'LABEL_MORE_TIMES', 'LABEL_MORE', 'LABEL_BACK_TO_MENU'
);

ALTER TYPE "BotTextKey" RENAME TO "BotTextKey_old";

CREATE TYPE "BotTextKey" AS ENUM (
  'GREETING', 'MAIN_MENU', 'CHOOSE_SERVICE', 'CHOOSE_PROFESSIONAL', 'CHOOSE_DAY', 'CHOOSE_TIME',
  'NO_SLOTS_DAY', 'NO_AVAILABILITY', 'ASK_NAME', 'CONFIRM_SUMMARY', 'BOOKED', 'SLOT_TAKEN',
  'MY_APPOINTMENTS', 'NO_APPOINTMENTS', 'APPOINTMENT_ACTIONS', 'CONFIRM_CANCEL', 'CANCELED',
  'RESCHEDULED', 'TOO_LATE', 'HUMAN_HANDOFF', 'INVALID_OPTION', 'TOO_MANY_INVALID', 'ONLY_TEXT',
  'SESSION_EXPIRED', 'GOODBYE'
);

ALTER TABLE "bot_texts" ALTER COLUMN "key" TYPE "BotTextKey" USING ("key"::text::"BotTextKey");

DROP TYPE "BotTextKey_old";

COMMIT;
