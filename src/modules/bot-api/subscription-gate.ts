import { DomainError } from "@/lib/errors";
import { isTenantBotAllowedFor } from "@/modules/billing/service";

/**
 * Bloqueio do bot por assinatura (docs/arquitetura.md §2 regra 8, §7.4): `claimMessage` chama
 * isto e devolve `ignore/TENANT_SUSPENDED` quando `false`.
 *
 * Empresa sem `Subscription` fica bloqueada (fail-closed): todo cadastro cria uma, então a
 * ausência é dado inconsistente, e o `claim` nunca pode virar 5xx por causa disso.
 */
export async function isTenantBotAllowed(tenantId: string): Promise<boolean> {
  try {
    return await isTenantBotAllowedFor(tenantId);
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") return false;
    throw error;
  }
}
