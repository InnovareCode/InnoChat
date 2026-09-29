import { getPrisma } from "@/lib/db/prisma";
import { forTenant } from "@/lib/db/tenant-client";

/**
 * Onboarding guiado pelo mascote "Inno": tour por USUÁRIO (`User.onboardingTourCompletedAt`) e
 * checklist "Primeiros passos" por EMPRESA (`Tenant.onboardingChecklistDismissedAt`).
 *
 * Os `steps` são SEMPRE derivados dos dados reais — nada é marcado à mão:
 * - services:      ≥1 `Service` com `active = true`.
 * - professionals: ≥1 `Professional` com `active = true`.
 * - hours:         ≥1 `Professional` ativo com ≥1 `WorkingHour` (não existe "horário de
 *                  funcionamento" da empresa no schema; o horário mora no profissional).
 * - whatsapp:      ≥1 `WhatsappInstance` com `status = CONNECTED`, `deletedAt = null` e
 *                  `sandbox = false` (instância de teste não conta como número real).
 * - botTest:       ≥1 `Appointment` com `source = WHATSAPP` (o bot é o único caminho que grava
 *                  essa origem; o painel grava `PANEL`), em qualquer status — o passo é "o bot
 *                  já conseguiu agendar", mesmo que o teste tenha sido cancelado depois.
 *                  Escolhido no lugar de `ChatSession` porque essa não tem `tenantId` e "conversa
 *                  concluída" é um estado de string do n8n, sem garantia.
 */
export const ONBOARDING_STEP_KEYS = ["services", "professionals", "hours", "whatsapp", "botTest"] as const;
export type OnboardingStepKey = (typeof ONBOARDING_STEP_KEYS)[number];

export type OnboardingState = {
  tourCompletedAt: string | null;
  checklistDismissedAt: string | null;
  steps: Array<{ key: OnboardingStepKey; done: boolean }>;
  allDone: boolean;
};

async function computeSteps(tenantId: string): Promise<OnboardingState["steps"]> {
  const db = forTenant(tenantId);
  // Existência, não contagem total: `findFirst` + select mínimo, em paralelo.
  const [service, professional, withHours, connected, botAppointment] = await Promise.all([
    db.service.findFirst({ where: { active: true }, select: { id: true } }),
    db.professional.findFirst({ where: { active: true }, select: { id: true } }),
    db.professional.findFirst({ where: { active: true, workingHours: { some: {} } }, select: { id: true } }),
    db.whatsappInstance.findFirst({
      where: { status: "CONNECTED", deletedAt: null, sandbox: false },
      select: { id: true },
    }),
    db.appointment.findFirst({ where: { source: "WHATSAPP" }, select: { id: true } }),
  ]);
  return [
    { key: "services", done: !!service },
    { key: "professionals", done: !!professional },
    { key: "hours", done: !!withHours },
    { key: "whatsapp", done: !!connected },
    { key: "botTest", done: !!botAppointment },
  ];
}

export async function getOnboardingState(userId: string, tenantId: string): Promise<OnboardingState> {
  const prisma = getPrisma();
  const [user, tenant, steps] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { onboardingTourCompletedAt: true } }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { onboardingChecklistDismissedAt: true } }),
    computeSteps(tenantId),
  ]);
  return {
    tourCompletedAt: user?.onboardingTourCompletedAt?.toISOString() ?? null,
    checklistDismissedAt: tenant?.onboardingChecklistDismissedAt?.toISOString() ?? null,
    steps,
    allDone: steps.every((s) => s.done),
  };
}

/** Marca o tour como concluído OU pulado (mesmo efeito). Idempotente: preserva a 1ª data. */
export async function completeOnboardingTour(userId: string, tenantId: string): Promise<OnboardingState> {
  await getPrisma().user.updateMany({
    where: { id: userId, onboardingTourCompletedAt: null },
    data: { onboardingTourCompletedAt: new Date() },
  });
  return getOnboardingState(userId, tenantId);
}

/** Zera o tour do usuário para ele rever. */
export async function restartOnboardingTour(userId: string, tenantId: string): Promise<OnboardingState> {
  await getPrisma().user.update({ where: { id: userId }, data: { onboardingTourCompletedAt: null } });
  return getOnboardingState(userId, tenantId);
}

/** Esconde o checklist para a empresa toda. Idempotente: preserva a 1ª data. */
export async function dismissOnboardingChecklist(userId: string, tenantId: string): Promise<OnboardingState> {
  await getPrisma().tenant.updateMany({
    where: { id: tenantId, onboardingChecklistDismissedAt: null },
    data: { onboardingChecklistDismissedAt: new Date() },
  });
  return getOnboardingState(userId, tenantId);
}
