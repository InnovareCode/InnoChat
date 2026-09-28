"use server";

import { z } from "zod";
import { requireTenantMember } from "@/lib/auth/guards";
import { runAction, type Result } from "@/lib/result";
import { updateTenantTheme } from "./service";

const PANEL_THEMES = ["INDIGO_CLINICO", "AMBAR_ESTUDIO", "VERDE_SLATE"] as const;

const updateThemeSchema = z.object({
  theme: z.enum(PANEL_THEMES),
});

/**
 * Troca o tema visual do painel (docs/arquitetura.md §5 — "só os 3 temas prontos"). Restrito a
 * `OWNER`: é decisão de identidade da empresa, não operação do dia a dia.
 */
export async function updateTenantThemeAction(tenantSlug: string, input: unknown): Promise<Result<{ theme: string }>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug, ["OWNER"]);
    const data = updateThemeSchema.parse(input);
    const updated = await updateTenantTheme(tenant.id, data.theme);
    return { theme: updated.theme };
  });
}
