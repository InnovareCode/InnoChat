"use server";

import { requireSessionUser, requireTenantMember } from "@/lib/auth/guards";
import { getPrisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors";
import { runAction, type Result } from "@/lib/result";
import {
  completeOnboardingTour,
  dismissOnboardingChecklist,
  getOnboardingState,
  restartOnboardingTour,
  type OnboardingState,
} from "./service";

/**
 * Resolve usuário + empresa. O contrato não tem parâmetro obrigatório: sem `tenantSlug`, usa a
 * empresa mais antiga em que o usuário tem `Membership` (usuário de 1 empresa = caso comum).
 * Com `tenantSlug`, aplica o guard habitual (`requireTenantMember`, NOT_FOUND se não for membro).
 * Não exige `assertTenantCanWrite`: são preferências de UX e devem funcionar até com a conta
 * suspensa.
 */
async function resolveContext(tenantSlug?: string): Promise<{ userId: string; tenantId: string }> {
  if (tenantSlug) {
    const { tenant, user } = await requireTenantMember(tenantSlug);
    return { userId: user.id, tenantId: tenant.id };
  }
  const user = await requireSessionUser();
  const membership = await getPrisma().membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { tenantId: true },
  });
  if (!membership) throw new DomainError("NOT_FOUND", "Empresa não encontrada.");
  return { userId: user.id, tenantId: membership.tenantId };
}

export async function getOnboardingStateAction(tenantSlug?: string): Promise<Result<OnboardingState>> {
  return runAction(async () => {
    const { userId, tenantId } = await resolveContext(tenantSlug);
    return getOnboardingState(userId, tenantId);
  });
}

export async function completeOnboardingTourAction(tenantSlug?: string): Promise<Result<OnboardingState>> {
  return runAction(async () => {
    const { userId, tenantId } = await resolveContext(tenantSlug);
    return completeOnboardingTour(userId, tenantId);
  });
}

export async function restartOnboardingTourAction(tenantSlug?: string): Promise<Result<OnboardingState>> {
  return runAction(async () => {
    const { userId, tenantId } = await resolveContext(tenantSlug);
    return restartOnboardingTour(userId, tenantId);
  });
}

export async function dismissOnboardingChecklistAction(tenantSlug?: string): Promise<Result<OnboardingState>> {
  return runAction(async () => {
    const { userId, tenantId } = await resolveContext(tenantSlug);
    return dismissOnboardingChecklist(userId, tenantId);
  });
}
