import { getPrisma } from "@/lib/db/prisma";
import { forTenant } from "@/lib/db/tenant-client";
import { DomainError } from "@/lib/errors";

/**
 * Limites de plano verificados NO SERVIDOR (docs/arquitetura.md §7.2: "não é só esconder o
 * botão"). Override em `Tenant` (`maxProfessionalsOverride`/`maxWhatsappNumbersOverride`) tem
 * SEMPRE precedência sobre o limite do `Plan` — é o admin da plataforma abrindo uma exceção
 * pontual para uma empresa específica. `null` (no override OU no limite do plano) = ilimitado.
 */

async function loadTenantAndPlanLimits(tenantId: string) {
  const tenant = await getPrisma().tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      maxProfessionalsOverride: true,
      maxWhatsappNumbersOverride: true,
      subscription: { select: { plan: { select: { maxProfessionals: true, maxWhatsappNumbers: true } } } },
    },
  });
  if (!tenant) {
    throw new DomainError("NOT_FOUND", "Empresa não encontrada.");
  }
  return tenant;
}

/**
 * Bloqueia criar um novo profissional se isso ultrapassar o limite. Chamada dentro de
 * `createProfessional` (src/modules/agenda/catalog.ts), ANTES do `create` — nunca depois
 * (não criamos e apagamos se passar do limite).
 */
export async function assertCanAddProfessional(tenantId: string): Promise<void> {
  const tenant = await loadTenantAndPlanLimits(tenantId);
  const limit = tenant.maxProfessionalsOverride ?? tenant.subscription?.plan.maxProfessionals ?? null;
  if (limit === null) return; // ilimitado

  const current = await forTenant(tenantId).professional.count({});
  if (current >= limit) {
    throw new DomainError(
      "PLAN_LIMIT_REACHED",
      `Seu plano permite até ${limit} profissional(is). Faça upgrade para adicionar mais.`,
      { rule: "maxProfessionals", limit, current },
    );
  }
}

/**
 * Mesma checagem para números de WhatsApp — exposta para a Fase 3 (conexão de instância)
 * chamar antes de criar uma `WhatsappInstance` nova. `deletedAt` não nulo não conta contra o
 * limite (instância removida "soft-delete").
 */
export async function assertCanAddWhatsappNumber(tenantId: string): Promise<void> {
  const tenant = await loadTenantAndPlanLimits(tenantId);
  const limit = tenant.maxWhatsappNumbersOverride ?? tenant.subscription?.plan.maxWhatsappNumbers ?? null;
  if (limit === null) return; // ilimitado

  const current = await forTenant(tenantId).whatsappInstance.count({ where: { deletedAt: null } });
  if (current >= limit) {
    throw new DomainError(
      "PLAN_LIMIT_REACHED",
      `Seu plano permite até ${limit} número(s) de WhatsApp. Faça upgrade para adicionar mais.`,
      { rule: "maxWhatsappNumbers", limit, current },
    );
  }
}

/**
 * Limite e uso de números de WhatsApp para a tela "WhatsApp" (mesma regra de
 * `assertCanAddWhatsappNumber`: override da empresa > limite do plano; `null` = ilimitado; conta só
 * instâncias não removidas).
 */
export async function getWhatsappNumberUsage(tenantId: string): Promise<{ maxNumbers: number | null; usedNumbers: number }> {
  const tenant = await loadTenantAndPlanLimits(tenantId);
  const maxNumbers = tenant.maxWhatsappNumbersOverride ?? tenant.subscription?.plan.maxWhatsappNumbers ?? null;
  const usedNumbers = await forTenant(tenantId).whatsappInstance.count({ where: { deletedAt: null } });
  return { maxNumbers, usedNumbers };
}
