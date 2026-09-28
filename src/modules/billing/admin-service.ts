import { addMonths } from "date-fns";
import { getPrisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors";
import { effectiveStatus, GRACE_DAYS } from "@/core/billing";

/**
 * Admin de planos e empresas (docs/arquitetura.md §9, Fase 7). Guardado por
 * `requirePlatformAdmin()` na camada de Server Action (`admin-actions.ts`) — este arquivo é só
 * I/O, sem checagem de permissão (assume que quem chamou já validou).
 */

// ---------------------------------------------------------------------------
// Planos
// ---------------------------------------------------------------------------

export async function listPlans() {
  return getPrisma().plan.findMany({ orderBy: { sortOrder: "asc" } });
}

export type UpdatePlanInput = {
  name?: string;
  priceCents?: number;
  maxWhatsappNumbers?: number;
  maxProfessionals?: number | null;
  active?: boolean;
  sortOrder?: number;
};

export async function updatePlan(planId: string, input: UpdatePlanInput) {
  const existing = await getPrisma().plan.findUnique({ where: { id: planId } });
  if (!existing) throw new DomainError("NOT_FOUND", "Plano não encontrado.");
  return getPrisma().plan.update({ where: { id: planId }, data: input });
}

// ---------------------------------------------------------------------------
// Empresas (lista com status efetivo, suspender/reativar, estender trial)
// ---------------------------------------------------------------------------

export type CompanyListItem = {
  tenantId: string;
  slug: string;
  name: string;
  planCode: string;
  persistedStatus: string;
  effectiveStatus: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date;
};

const COMPANIES_PAGE_MAX = 100;
const COMPANIES_PAGE_DEFAULT = 30;

/** Sempre paginado (nunca "todas as empresas" de uma vez) — cursor pelo `tenantId`. */
export async function listCompanies(params: { cursor?: string; limit?: number }): Promise<{ items: CompanyListItem[]; nextCursor: string | null }> {
  const limit = Math.min(params.limit ?? COMPANIES_PAGE_DEFAULT, COMPANIES_PAGE_MAX);
  const now = new Date();

  const subscriptions = await getPrisma().subscription.findMany({
    take: limit + 1,
    ...(params.cursor ? { cursor: { tenantId: params.cursor }, skip: 1 } : {}),
    orderBy: { tenantId: "asc" },
    include: { tenant: true, plan: true },
  });

  const hasMore = subscriptions.length > limit;
  const page = hasMore ? subscriptions.slice(0, limit) : subscriptions;

  return {
    items: page.map((s) => ({
      tenantId: s.tenantId,
      slug: s.tenant.slug,
      name: s.tenant.name,
      planCode: s.plan.code,
      persistedStatus: s.status,
      effectiveStatus: effectiveStatus(s, now),
      trialEndsAt: s.trialEndsAt,
      currentPeriodEnd: s.currentPeriodEnd,
    })),
    nextCursor: hasMore ? page[page.length - 1]!.tenantId : null,
  };
}

/**
 * Suspende manualmente (ex.: fraude, pedido do dono) — força `SUSPENDED` mesmo que a data de
 * vencimento ainda não tenha chegado. `effectiveStatus` é pura e só olha `currentPeriodEnd`;
 * para o efetivo bater com `SUSPENDED` sem reescrever a matemática de ciclo, empurramos
 * `currentPeriodEnd` para o passado o suficiente (vencido + carência já vencida). Isso é seguro
 * porque um pagamento futuro SEMPRE conta a partir de `paidAt` quando a assinatura estava
 * `SUSPENDED` (`computeNextPeriodEnd`), então essa data "artificial" nunca vaza para o próximo
 * ciclo cobrado.
 */
export async function suspendCompanyManually(tenantId: string): Promise<void> {
  const prisma = getPrisma();
  const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!subscription) throw new DomainError("NOT_FOUND", "Assinatura não encontrada.");
  if (subscription.status === "CANCELED") {
    throw new DomainError("INVALID_STATE", "Esta assinatura já está cancelada.");
  }

  const now = new Date();
  const pastDueAt = new Date(now.getTime() - (GRACE_DAYS + 1) * 24 * 60 * 60 * 1000);

  await prisma.subscription.update({
    where: { tenantId },
    data: { status: "SUSPENDED", currentPeriodEnd: pastDueAt, trialEndsAt: null },
  });
}

/** Reativa manualmente: volta para `ACTIVE` com um ciclo novo de 1 mês a partir de hoje. */
export async function reactivateCompanyManually(tenantId: string): Promise<void> {
  const prisma = getPrisma();
  const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!subscription) throw new DomainError("NOT_FOUND", "Assinatura não encontrada.");

  const now = new Date();
  await prisma.subscription.update({
    where: { tenantId },
    data: { status: "ACTIVE", currentPeriodEnd: addMonths(now, 1), trialEndsAt: null, canceledAt: null, suspendedEmailSentAt: null },
  });
}

/** Estende o trial em `extraDays` dias — só válido enquanto ainda está em TRIALING. */
export async function extendTrialManually(tenantId: string, extraDays: number): Promise<void> {
  if (extraDays <= 0 || extraDays > 30) {
    throw new DomainError("INVALID_PAYLOAD", "A extensão precisa ser entre 1 e 30 dias.");
  }

  const prisma = getPrisma();
  const subscription = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!subscription) throw new DomainError("NOT_FOUND", "Assinatura não encontrada.");
  if (subscription.status !== "TRIALING" || !subscription.trialEndsAt) {
    throw new DomainError("INVALID_STATE", "Só é possível estender o trial enquanto a empresa está em trial.");
  }

  const newTrialEndsAt = new Date(subscription.trialEndsAt.getTime() + extraDays * 24 * 60 * 60 * 1000);
  await prisma.subscription.update({
    where: { tenantId },
    data: { trialEndsAt: newTrialEndsAt, currentPeriodEnd: newTrialEndsAt },
  });

  // A fatura do trial (única, criada no cadastro) também precisa refletir o novo vencimento —
  // senão o cliente recebe lembrete/suspensão na data antiga mesmo com o trial estendido.
  await prisma.invoice.updateMany({
    where: { subscriptionId: subscription.id, periodStart: { lte: subscription.trialEndsAt }, status: "OPEN" },
    data: { dueAt: newTrialEndsAt, periodEnd: newTrialEndsAt },
  });
}
