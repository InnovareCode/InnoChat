"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { runAction, type Result } from "@/lib/result";
import { DomainError } from "@/lib/errors";
import { ensurePublicBaseUrlFromCurrentRequest } from "@/lib/public-url";
import { isValidCnpj, normalizeDocumentDigits } from "@/core/billing";
import {
  getMaskedPlatformSettings,
  getSavedIntegrationSecrets,
  regenerateInternalApiSecret,
  updatePlatformSettings,
  type PlatformSettingsView,
} from "./service";
import {
  testEvolutionConnection,
  testMercadoPagoConnection,
  testN8nConnection,
  testSmtpConnection,
  type ConnectionTestResult,
} from "./connection-tests";
import { activateBotWorkflow, deactivateBotWorkflow, syncN8n, type N8nSyncSummary } from "./n8n-sync";
import { getPlatformLegalInfo, updatePlatformLegalInfo } from "./legal-service";
import type { PlatformLegalInfo } from "@/core/legal/placeholders";
import { getPlatformHealth, type PlatformHealth } from "./health-service";

/**
 * Server Actions do admin da plataforma (docs/contratos.md). Guardadas por
 * `requirePlatformAdmin()` — nunca confiam em nada vindo do client sobre a sessão.
 */

export async function getPlatformSettingsAction(): Promise<Result<PlatformSettingsView>> {
  return runAction(async () => {
    await requirePlatformAdmin();
    return getMaskedPlatformSettings();
  });
}

const updatePlatformSettingsSchema = z.object({
  evolutionApiUrl: z.union([z.literal(""), z.string().url()]).optional(),
  evolutionApiKey: z.string().max(500).optional(),
  n8nWebhookBaseUrl: z.union([z.literal(""), z.string().url()]).optional(),
  n8nBaseUrl: z.union([z.literal(""), z.string().url()]).optional(),
  n8nApiKey: z.string().max(500).optional(),
  mercadoPagoAccessToken: z.string().max(500).optional(),
  mercadoPagoWebhookSecret: z.string().max(500).optional(),
  smtpHost: z.string().max(255).optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().max(255).optional(),
  smtpPassword: z.string().max(500).optional(),
  smtpFrom: z.union([z.literal(""), z.string().email()]).optional(),
});

export async function updatePlatformSettingsAction(input: unknown): Promise<Result<PlatformSettingsView>> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    const data = updatePlatformSettingsSchema.parse(input);
    // 1ª vez que um admin salva Configurações: grava `publicBaseUrl` a partir desta própria
    // requisição (nunca sobrescreve se já tiver um valor — ver `src/lib/public-url.ts`).
    await ensurePublicBaseUrlFromCurrentRequest();
    return updatePlatformSettings(data, admin.id);
  });
}

/**
 * Gera e devolve o segredo da API interna EM TEXTO PURO — só nesta chamada. A tela precisa
 * mostrar isso ao dono uma única vez e nunca mais poder buscá-lo de volta.
 */
export async function regenerateInternalApiSecretAction(): Promise<Result<{ secret: string }>> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    return regenerateInternalApiSecret(admin.id);
  });
}

// ---------------------------------------------------------------------------
// Testar conexão (docs/contratos.md) — sempre {ok, detalhe}, nunca o segredo de volta.
// ---------------------------------------------------------------------------

// Em todos os testes, segredo em branco = usa o que já está salvo (mesma regra do "Salvar": campo
// vazio mantém o valor atual). O segredo salvo é lido e usado só aqui no servidor.
function missingSecret(label: string): never {
  throw new DomainError("MISSING_SECRET", `Informe ${label} ou salve antes de testar.`);
}

const testEvolutionSchema = z.object({ evolutionApiUrl: z.string().url(), evolutionApiKey: z.string().optional() });

export async function testEvolutionConnectionAction(input: unknown): Promise<Result<ConnectionTestResult>> {
  return runAction(async () => {
    await requirePlatformAdmin();
    const data = testEvolutionSchema.parse(input);
    const key = data.evolutionApiKey || (await getSavedIntegrationSecrets()).evolutionApiKey || missingSecret("a chave da Evolution");
    return testEvolutionConnection(data.evolutionApiUrl, key);
  });
}

const testMercadoPagoSchema = z.object({ mercadoPagoAccessToken: z.string().optional() });

