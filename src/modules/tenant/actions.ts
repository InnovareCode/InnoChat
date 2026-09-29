"use server";

import { z } from "zod";
import { requireTenantMember } from "@/lib/auth/guards";
import { runAction, type Result } from "@/lib/result";
import { assertTenantCanWrite } from "@/modules/billing/service";
import { updateTenantDocument, updateTenantTheme } from "./service";

const PANEL_THEMES = ["INDIGO_CLINICO", "AMBAR_ESTUDIO", "VERDE_SLATE"] as const;

const updateThemeSchema = z.object({
  theme: z.enum(PANEL_THEMES),
});

const updateDocumentSchema = z.object({
  document: z.string().min(1, "Informe o CPF ou CNPJ."),
});

/**
 * Troca o tema visual do painel (docs/arquitetura.md §5 — "só os 3 temas prontos"). Restrito a
 * `OWNER`: é decisão de identidade da empresa, não operação do dia a dia.
 */
export async function updateTenantThemeAction(tenantSlug: string, input: unknown): Promise<Result<{ theme: string }>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug, ["OWNER"]);
    await assertTenantCanWrite(tenant.id);
    const data = updateThemeSchema.parse(input);
    const updated = await updateTenantTheme(tenant.id, data.theme);
    return { theme: updated.theme };
  });
}

/**
 * Cadastra/atualiza o CPF/CNPJ da empresa (docs/contratos.md, seção Cobrança — CONTRATO NOVO
 * para a Lyra: a tela de Configurações precisa de um campo para chamar esta action antes da
 * empresa conseguir gerar Pix). Restrito a `OWNER`, mesma régua do tema visual: é dado de
 * identidade/fiscal da empresa, não operação do dia a dia.
 */
export async function updateTenantDocumentAction(tenantSlug: string, input: unknown): Promise<Result<{ document: string }>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug, ["OWNER"]);
    await assertTenantCanWrite(tenant.id);
    const data = updateDocumentSchema.parse(input);
    const updated = await updateTenantDocument(tenant.id, data.document);
    return { document: updated.document! };
  });
}
