"use server";

import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { runAction, type Result } from "@/lib/result";
import {
  extendTrialManually,
  listCompanies,
  listPlans,
  reactivateCompanyManually,
  suspendCompanyManually,
  updatePlan,
  type CompanyListItem,
} from "./admin-service";

/** Server Actions do admin da plataforma para planos e empresas (docs/contratos.md, Fase 7). */

export async function listPlansAction() {
  return runAction(async () => {
    await requirePlatformAdmin();
    return listPlans();
  });
}

const updatePlanSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  priceCents: z.coerce.number().int().min(0).optional(),
  maxWhatsappNumbers: z.coerce.number().int().min(1).optional(),
  maxProfessionals: z.coerce.number().int().min(1).nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export async function updatePlanAction(planId: string, input: unknown) {
  return runAction(async () => {
    await requirePlatformAdmin();
    const data = updatePlanSchema.parse(input);
    return updatePlan(planId, data);
  });
}

const listCompaniesSchema = z.object({ cursor: z.string().min(1).optional(), limit: z.coerce.number().int().min(1).max(100).optional() });

export async function listCompaniesAction(input?: unknown): Promise<Result<{ items: CompanyListItem[]; nextCursor: string | null }>> {
  return runAction(async () => {
    await requirePlatformAdmin();
    const data = listCompaniesSchema.parse(input ?? {});
    return listCompanies(data);
  });
}

export async function suspendCompanyAction(tenantId: string): Promise<Result<{ tenantId: string }>> {
  return runAction(async () => {
    await requirePlatformAdmin();
    await suspendCompanyManually(tenantId);
    return { tenantId };
  });
}

export async function reactivateCompanyAction(tenantId: string): Promise<Result<{ tenantId: string }>> {
  return runAction(async () => {
    await requirePlatformAdmin();
    await reactivateCompanyManually(tenantId);
    return { tenantId };
  });
}

const extendTrialSchema = z.object({ extraDays: z.coerce.number().int().min(1).max(30) });

export async function extendTrialAction(tenantId: string, input: unknown): Promise<Result<{ tenantId: string }>> {
  return runAction(async () => {
    await requirePlatformAdmin();
    const data = extendTrialSchema.parse(input);
    await extendTrialManually(tenantId, data.extraDays);
    return { tenantId };
  });
}
