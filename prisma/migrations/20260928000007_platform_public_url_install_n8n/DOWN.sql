-- Rollback manual (Prisma não roda isto automaticamente).
DROP TABLE IF EXISTS "platform_install_codes";

ALTER TABLE "platform_settings"
  DROP COLUMN IF EXISTS "publicBaseUrl",
  DROP COLUMN IF EXISTS "n8nBaseUrl",
  DROP COLUMN IF EXISTS "n8nApiKey",
  DROP COLUMN IF EXISTS "n8nCredPainelId",
  DROP COLUMN IF EXISTS "n8nCredEvolutionId",
  DROP COLUMN IF EXISTS "n8nCredApiId",
  DROP COLUMN IF EXISTS "n8nWorkflowBotId",
  DROP COLUMN IF EXISTS "n8nWorkflowErrosId";
