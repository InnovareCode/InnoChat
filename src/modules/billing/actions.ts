"use server";

import { z } from "zod";
import { requireTenantMember } from "@/lib/auth/guards";
import { runAction, type Result } from "@/lib/result";
import { changePlan, listActivePlans, type ChangePlanResult } from "./service";

/**
 * Server Actions de cobrança do lado da empresa (docs/arquitetura.md §7.2, tela de Assinatura).
 * Sem `assertTenantCanWrite`: a tela de Assinatura funciona mesmo com a assinatura `SUSPENDED`
 * (§7.4 — é o único jeito de a empresa conseguir pagar/trocar de plano para saír de lá).
 */

export type PlanListItem = {
  id: string;
  code: string;
  name: string;
  priceCents: number;
  maxWhatsappNumbers: number;
  maxProfessionals: number | null;
  sortOrder: number;
};

export async function listActivePlansAction(tenantSlug: string): Promise<Result<PlanListItem[]>> {
  return runAction(async () => {
    await requireTenantMember(tenantSlug);
    const plans = await listActivePlans();
    return plans.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      priceCents: p.priceCents,
      maxWhatsappNumbers: p.maxWhatsappNumbers,
      maxProfessionals: p.maxProfessionals,
      sortOrder: p.sortOrder,
    }));
  });
}

const changePlanSchema = z.object({ planId: z.string().min(1) });

/** Restrito a `OWNER` — troca de plano é decisão de dinheiro da empresa, não do dia a dia (mesma régua de `updateTenantThemeAction`). */
export async function changePlanAction(tenantSlug: string, input: unknown): Promise<Result<ChangePlanResult>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug, ["OWNER"]);
    const data = changePlanSchema.parse(input);
    return changePlan(tenant.id, data.planId);
  });
}
