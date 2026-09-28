import { getPrisma } from "@/lib/db/prisma";
import { isUniqueViolation } from "@/lib/db/prisma-errors";
import { forTenant } from "@/lib/db/tenant-client";
import { logger } from "@/lib/logger";
import { effectiveStatusForTenant } from "@/modules/billing/service";
import { getEvolutionClient, type EvolutionClient } from "./evolution-client";

/**
 * Aplica um número recém-conectado a uma `WhatsappInstance` — usado tanto pelo polling do
 * dashboard (`getQrCode`/`refreshConnectionStatus` em `service.ts`) quanto pelo webhook
 * `connection.update` (`src/modules/bot-api/connection-events.ts`), para não duplicar a regra
 * de anti-abuso de trial em dois lugares (lição registrada: "estender função de domínio
 * compartilhada, não forkar").
 *
 * Regra (docs/arquitetura.md §7.3 regra 4): ao conectar (status CONNECTED) **em trial**, grava
 * `TrialClaim(phoneE164)`. Se o número já teve trial em OUTRA empresa, bloqueia — desconecta a
 * instância na Evolution e marca localmente como `DISCONNECTED` — com um motivo que a tela pode
 * mostrar de forma clara.
 */
export type ApplyConnectedNumberResult =
  | { blocked: false }
  | { blocked: true; reason: "TRIAL_PHONE_ALREADY_USED" };

export async function applyConnectedNumber(params: {
  tenantId: string;
  instanceId: string;
  instanceName: string;
  phoneE164: string;
  evolution?: EvolutionClient;
}): Promise<ApplyConnectedNumberResult> {
  const { tenantId, instanceId, instanceName, phoneE164 } = params;
  const db = forTenant(tenantId);

  let isTrialing = false;
  try {
    isTrialing = (await effectiveStatusForTenant(tenantId)) === "TRIALING";
  } catch {
    // Sem `Subscription` (não deveria acontecer para um tenant real, mas alguns cenários de
    // teste/seed não criam uma) — trata como "não é trial", só conecta normalmente.
    isTrialing = false;
  }

  if (isTrialing) {
    const existingClaim = await getPrisma().trialClaim.findUnique({ where: { phoneE164 } });

    if (existingClaim && existingClaim.tenantId !== tenantId) {
      await db.whatsappInstance.update({
        where: { id: instanceId },
        data: { status: "DISCONNECTED", phoneE164: null },
      });

      try {
        const evolution = params.evolution ?? (await getEvolutionClient());
        await evolution.logout(instanceName);
      } catch (error) {
        logger.warn("whatsapp.trial_block.logout_failed", {
          instanceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      logger.warn("whatsapp.trial_block", { tenantId, instanceId });
      return { blocked: true, reason: "TRIAL_PHONE_ALREADY_USED" };
    }

    if (!existingClaim) {
      try {
        await getPrisma().trialClaim.create({ data: { phoneE164, tenantId } });
      } catch (error) {
        // Corrida: outra chamada concorrente (webhook + polling do dashboard, por exemplo)
        // criou o claim entre o findUnique e o create — a constraint @unique(phoneE164) é a
        // fonte da verdade; ignora se for exatamente essa violação.
        if (!isUniqueViolation(error)) throw error;
      }
    }
  }

  await db.whatsappInstance.update({
    where: { id: instanceId },
    data: { status: "CONNECTED", phoneE164, lastConnectedAt: new Date() },
  });

  return { blocked: false };
}