export async function testMercadoPagoConnectionAction(input: unknown): Promise<Result<ConnectionTestResult>> {
  return runAction(async () => {
    await requirePlatformAdmin();
    const data = testMercadoPagoSchema.parse(input);
    const token =
      data.mercadoPagoAccessToken || (await getSavedIntegrationSecrets()).mercadoPagoAccessToken || missingSecret("o access token");
    return testMercadoPagoConnection(token);
  });
}

const testN8nSchema = z.object({ n8nBaseUrl: z.string().url(), n8nApiKey: z.string().optional() });

export async function testN8nConnectionAction(input: unknown): Promise<Result<ConnectionTestResult>> {
  return runAction(async () => {
    await requirePlatformAdmin();
    const data = testN8nSchema.parse(input);
    const key = data.n8nApiKey || (await getSavedIntegrationSecrets()).n8nApiKey || missingSecret("a chave de API do n8n");
    return testN8nConnection(data.n8nBaseUrl, key);
  });
}

const testSmtpSchema = z.object({
  smtpHost: z.string().min(1),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
});

export async function testSmtpConnectionAction(input: unknown): Promise<Result<ConnectionTestResult>> {
  return runAction(async () => {
    await requirePlatformAdmin();
    const data = testSmtpSchema.parse(input);
    return testSmtpConnection({
      host: data.smtpHost,
      port: data.smtpPort,
      secure: !!data.smtpSecure,
      user: data.smtpUser,
      password: data.smtpPassword || (await getSavedIntegrationSecrets()).smtpPassword || undefined,
    });
  });
}

// ---------------------------------------------------------------------------
// Sincronização do n8n (docs/contratos.md) — nunca ativa o bot sozinha.
// ---------------------------------------------------------------------------

export async function syncN8nAction(): Promise<Result<N8nSyncSummary>> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    return syncN8n(admin.id);
  });
}

export async function activateBotWorkflowAction(): Promise<Result<{ activated: true }>> {
  return runAction(async () => {
    await requirePlatformAdmin();
    await activateBotWorkflow();
    return { activated: true };
  });
}

export async function deactivateBotWorkflowAction(): Promise<Result<{ activated: false }>> {
  return runAction(async () => {
    await requirePlatformAdmin();
    await deactivateBotWorkflow();
    return { activated: false };
  });
}

// ---------------------------------------------------------------------------
// Dados jurídicos da empresa operadora (docs/contratos.md, "Dados jurídicos") — nenhum campo é
// segredo, tudo devolvido em claro.
// ---------------------------------------------------------------------------

export async function getPlatformLegalInfoAction(): Promise<Result<PlatformLegalInfo>> {
  return runAction(async () => {
    await requirePlatformAdmin();
    return getPlatformLegalInfo();
  });
}

const updatePlatformLegalInfoSchema = z.object({
  companyLegalName: z.string().trim().max(160).nullable().optional(),
  companyCnpj: z.string().trim().max(30).nullable().optional(),
  companyAddress: z.string().trim().max(300).nullable().optional(),
  contactEmail: z.union([z.literal(""), z.string().trim().email()]).nullable().optional(),
  dpoName: z.string().trim().max(160).nullable().optional(),
  dpoEmail: z.union([z.literal(""), z.string().trim().email()]).nullable().optional(),
  forumCity: z.string().trim().max(120).nullable().optional(),
  hostingRegion: z.string().trim().max(120).nullable().optional(),
  backupRetentionDays: z.coerce.number().int().min(1).max(3650).nullable().optional(),
});

export async function updatePlatformLegalInfoAction(input: unknown): Promise<Result<PlatformLegalInfo>> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    const data = updatePlatformLegalInfoSchema.parse(input);

    if (data.companyCnpj) {
      const digits = normalizeDocumentDigits(data.companyCnpj);
      if (!isValidCnpj(digits)) {
        throw new DomainError("INVALID_CNPJ", "CNPJ inválido — confira os dígitos.");
      }
      data.companyCnpj = digits;
    }

    const saved = await updatePlatformLegalInfo(data, admin.id);
    // /termos e /privacidade são estáticas com revalidate de 60s: invalida na hora para o
    // dado novo aparecer já na próxima visita (achado da Íris, 2026-09-29).
    revalidatePath("/termos");
    revalidatePath("/privacidade");
    return saved;
  });
}

// ---------------------------------------------------------------------------
// Admin → Saúde (docs/contratos.md, "Admin Saúde")
// ---------------------------------------------------------------------------

export async function getPlatformHealthAction(): Promise<Result<PlatformHealth>> {
  return runAction(async () => {
    await requirePlatformAdmin();
    return getPlatformHealth();
  });
}
