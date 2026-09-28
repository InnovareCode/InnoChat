import { forTenant } from "@/lib/db/tenant-client";
import { getEvolutionClient } from "@/modules/whatsapp/evolution-client";
import { applyConnectedNumber } from "@/modules/whatsapp/connection";
import { parseConnectionEvent } from "@/core/whatsapp/connection-event";
import { normalizePhoneFromJid } from "@/core/whatsapp/phone";
import type { InternalApiContext } from "./internal-auth";

/**
 * `POST /connection-events` (docs/arquitetura.md §2 "Queda inesperada", §4 passo 5, §6.8):
 * aplica o `connection.update` da Evolution na instância já resolvida pelo token — **sempre**
 * devolve `200`, mesmo para um payload que não reconhecemos (`parseConnectionEvent` nunca
 * lança). Aplica o status diretamente (sem a heurística "só regride de CONNECTED" usada pelo
 * polling do dashboard em `src/modules/whatsapp/service.ts` — comportamento herdado e testado
 * desde a Fase 4, mantido aqui de propósito: um `connection.update` É o evento fidedigno da
 * Evolution, não uma consulta que pode pegar um instante intermediário).
 *
 * Fase 3 (esta rodada): cobre também o número conectado (`ownerJid`/`wuid`) e o anti-abuso de
 * `TrialClaim` (docs/arquitetura.md §7.3 regra 4) — reaproveita `applyConnectedNumber`
 * (`src/modules/whatsapp/connection.ts`), a MESMA função usada pelo polling do dashboard
 * (`getQrCode`/`refreshConnectionStatus`), para a regra de "um trial por número" nunca ficar
 * desalinhada entre os dois caminhos que podem detectar uma conexão.
 */
export async function applyConnectionEvent(ctx: InternalApiContext, payload: unknown): Promise<{ applied: boolean }> {
  const event = parseConnectionEvent(payload);
  if (!event) return { applied: false };

  const { tenantId, instance } = ctx;

  if (event.state === "CONNECTED") {
    const phoneE164 = normalizePhoneFromJid(event.ownerJid);
    if (phoneE164) {
      const evolution = await getEvolutionClient().catch(() => undefined);
      await applyConnectedNumber({ tenantId, instanceId: instance.id, instanceName: instance.instanceName, phoneE164, evolution });
    } else {
      // A Evolution disse "open" mas não mandou `wuid` neste evento — aplica o status mesmo
      // assim (comportamento herdado da Fase 4); sem número não dá para checar `TrialClaim`
      // ainda, mas o próximo poll do dashboard (`getQrCode`/`refreshConnectionStatus`) resolve
      // o telefone assim que a Evolution devolver `fetchInstances` com o dono preenchido.
      await forTenant(tenantId).whatsappInstance.update({
        where: { id: instance.id },
        data: { status: "CONNECTED", lastConnectedAt: new Date() },
      });
    }
    return { applied: true };
  }

  await forTenant(tenantId).whatsappInstance.update({
    where: { id: instance.id },
    data: { status: event.state, ...(event.state === "DISCONNECTED" ? { phoneE164: null } : {}) },
  });
  return { applied: true };
}
